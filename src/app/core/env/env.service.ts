/**
 * EnvService — Multi-environment URL management.
 *
 * Manages the active backend environment (Local, Prod tunnel, …). All API
 * calls and deep-links in the UI resolve their target URL through this
 * service's computed signals so the same UI bundle works against both the
 * docker-compose stack (dev) and the GKE cluster reached through
 * `bin/pf-prod.sh` tunnels (per ADR-0025 in mirador-service).
 *
 * The selected environment is persisted in localStorage and restored on
 * reload. Signal-based, so every consumer recomputes automatically without
 * Zone.js (this project is zoneless Angular 21).
 */
import { Injectable, signal, computed } from '@angular/core';

/**
 * Descriptor for a backend deployment target.
 *
 * Every URL field is optional because not every environment exposes every
 * service (e.g. Unleash is cluster-only, Maven site is compose-only). The
 * EnvService's computed signals return `null` for unset fields, and the
 * components gate the corresponding buttons behind a null-check.
 */
export interface Environment {
  /** Human-readable environment name shown in the Settings page selector. */
  name: string;
  /** Base URL of the Spring Boot REST API (e.g., `http://localhost:8080`). */
  baseUrl: string;

  // Docs & quality — compose-only by design.

  /** Maven site static server (nginx port 8084 locally). Not deployed in the cluster. */
  mavenSiteUrl?: string;
  /** Compodoc Angular documentation server (nginx port 8085 locally). Compose-only. */
  compodocUrl?: string;
  /** SonarQube Community Edition (docker port 9000 locally). Compose-only. */
  sonarUrl?: string;

  // Runtime observability & auth — present in both envs, different ports.

  /** Grafana instance (LGTM container port 3000 in compose, tunnelled 13000 in prod). */
  grafanaUrl?: string;
  /** Keycloak admin console (port 9090 in compose, tunnelled 19091 in prod). */
  keycloakUrl?: string;
  /** Unleash feature-flag UI (tunnelled 14242 in prod; not in compose today). */
  unleashUrl?: string;
  /** Argo CD UI (tunnelled 18081 in prod; not in compose by design). */
  argocdUrl?: string;
  /**
   * Unleash front-end proxy (`unleash-proxy` Deployment in the `infra`
   * namespace of the K8s clusters). The browser calls this with a
   * pre-shared front-end token; the proxy handles the Unleash admin API
   * on the backend side. Per mirador-service ADR-0026, Spring Boot is not
   * on this path.
   */
  unleashProxyUrl?: string;
  /** Chaos Mesh dashboard (tunnelled 12333 in prod; not in compose — CRDs don't exist). */
  chaosMeshUrl?: string;
  /** Pyroscope continuous profiling (port 4040 in compose, tunnelled 14040 in prod). */
  pyroscopeUrl?: string;

  // Database admin — compose-only; prod uses CloudBeaver locally + port-forward to Postgres.

  /** CloudBeaver web SQL client (port 8978 in compose). Replaces pgAdmin. */
  cloudbeaverUrl?: string;

  /**
   * pgweb HTTP ↔ Postgres bridge. The Database page's SQL Explorer + health
   * checks call this directly (no BFF — see mirador-service ADR-0026).
   * Compose defines a `pgweb-local` container on 8081 pointing at db:5432.
   * Prod tunnel uses a second `pgweb-prod` container on 8082 pointing at
   * host.docker.internal:15432 (the port-forwarded cluster Postgres).
   * Start the prod one with `bin/pgweb-prod-up.sh` in mirador-service.
   */
  pgwebUrl?: string;

  // Messaging admin — compose-only.

  /** Kafka UI (port 9080 in compose). */
  kafkaUiUrl?: string;
  /** RedisInsight (port 5540 in compose). */
  redisInsightUrl?: string;
}

/**
 * Available backend environments.
 *
 * Three-env port policy (decided 2026-04-18): Local uses upstream defaults,
 * Kind adds `+10000`, Prod adds `+20000`. Each env has its own 5-digit
 * decade, so all three can coexist on the laptop simultaneously.
 *
 * Port map and rationale:
 * <https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/architecture/environments-and-flows.md>
 */
