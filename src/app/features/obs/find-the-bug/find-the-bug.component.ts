/**
 * FindTheBugComponent — guided incident-reproduction UX.
 *
 * A companion page to the chaos one. Where `ChaosComponent` gives an
 * operator a grid of power-tool buttons (great for demo audiences that
 * already know the stack), this page walks a FIRST-TIME visitor through a
 * scripted "spot the bug → observe metrics → read root cause → click fix"
 * loop for a handful of scenarios. Goal: convert a 10-second "huh, that's
 * a lot of buttons" reaction on the chaos page into a 2-minute "oh, I see
 * how observability pays off" storyline.
 *
 * Each {@link BugScenario} drives a 4-step state machine:
 *   1. Idle — buttons explaining the scenario
 *   2. Triggered — backend is receiving failure-inducing traffic; we poll
 *      the observable metric (error rate, 429 count, p95) every 2s and
 *      display it inline so the user sees the signal rise
 *   3. Revealed — after N seconds (configurable per-scenario) the root-cause
 *      card auto-reveals; reading it is meant to take ~30 s
 *   4. Fixing / Recovered — "Apply fix" button triggers whatever undoes
 *      the scenario (usually a backend rate-limit reset or a short wait);
 *      we keep polling until the metric returns to normal
 *
 * Intentionally NOT reusing ChaosComponent — different UX and different
 * narrative. A separate component keeps each simple. Backend endpoints
 * are the same (no new server work for this phase).
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, Subscription } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { EnvService } from '../../../core/env/env.service';
import { ActivityService } from '../../../core/activity/activity.service';
import { ToastService } from '../../../core/toast/toast.service';

/** Lifecycle state of a single scenario. */
type ScenarioState = 'idle' | 'triggered' | 'revealed' | 'fixing' | 'recovered';

/** Metric sample captured while a scenario is active. */
interface MetricSample {
  readonly t: number; // monotonic index (0, 1, 2, ...)
  readonly value: number; // domain-specific (error %, count, p95ms, ...)
}

/**
 * Configuration for one scenario. Keeping this data-driven so adding a
 * new bug is a single object literal; the rendering logic doesn't branch.
 */
interface BugScenario {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  /** One-line teaser shown in the idle state. */
  readonly teaser: string;
  /** Metric unit displayed next to the live number (e.g. '%', 'errors', 'ms'). */
  readonly unit: string;
  /** Revealed root cause — the "aha" moment once the user's been staring at the chart. */
  readonly rootCause: string;
  /** Markdown-ish bullet list of the actual fix (one-liner per step). */
  readonly fixSteps: readonly string[];
  /** Delay (ms) between trigger and root-cause auto-reveal. */
  readonly revealAfterMs: number;
  /** Triggers the scenario. Should invoke backend chaos endpoint. */
  readonly trigger: (api: ApiService, env: EnvService) => Promise<void>;
  /** Polls the observable metric once and returns a numeric sample. */
  readonly sample: (api: ApiService, env: EnvService) => Promise<number>;
  /** Stops the failure condition (often a no-op; backends self-heal in ~60s). */
  readonly recover: (api: ApiService, env: EnvService) => Promise<void>;
}

