/**
 * E2E — customer create → list → delete round-trip.
 *
 * Exercises the longest real user path we ship:
 *   login → Customers page → POST /customers → list refreshes → DELETE.
 *
 * Why this spec (ADR-0033): this is the one flow where the full stack
 * is visible end-to-end — JWT from login, CORS from browser, Kafka
 * notification on create, SSE refresh on the list, soft-delete on
 * DELETE. None of the existing unit / integration layers assert the
 * **combination**. A visible fail here is the cheapest way to catch
 * e.g. a Flyway migration that breaks `select * from customer`.
 *
 * Hermetic: the random email suffix prevents collision with seeded
 * data and with previous runs. The spec also deletes what it creates,
 * so a re-run does not accumulate state.
 */
import { test, expect } from '@playwright/test';
import { waitForBackendReady } from './helpers/wait-for-backend';

test.describe('Customer CRUD @golden', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-flight 1 : wait for the backend's actuator/health (or fallback
    // to liveness) to return UP before doing ANY UI action. Without
    // this, the form posts to a backend whose Spring context is up but
    // whose datasource/Flyway/Kafka indicators haven't all reported UP
    // yet — POST /customers hangs server-side until the connection is
    // killed by the Playwright 10-s timeout, the toast `Created → ID
    // <n>` never renders. Step 2 of the e2e:kind 3-step plan, see
    // `helpers/wait-for-backend.ts` header for the full rationale.
    await waitForBackendReady(page);

    // Pre-flight 2 : dismiss the first-visitor onboarding tour BEFORE
    // Angular boots. TourService.maybeAutoStart() (app-shell.component
    // effect) fires on auth.isAuthenticated() becoming true — so the
    // tour-backdrop appears the moment the user lands on the dashboard
    // post-login. The backdrop intercepts pointer events on every link
    // in the layout, including the `Customers` nav link clicked at
    // line ~33 below. Without this seed, customer-crud fails with :
    //   `<div class="tour-backdrop"> ... subtree intercepts pointer events`
    // (pipeline #2479222264 e2e:kind evidence, 2026-04-25 wave 12).
    //
    // `addInitScript` runs in the new page context BEFORE the document
    // loads, so the localStorage value is set before Angular boots and
    // before the AppShell effect reads `tour.hasSeen()`. `page.evaluate`
    // after `goto` runs too late — the tour has already mounted by then.
    //
    // Value MUST be `'true'` literally — TourService#hasSeen() does
    // `=== 'true'` (strict string compare). `'1'` would silently fail.
    await page.addInitScript(() => {
      window.localStorage.setItem('mirador:tour:seen', 'true');
    });
  });

  test('creates a customer, sees it in the list, deletes it', async ({ page }) => {
    // ---- login ------------------------------------------------------
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    await expect(page.getByRole('link', { name: /Customers/ })).toBeVisible({
      timeout: 10_000,
    });

    // ---- navigate to Customers -------------------------------------
    await page.getByRole('link', { name: /Customers/ }).click();
    await expect(page).toHaveURL(/\/customers$/);

    // Unique identity per run — random enough to not collide with any
    // seeded data nor with a parallel worker (CI runs with workers: 1
    // but local dev can be parallel).
    const stamp = Date.now();
    const name = `E2E Alice ${stamp}`;
    const email = `e2e-alice-${stamp}@example.com`;

    // ---- create ----------------------------------------------------
    await page.getByPlaceholder(/ex: Alice Martin/).fill(name);
    await page.getByPlaceholder(/ex: alice@example.com/).fill(email);
    // Button label is "+ Create" (leading plus for affordance), flipping
    // to "Creating..." mid-flight. The regex tolerates either.
    await page.getByRole('button', { name: /(^|\s)Create(\s|$)/ }).click();

    // Post-POST success signal: the UI prints `Created → ID <n>:` once
    // the 201 round-trip returns. This is the tightest possible proof
    // that the full chain ran (form → JWT → CORS → POST → backend →
    // response → render) and is what the E2E actually guarantees.
    //
    // Timeout bumped from 10s → 25s (Step 3 of the e2e:kind 3-step plan,
    // 2026-04-25 wave 13). Worst-case timing measured from the backend :
    // KafkaCustomerEventPublisher#publishCreated blocks on
    // kafkaTemplate.send(...).get(SEND_TIMEOUT_SECONDS=5s, ...) under a
    // Resilience4j @Retry(name="kafkaPublish") = 3 attempts with 200/400ms
    // exponential backoff. Worst case in CI when Kafka is in rebootstrap
    // loop (KRaft single-node, broker registration incomplete — see
    // .gitlab-ci/test.yml line 281-285) :
    //   attempt1 (5s timeout) + 200ms + attempt2 (5s) + 400ms + attempt3
    //   (5s) + fallback (logs ERROR, returns silently, customer row was
    //   already persisted before publishCreated) ≈ 15.6 s
    // The HTTP 201 returns ONLY after the fallback runs, so the toast
    // can't render before t+~16s. Previous 10s timeout was structurally
    // doomed under the documented CI Kafka conditions. 25s adds 9s of
    // headroom for runner pressure (mvn JIT, Spring serialisation, etc).
    // If/when svc moves the Kafka publish to async (post-response) per
    // ADR-0044 evolution note, lower this back to 10s.
    await expect(page.getByText(/Created → ID \d+/)).toBeVisible({ timeout: 25_000 });

    // ---- list refresh ---------------------------------------------
    // The list is paginated 10/page and default-sorted by ID ascending,
    // so a freshly-inserted row ends up on the LAST page. Search by
    // email is the cheapest way to force it into the first page of
    // results, and it doubles as a verification that the search endpoint
    // also round-trips end-to-end.
    await page.getByPlaceholder(/Search name or email/).fill(email);
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });

    // ---- delete ----------------------------------------------------
    // Each <tr> is scoped by its email cell. Different UI iterations
    // rendered the row-scoped delete as a trash icon or "×" button —
    // we match either. `first()` guards against rare seed-data
    // collision if the same fixture email already exists.
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: /Delete|×/ }).first().click();

    // Optional confirm dialog — click its primary action if present.
    const confirm = page.getByRole('button', { name: /^Delete$|Confirm|Yes/ });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }

    // Re-apply the search filter to force a fresh GET /customers; the
    // row must be gone. `toHaveCount(0)` is more robust than a negated
    // `toBeVisible` when the DOM transitions through an empty-state.
    await page.getByPlaceholder(/Search name or email/).fill(email);
    await expect(page.getByText(email)).toHaveCount(0, { timeout: 10_000 });
  });
});
