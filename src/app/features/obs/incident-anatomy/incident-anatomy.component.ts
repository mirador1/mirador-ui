/**
 * IncidentAnatomyComponent — scripted 5-minute "anatomy of an outage".
 *
 * A companion page to /find-the-bug. Where find-the-bug lets a visitor
 * INTERACT with one puzzle at a time, this page tells a single end-to-end
 * STORY: "here is what a real incident looks like, from T+0 alert fire
 * through T+5 recovery confirmed, using Mirador's actual observability
 * tooling". Read, don't click.
 *
 * Timeline chosen: the Ollama-circuit-breaker outage pattern (most
 * illustrative for a demo audience because it exercises the full
 * alert → runbook → trace → fix pipeline). Each step lists:
 *   - what the operator saw (metric / alert / log line — inline snippet)
 *   - what they did (command from the matching runbook)
 *   - links to the real artefact (alert rule, runbook, chaos action)
 *
 * No interactivity: the whole point is to compress a real incident into
 * a 60-second read so a recruiter skimming the project grasps the loop
 * without needing to trigger chaos themselves. For hands-on, point them
 * at /find-the-bug.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TimelineStep {
  readonly t: string; // wall-clock offset, e.g. "T+0"
  readonly icon: string;
  readonly title: string;
  /** "What the operator saw" — paragraph with inline snippet. */
  readonly observation: string;
  /** "What they did" — paragraph. */
  readonly action: string;
  /** Optional inline artefact snippet (alert YAML, LogQL query, curl). */
  readonly snippet?: { readonly label: string; readonly code: string };
  /** Links to real project artefacts. */
  readonly links?: readonly { readonly label: string; readonly url: string }[];
}

@Component({
  standalone: true,
  selector: 'app-incident-anatomy',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './incident-anatomy.component.html',
  styleUrl: './incident-anatomy.component.scss',
})
export class IncidentAnatomyComponent {
  /**
   * The 6-step script. Ordered — rendering walks the array top to bottom.
   * Times are fictional but correspond to realistic operator cadence
   * measured on past exercises (dense first 90 s for initial triage,
   * relaxed middle for diagnosis, tight close for recovery verification).
   */
  readonly steps: readonly TimelineStep[] = [
    {
      t: 'T+0 s',
      icon: '🔔',
      title: 'Alert fires — MiradorHighErrorRate',
      observation:
        'Prometheus evaluates mirador:http_error_ratio:5m every 30 s. At T+0 the ratio crosses 5 % and stays above for 5 minutes — the alert transitions from PENDING to FIRING in the Prometheus Alerts UI. Per ADR-0048 there is no Alertmanager routing (single-replica demo), so nothing pages — the operator sees it only on the dashboard or by checking Alerts manually.',
      action:
        'Open Prometheus Alerts tab (or the Grafana Alerting view). Click the firing alert. The annotation.summary surfaces on hover, the runbook_url is a one-click jump to docs/ops/runbooks/.',
      snippet: {
        label: 'mirador-alerts.yaml',
        code: `- alert: MiradorHighErrorRate
  expr: mirador:http_error_ratio:5m > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: 'Mirador 5xx error rate >5% for 5 min'
    runbook_url: docs/ops/runbooks/high-error-rate.md`,
      },
      links: [
        {
          label: 'ADR-0048 (why no pager)',
          url: 'https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/adr/0048-prometheus-alert-rules-evaluate-but-dont-route.md',
        },
      ],
    },
    {
      t: 'T+30 s',
      icon: '📊',
      title: 'Operator opens the RED dashboard',
      observation:
        'Grafana dashboard "Mirador RED" panel "Error rate by URI" shows the hot endpoint: /customers/{id}/bio is dominating the red bars. Other URIs are healthy. The break-down eliminates "everything is broken" theories immediately.',
      action:
        "Click an error-rate spike on the Grafana chart. ADR-0048's Phase 2 O1 wired exemplars, so the click surfaces a trace_id — clicking it jumps straight to the Tempo span for one failing request. The span tree shows the HTTP 503 came from BioService → OllamaClient.",
      links: [
        {
          label: 'Phase 2 O1 exemplars commit',
          url: 'https://gitlab.com/mirador1/mirador-service/-/commit/75c9049',
        },
      ],
    },
    {
      t: 'T+1 m',
      icon: '📖',
      title: 'Operator opens the runbook',
      observation:
        'The alert\'s annotation linked straight to docs/ops/runbooks/high-error-rate.md. Reading the ordered-by-frequency root causes, #2 on the list says: "Circuit breaker flip on a fast path — the Ollama circuit (BioService) opens and short-circuits to 5xx."',
      action:
        'Follow the runbook commands: `curl -s :8080/actuator/circuitbreakers | jq .` — the output confirms bioCircuit.state = OPEN.',
      snippet: {
        label: "operator's terminal",
        code: `$ curl -s http://localhost:8080/actuator/circuitbreakers | jq .
{
  "circuitBreakers": {
    "bioCircuit": {
      "state": "OPEN",
      "failureRate": "72.0%",
      "numberOfSuccessfulCalls": 3,
      "numberOfFailedCalls": 8
    }
  }
}`,
      },
    },
    {
      t: 'T+2 m',
      icon: '🔍',
      title: 'Find the upstream — Ollama is the bottleneck',
      observation:
        "Per the runbook's diagnostic commands: `docker logs mirador-ollama-1` shows repeated `model load timeout`. The LLM is taking >30 s per request; Resilience4j's 10-failure-in-rolling-window threshold is met and the circuit opens. Mirador's own logs show the fallback kicking in — the customer-facing response is \"Bio temporarily unavailable.\", not a 500.",
      action:
        'Check Pyroscope for an off-CPU profile during the spike. The frames show most time parked in OllamaClient.blockingCall — confirming "Mirador is healthy, upstream is slow" rather than "Mirador has a bug".',
    },
    {
      t: 'T+3 m',
      icon: '🛠️',
      title: 'Apply the fix',
      observation:
        'The runbook\'s "Fix that worked last time" section lists two options: (a) restart Ollama to evict the stuck model, (b) wait 30 s for the circuit to HALF_OPEN and test with one canary probe. Option (a) is destructive but fast — pick it.',
      action:
        '`docker restart mirador-ollama-1` — 15 s to pull model weights back into memory. Meanwhile the circuit stays OPEN; clients keep receiving the fallback string with no user-visible 5xx.',
    },
    {
      t: 'T+5 m',
      icon: '✅',
      title: 'Recovery confirmed',
      observation:
        'bioCircuit.state = HALF_OPEN at T+4 m (30 s after the last failure). One probe call succeeds → state transitions to CLOSED. mirador:http_error_ratio:5m drops below 5 % for 5 consecutive minutes; the alert transitions from FIRING back to INACTIVE.',
      action:
        'Write the post-mortem (no actual outage — the fallback meant zero user impact) noting Ollama took 90 s to recover. Suggest a Kubernetes livenessProbe on the Ollama pod as a follow-up so the circuit breaker + pod restart work together next time.',
    },
  ];
}