@Component({
  standalone: true,
  selector: 'app-find-the-bug',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './find-the-bug.component.html',
  styleUrl: './find-the-bug.component.scss',
})
export class FindTheBugComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly env = inject(EnvService);
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Per-scenario state + metric history. Keyed by scenario id. */
  private readonly scenarioState = signal<Record<string, ScenarioState>>({});
  private readonly scenarioMetrics = signal<Record<string, MetricSample[]>>({});
  private readonly scenarioSubs = new Map<string, Subscription>();
  private readonly scenarioTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly scenarios: readonly BugScenario[] = [
    {
      id: 'rate-limit',
      icon: '🚦',
      title: 'Traffic tsunami — who is throttling me?',
      teaser:
        'The customer page suddenly gets a bunch of 429 Too Many Requests. Trigger the burst, watch the 429 count rise, and work out what just happened.',
      unit: '429s',
      revealAfterMs: 15_000,
      rootCause:
        'Mirador applies a 100 req/min per-IP rate limit (bucket4j, configured in application.yml). ' +
        'The chaos trigger fired 120 requests in ~3 seconds — the first 100 return 200, the next 20 return 429. ' +
        'The bucket refills at 100/min, so normal traffic recovers within ~60 s.',
      fixSteps: [
        '- No code change needed: the bucket refills 100 tokens per minute.',
        '- If a real client is hitting the limit, raise the quota in `application.yml` OR move that client to an API key with a higher bucket (see SecurityConfig).',
        '- For a demo recovery, just wait 60 s and the metric drops back to zero.',
      ],
      trigger: async (api) => {
        // 120 fire-and-forget GETs — each returns 200 or 429; we don't care which.
        // Deliberately firing via the api.service without await so the burst
        // actually overlaps in time (awaiting each serialises them and the
        // bucket wouldn't fill up).
        for (let i = 0; i < 120; i++)
          api.getHealth().subscribe({
            // Fire-and-forget chaos trigger — we intentionally swallow errors
            // because 4xx / 5xx responses ARE the bug we're demonstrating.
            // Noop is load-bearing: see the scenario's root-cause card.
            error: () => undefined,
          });
      },
      sample: async (api, env) => {
        // Prometheus exposes `http_server_requests_seconds_count{status="429"}`
        // via actuator/prometheus. We read the scrape text, grep the metric,
        // and sum over series — a tiny parser but portable (no client dep).
        const url = `${env.baseUrl()}/actuator/prometheus`;
        try {
          const text = await fetch(url).then((r) => r.text());
          return text
            .split('\n')
            .filter(
              (l) => l.includes('http_server_requests_seconds_count') && l.includes('status="429"'),
            )
            .reduce((sum, line) => {
              const n = Number(line.split(/\s+/).pop() ?? 0);
              return sum + (Number.isFinite(n) ? n : 0);
            }, 0);
        } catch {
          return 0;
        }
      },
      recover: async () => {
        // Bucket refills automatically; nothing to call.
      },
    },
    {
      id: 'circuit-break',
      icon: '⚡',
      title: 'Bio generation broken — what opened?',
      teaser:
        'The /bio endpoint starts returning "Bio temporarily unavailable." even though the service still replies 200. Fire the trigger and see how long the fallback stays in effect.',
      unit: 'fallback %',
      revealAfterMs: 20_000,
      rootCause:
        'Ollama is slow (or down). Mirador wraps the /bio call in a Resilience4j circuit breaker — after 10 failures in a rolling window the circuit opens, and subsequent calls short-circuit to the fallback string without touching Ollama. ' +
        'This is a FEATURE, not a bug: it protects Mirador from a cascading slowdown when Ollama is the bottleneck. ' +
        'The circuit waits 30 s in OPEN state, then allows one probe in HALF_OPEN — if it succeeds, returns to CLOSED.',
      fixSteps: [
        "- Don't try to hammer /bio to 'fix' it — that keeps the circuit OPEN.",
        '- Check Ollama: `docker logs mirador-ollama-1` — usually a slow model or OOM.',
        '- Either wait 30 s (auto-recovery) or restart Ollama: `docker restart mirador-ollama-1`.',
      ],
      trigger: async (api) => {
        // Hammer /bio 10 times — Ollama's real state decides whether the
        // circuit opens. On a dev machine where Ollama is up, this will
        // NOT open the circuit (by design) — but the metric still spikes
        // for a few seconds as requests queue behind the LLM.
        for (let i = 0; i < 10; i++) {
          api.getCustomerBio(1).subscribe({
            // Fire-and-forget chaos trigger — we intentionally swallow errors
            // because 4xx / 5xx responses ARE the bug we're demonstrating.
            // Noop is load-bearing: see the scenario's root-cause card.
            error: () => undefined,
          });
        }
      },
      sample: async (api, env) => {
        // Count "Bio temporarily unavailable" responses in the last N reqs.
        // We can't query Prometheus for that directly (it's a string in
        // the body, not a metric). Hit /actuator/circuitbreakers for the
        // current state — state=OPEN → return 100, HALF_OPEN → 50, CLOSED → 0.
        const url = `${env.baseUrl()}/actuator/circuitbreakers`;
        try {
          const res: { circuitBreakers?: Record<string, { state?: string }> } = await fetch(
            url,
          ).then((r) => r.json());
          const bio = res.circuitBreakers?.['bioCircuit'] ?? res.circuitBreakers?.['bioService'];
          if (!bio) return 0;
          switch (bio.state) {
            case 'OPEN':
              return 100;
            case 'HALF_OPEN':
              return 50;
            default:
              return 0;
          }
        } catch {
          return 0;
        }
      },
      recover: async () => {
        // Circuit auto-recovers — nothing to call.
      },
    },
    {
      id: 'aggregate-storm',
      icon: '🐢',
      title: 'Aggregate endpoint feels slow — but CPU is idle?',
      teaser:
        'Hammer `/customers/aggregate` with parallel calls and watch max latency climb to 200+ ms. On a Pyroscope CPU profile the JVM looks idle — so where is the time going?',
      unit: 'ms (max)',
      revealAfterMs: 20_000,
      rootCause:
        'AggregationService runs two sub-tasks on a virtual-thread executor, each deliberately sleeping 200 ms (see AggregationServicePropertyTest). ' +
        'They run in PARALLEL, so a single call takes ~200 ms — NOT ~400 ms. Under N concurrent calls the carrier-thread pool fans them all out; latency stays flat at ~200 ms. ' +
        'The JVM "idle" signal is correct — the sleep is a `Thread.sleep` on a virtual thread, which unmounts the carrier. Pyroscope CPU profiles miss it because the thread is parked. Use the "wall-clock" profile type to see the time. ' +
        "This scenario's takeaway: CPU profile alone lies when virtual threads are involved — pair it with wall-clock or JDBC profiles.",
      fixSteps: [
        '- Switch the Pyroscope profile type from `cpu` to `wall` — the sleep shows up.',
        '- Check the Mirador Tempo trace: the /aggregate span has TWO parallel child spans (loadCustomerData + loadStats) — both span ~200 ms.',
        '- "Fix" here = accept the 200 ms as designed. In a real slow endpoint, the same tools (Tempo + Pyroscope wall-clock) would isolate the blocking caller.',
      ],
      trigger: async (api) => {
        // Fire 10 parallel aggregate() calls. Backend runs each on virtual
        // threads — total wall-time stays near 200 ms if parallelism works,
        // which the property test (T3) verifies separately.
        for (let i = 0; i < 10; i++)
          api.getAggregate().subscribe({
            // Fire-and-forget chaos trigger — we intentionally swallow errors
            // because 4xx / 5xx responses ARE the bug we're demonstrating.
            // Noop is load-bearing: see the scenario's root-cause card.
            error: () => undefined,
          });
      },
      sample: async (api, env) => {
        // Read the MAX latency metric from actuator — simplest signal that
        // maps to "how slow did it feel?". URI-scoped so we only see the
        // aggregate endpoint, not every request.
        const url = `${env.baseUrl()}/actuator/metrics/http.server.requests?tag=uri:/customers/aggregate`;
        try {
          const res: { measurements?: { statistic: string; value: number }[] } = await fetch(
            url,
          ).then((r) => r.json());
          const maxSec = res.measurements?.find((m) => m.statistic === 'MAX')?.value ?? 0;
          return Math.round(maxSec * 1000); // Spring exposes seconds → ms
        } catch {
          return 0;
        }
      },
      recover: async () => {
        // Nothing to reset — MAX metric decays on its own via the rolling
        // window. On a 5-min window it takes 5 min to drop to zero.
      },
    },
  ];

  /** Expose a safe read of scenario state for the template. */
  readonly stateOf = (id: string): ScenarioState => this.scenarioState()[id] ?? 'idle';
  readonly metricsOf = (id: string): MetricSample[] => this.scenarioMetrics()[id] ?? [];

  /** Current live value (last sample) for the scenario, or 0 when no data yet. */
  readonly currentValue = (id: string): number => {
    const m = this.metricsOf(id);
    return m.length ? m[m.length - 1].value : 0;
  };

  /** Peak value seen so far — useful as a "headline number" in the card. */
  readonly peakValue = (id: string): number => {
    const m = this.metricsOf(id);
    return m.length ? Math.max(...m.map((x) => x.value)) : 0;
  };

  /** SVG path for the inline sparkline. Empty string when no data. */
  readonly sparkline = (id: string): string => {
    const m = this.metricsOf(id);
    if (m.length < 2) return '';
    const max = Math.max(1, ...m.map((x) => x.value));
    const w = 280; // fixed template width, matches .sparkline-svg viewBox
    const h = 40;
    return m
      .map((p, i) => {
        const x = (i / (m.length - 1)) * w;
        const y = h - (p.value / max) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  /** Kick off a scenario — state → triggered, start polling, arm reveal timer. */
  async start(scenario: BugScenario): Promise<void> {
    if (this.stateOf(scenario.id) !== 'idle' && this.stateOf(scenario.id) !== 'recovered') return;
    this.setState(scenario.id, 'triggered');
    this.setMetrics(scenario.id, []);
    // ActivityService has a narrow whitelist of types; `diagnostic-run` is
    // the closest fit for a scenario trigger (these are interactive
    // diagnostic actions, not CRUD events).
    this.activity.log('diagnostic-run', `find-the-bug: ${scenario.title} triggered`);
    try {
      await scenario.trigger(this.api, this.env);
    } catch {
      // Trigger is fire-and-forget; errors are expected for some scenarios.
    }

    // Poll the metric every 2 s until the user manually advances or cancels.
    const sub = interval(2000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (tick) => {
        const v = await scenario.sample(this.api, this.env);
        const cur = this.metricsOf(scenario.id);
        this.setMetrics(scenario.id, [...cur, { t: tick, value: v }].slice(-30));
      });
    this.scenarioSubs.set(scenario.id, sub);

    // Reveal the root cause after the scripted delay.
    const timer = setTimeout(() => {
      this.setState(scenario.id, 'revealed');
    }, scenario.revealAfterMs);
    this.scenarioTimers.set(scenario.id, timer);
  }

  /** Stop the failure condition (if any) and mark the scenario recovered. */
  async applyFix(scenario: BugScenario): Promise<void> {
    this.setState(scenario.id, 'fixing');
    try {
      await scenario.recover(this.api, this.env);
      this.toast.show(`Recovery applied — metric will settle in a few seconds`, 'info', 4000);
    } catch {
      this.toast.show(`Recovery invocation failed — check the console`, 'error', 4000);
    }
    // Let the metric reading settle for a beat, then mark recovered.
    setTimeout(() => this.setState(scenario.id, 'recovered'), 2000);
  }

  /** Reset a scenario to idle so the user can run it again. */
  reset(id: string): void {
    this.setState(id, 'idle');
    this.setMetrics(id, []);
    const sub = this.scenarioSubs.get(id);
    if (sub) {
      sub.unsubscribe();
      this.scenarioSubs.delete(id);
    }
    const timer = this.scenarioTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.scenarioTimers.delete(id);
    }
  }

  ngOnDestroy(): void {
    for (const sub of this.scenarioSubs.values()) sub.unsubscribe();
    for (const t of this.scenarioTimers.values()) clearTimeout(t);
  }

  private setState(id: string, state: ScenarioState): void {
    this.scenarioState.update((s) => ({ ...s, [id]: state }));
  }

  private setMetrics(id: string, m: MetricSample[]): void {
    this.scenarioMetrics.update((s) => ({ ...s, [id]: m }));
  }
}
