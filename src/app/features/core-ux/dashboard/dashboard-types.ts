/**
 * dashboard-types.ts — types + constants used by `dashboard.component.ts`.
 *
 * Extracted 2026-04-22 under Phase B-6 (file-length hygiene). Same
 * pattern as the B-7 type-extracts on every other UI feature. The
 * topology data lives in a sibling `dashboard-topology-data.ts` file
 * (separate concern: pure data vs response shapes).
 */

/**
 * Service port/URL registry — single source of truth for all local service addresses.
 * Referenced by both the services panel and the topology graph so changing a port
 * only requires editing this one object.
 */
export const SVC = {
  sonarqube: { port: '9000', url: 'http://localhost:9000' },
  'maven-site': { port: '8084', url: 'http://localhost:8084' },
  compodoc: { port: '8086', url: 'http://localhost:8086' },
  gitlab: { port: '9081', url: 'http://localhost:9081' },
  cloudbeaver: { port: '8978', url: 'http://localhost:8978' },
  'kafka-ui': { port: '9080', url: 'http://localhost:9080' },
  redisinsight: { port: '5540', url: 'http://localhost:5540' },
  keycloak: { port: '9090', url: 'http://localhost:9090/admin' },
  lgtm: { port: '3000', url: 'http://localhost:3000/' },
  api: { port: '8080', url: 'http://localhost:8080' },
} as const;

/**
 * Minimal shape of the Spring Boot `/actuator/health` JSON response.
 * Only the fields used in the component are typed — the full response may contain more.
 */
export interface ActuatorHealth {
  /** Overall aggregate status: `'UP'`, `'DOWN'`, `'OUT_OF_SERVICE'`. */
  status?: string;
  /** Per-component health details keyed by component name (e.g., `db`, `redis`, `diskSpace`). */
  components?: Record<string, { status?: string }>;
}

/**
 * Aggregated quality snapshot fetched once on init from /actuator/quality.
 * Shows tests/coverage/bugs/sonar at-a-glance — links to the full /quality
 * page for detail. Not refreshed on auto-refresh cycles (quality data only
 * changes after a rebuild).
 *
 * Extracted to this file (instead of inline in dashboard.component.ts)
 * 2026-04-23 under Phase B-6b so the standalone DashboardQualitySummary
 * widget can reuse the type without duplicating it.
 */
export interface QualitySummary {
  testsTotal: number | null;
  testsPassed: boolean | null;
  coveragePct: number | null;
  bugsTotal: number | null;
  sonarRating: string | null;
  sonarUrl: string | null;
  /** False = the /actuator/quality endpoint returned no data (mvn verify not run yet). */
  available: boolean;
}

/**
 * Fields from a Docker Engine API container list item that the dashboard uses.
 * The full Docker API response contains many more fields that are ignored here.
 */
export interface DockerContainer {
  /** Array of container name strings, each prefixed with `/` (e.g., `['/postgres-demo']`). */
  Names?: string[];
  /** Human-readable status string (e.g., `'Up 3 hours'`, `'Exited (0) 2 hours ago'`). */
  Status?: string;
  /** Docker image name used to start the container. */
  Image?: string;
  /** Low-level container state: `'running'`, `'exited'`, `'paused'`, etc. */
  State?: string;
}
