/**
 * E2E helper — wait for the Spring Boot backend to be reachable + UP.
 *
 * Why this exists (Step 2 of the e2e:kind 3-step plan, see
 * `.gitlab-ci/test.yml` line 82 + `docs/audit/ui-ci-debt-status.md`):
 *
 * The UI loads in < 1 s once `npx serve` is up, but the backend's
 * Spring Boot context can take 8-30 s under runner CPU pressure (cold
 * Maven compile + Flyway migrations + Kafka producer probe). The
 * dashboard's first interaction (login button → POST /auth/local) was
 * racing past the backend's readiness window — the form posted to a
 * port that was open (Spring listening) but to an actuator that wasn't
 * yet UP, producing intermittent connection-refused / 503 / hung
 * requests visible as `customer-crud.spec` failing on the `Created →
 * ID <n>` toast that never renders.
 *
 * This helper blocks until `/actuator/health` (composite endpoint —
 * checks Postgres + Kafka + Redis + diskSpace + ping) returns a 200 +
 * `status: UP`. Falls back to `/actuator/health/liveness` after 25 s
 * if the composite stays DOWN — liveness only gates "process is up",
 * which is enough for Playwright to start exercising the UI even when
 * Kafka health indicator is stuck in rebootstrap loop (a known CI-only
 * issue documented in `.gitlab-ci/test.yml` wave 10).
 *
 * Use at the START of every `@golden` spec's `beforeEach`/first action
 * — the cost is < 100 ms on a warm backend, and saves the 10-s
 * Playwright timeout × 3 retries × N specs that the race produced.
 */
import type { Page, APIRequestContext } from '@playwright/test';

const COMPOSITE_HEALTH = '/actuator/health';
const LIVENESS_HEALTH = '/actuator/health/liveness';
const COMPOSITE_TIMEOUT_MS = 25_000;
const LIVENESS_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

/**
 * Resolve the backend base URL.
 *
 * Priority (highest first):
 *   1. `E2E_BASE_URL` env var override (CI sets `http://localhost:4200`
 *      where `npx serve` proxies / and Spring runs on the same host)
 *   2. The Playwright page's `baseURL` (from playwright.config.ts)
 *   3. Default `http://localhost:8080` (matches local `./run.sh app`)
 *
 * In CI the UI server (`npx serve` on :4200) does NOT proxy to the
 * backend — the backend listens directly on localhost:8080 in the same
 * job container (see `.gitlab-ci/test.yml`). So we hit :8080 directly,
 * NOT the page's :4200 baseURL. This is intentional : we want backend
 * readiness, not UI readiness.
 */
function resolveBackendUrl(page: Page): string {
  const envUrl = process.env['E2E_BACKEND_URL'];
  if (envUrl) return envUrl;
  return 'http://localhost:8080';
}

/**
 * Poll an actuator endpoint until it returns 200 OR the deadline expires.
 * Returns true on success, false on timeout — caller decides how to react.
 */
async function pollUntilReady(
  request: APIRequestContext,
  url: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await request.get(url, { timeout: 2_000 });
      if (response.ok()) {
        // Composite endpoint returns `{status: "UP", components: {...}}`
        // — accept any 2xx. Liveness returns `{status: "UP"}` only when
        // the JVM is alive, doesn't gate on dependencies (intentional).
        return true;
      }
    } catch {
      // Connection refused / timeout → keep polling. The `try/catch`
      // is intentional : actuator unreachable in the first 2-5 s of
      // boot is the EXPECTED state, not an error worth surfacing.
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Wait for the backend to be reachable. Tries `/actuator/health` first
 * (full composite), falls back to `/actuator/health/liveness` if the
 * composite stays DOWN past `COMPOSITE_TIMEOUT_MS` — see header for
 * the Kafka rebootstrap-loop rationale.
 *
 * Throws if BOTH endpoints are still unreachable after the combined
 * 55 s budget — the spec then fails with a clear "backend not ready"
 * message instead of the misleading "Created → ID never appeared"
 * symptom that shipped before this helper.
 */
export async function waitForBackendReady(page: Page): Promise<void> {
  const baseUrl = resolveBackendUrl(page);
  const request = page.request;

  // Phase 1 : try the composite endpoint. If UP, we're fully ready.
  const compositeReady = await pollUntilReady(
    request,
    `${baseUrl}${COMPOSITE_HEALTH}`,
    COMPOSITE_TIMEOUT_MS,
  );
  if (compositeReady) return;

  // Phase 2 : composite still DOWN — fall back to liveness so the spec
  // can at least start. If a downstream (Kafka) is genuinely broken,
  // the spec will fail later with a meaningful symptom (e.g. POST
  // /customers returning 503), which is more debuggable than a generic
  // timeout from this helper.
  const livenessReady = await pollUntilReady(
    request,
    `${baseUrl}${LIVENESS_HEALTH}`,
    LIVENESS_TIMEOUT_MS,
  );
  if (livenessReady) {
    // eslint-disable-next-line no-console
    console.warn(
      `[waitForBackendReady] composite ${COMPOSITE_HEALTH} stayed DOWN after ${COMPOSITE_TIMEOUT_MS}ms ; ` +
        `proceeding on ${LIVENESS_HEALTH}. Specs may still fail if a downstream is genuinely broken.`,
    );
    return;
  }

  // Both endpoints unreachable → fail fast with a clear message.
  throw new Error(
    `[waitForBackendReady] backend not reachable at ${baseUrl} : ` +
      `${COMPOSITE_HEALTH} unreachable for ${COMPOSITE_TIMEOUT_MS}ms AND ` +
      `${LIVENESS_HEALTH} unreachable for ${LIVENESS_TIMEOUT_MS}ms. ` +
      `Check the backend container logs (e2e-debug/backend-app.log artifact).`,
  );
}