const ENVIRONMENTS: Environment[] = [
  {
    name: 'Local',
    baseUrl: 'http://localhost:8080',
    mavenSiteUrl: 'http://localhost:8084',
    compodocUrl: 'http://localhost:8085',
    sonarUrl: 'http://localhost:9000',
    grafanaUrl: 'http://localhost:3000',
    keycloakUrl: 'http://localhost:9090',
    pyroscopeUrl: 'http://localhost:4040',
    cloudbeaverUrl: 'http://localhost:8978',
    pgwebUrl: 'http://localhost:8081',
    kafkaUiUrl: 'http://localhost:9080',
    redisInsightUrl: 'http://localhost:5540',
    // Unleash / Argo CD / Chaos Mesh are cluster-only; undefined here.
  },
  {
    name: 'Kind',
    // Kind = local Kubernetes-in-Docker cluster. Tunnels opened by
    // `bin/pf-kind.sh --daemon` in the mirador-service checkout.
    baseUrl: 'http://localhost:18080',
    grafanaUrl: 'http://localhost:13000',
    keycloakUrl: 'http://localhost:19090',
    unleashUrl: 'http://localhost:14242',
    unleashProxyUrl: 'http://localhost:14243',
    argocdUrl: 'http://localhost:18081',
    chaosMeshUrl: 'http://localhost:12333',
    pyroscopeUrl: 'http://localhost:14040',
    // pgweb-kind container (compose profile `kind-tunnel`) on :8082,
    // connected through host.docker.internal:15432 to the kind Postgres.
    pgwebUrl: 'http://localhost:8082',
    // Maven site / Compodoc / Sonar / CloudBeaver / Kafka UI / RedisInsight
    // stay compose-only — not deployed inside kind for the demo.
  },
  {
    name: 'Prod tunnel',
    // GKE Autopilot cluster via `bin/pf-prod.sh --daemon`. +20000 offset so
    // it can coexist with Kind (+10000) and Compose (0) on the laptop.
    baseUrl: 'http://localhost:28080',
    grafanaUrl: 'http://localhost:23000',
    keycloakUrl: 'http://localhost:29090',
    unleashUrl: 'http://localhost:24242',
    unleashProxyUrl: 'http://localhost:24243',
    argocdUrl: 'http://localhost:28081',
    chaosMeshUrl: 'http://localhost:22333',
    pyroscopeUrl: 'http://localhost:24040',
    // pgweb-prod container (compose profile `prod-tunnel`) on :8083,
    // connected through host.docker.internal:25432 to the GKE Postgres.
    pgwebUrl: 'http://localhost:8083',
  },
];

@Injectable({ providedIn: 'root' })
export class EnvService {
  /** Immutable list of all configured environments, exposed for the Settings UI dropdown. */
  readonly environments = ENVIRONMENTS;

  /** Writable signal holding the currently active environment. Initialized from localStorage. */
  private readonly _current = signal<Environment>(this.restore() ?? ENVIRONMENTS[0]);

  /** Read-only signal for the active environment object. */
  readonly current = this._current.asReadonly();

  /** Backend base URL — always defined on every environment. */
  readonly baseUrl = computed(() => this._current().baseUrl);

  // Optional URLs exposed as `string | null` so templates can gate buttons with `@if (x())`.
  readonly mavenSiteUrl = computed(() => this._current().mavenSiteUrl ?? null);
  readonly compodocUrl = computed(() => this._current().compodocUrl ?? null);
  readonly sonarUrl = computed(() => this._current().sonarUrl ?? null);
  readonly grafanaUrl = computed(() => this._current().grafanaUrl ?? null);
  readonly keycloakUrl = computed(() => this._current().keycloakUrl ?? null);
  readonly unleashUrl = computed(() => this._current().unleashUrl ?? null);
  readonly argocdUrl = computed(() => this._current().argocdUrl ?? null);
  readonly unleashProxyUrl = computed(() => this._current().unleashProxyUrl ?? null);
  readonly chaosMeshUrl = computed(() => this._current().chaosMeshUrl ?? null);
  readonly pyroscopeUrl = computed(() => this._current().pyroscopeUrl ?? null);
  readonly cloudbeaverUrl = computed(() => this._current().cloudbeaverUrl ?? null);
  readonly pgwebUrl = computed(() => this._current().pgwebUrl ?? null);
  readonly kafkaUiUrl = computed(() => this._current().kafkaUiUrl ?? null);
  readonly redisInsightUrl = computed(() => this._current().redisInsightUrl ?? null);

  /**
   * Switch to a different backend environment.
   * Persists the selection to localStorage so it survives a page reload.
   */
  select(env: Environment): void {
    this._current.set(env);
    localStorage.setItem('env', JSON.stringify(env));
  }

  /**
   * Restore the previously selected environment from localStorage.
   * Matches by `name` so schema changes to `Environment` don't leave the
   * app stuck on a stale localStorage copy.
   */
  private restore(): Environment | null {
    const raw = localStorage.getItem('env');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Environment;
      return ENVIRONMENTS.find((e) => e.name === parsed.name) ?? null;
    } catch {
      return null;
    }
  }
}
