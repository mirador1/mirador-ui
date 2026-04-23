/**
 * E2E — demo recording spec (v2).
 *
 * Purpose: produce the .webm recorded by `bin/record-demo.sh` for the
 * README's demo GIF. NOT part of the CI assertion suite (excluded via
 * the `@demo` tag in `--grep` inversion), because:
 *   - It deliberately takes ~45 s to give the viewer time to read.
 *   - It stops to "showcase" the UI (hover effects, small delays) that
 *     would slow down the golden-path specs for no test value.
 *
 * v2 flow (mirrors the recruiter's 3-minute narrated demo):
 *   login → customers create → chaos "Generate Traffic" → Grafana
 *   dashboard → Grafana Explore (trace → span → logs) → Kafka UI →
 *   Swagger UI → Actuator HAL → Grafana Pyroscope profiles →
 *   Redis Commander.
 *
 * Why each segment is in the GIF:
 *   - Customers create: proves the full UI→JWT→CORS→POST chain.
 *   - Chaos traffic:    gives the observability stack real data to show.
 *   - Grafana dashboard: "the request passes through" metric moment.
 *   - Trace → span → logs: the full drill-down narrative Mirador is about.
 *   - Kafka UI:         shows the messaging side (not just HTTP).
 *   - Swagger UI:       the API contract served by springdoc (ADR-0020
 *                       X-API-Version header visible on operations).
 *   - Actuator HAL:     live self-description of the service — the
 *                       management endpoints backing every health chip.
 *   - Pyroscope:        continuous profiling — CPU flame graph of the
 *                       Spring process while traffic is running.
 *   - Redis Commander:  the cache + idempotency-key + JWT-blacklist
 *                       store inspected live.
 *
 * If the UI evolves, update this spec FIRST (cheapest regeneration of
 * the GIF) and only re-run `bin/record-demo.sh` after merging.
 */
import { test } from '@playwright/test';

// Force video capture for this recording spec regardless of the global
// `video: 'retain-on-failure'` config — this spec exists precisely to
// produce the .webm that `bin/record-demo.sh` converts to a GIF.
// 1280x720 is a good balance: readable at 12 fps without ballooning GIF size.
test.use({ video: 'on', viewport: { width: 1280, height: 720 } });

// The v4 demo navigates cross-origin (Grafana :3000, Kafka UI :9080,
// Swagger, Actuator, Redis Commander) through 11 sidebar tabs +
// Drilldown + traces + logs — total ~120-140 s of dwells. Raise the
// per-test timeout to 3 min so the cumulative deliberate waits don't
// trip Playwright's default 30 s.
test.setTimeout(180_000);

const UI = 'http://localhost:4200';
const GRAFANA = 'http://localhost:3000';
const KAFKA_UI = 'http://localhost:9080';
const SWAGGER = 'http://localhost:8080/swagger-ui/index.html';
const ACTUATOR = 'http://localhost:8080/actuator';
// Grafana Drilldown apps — bundled in LGTM. Each URL includes
// `var-ds` + `var-filters=<label>|=|<value>` so the Drilldown opens
// on an actionable view (not the empty "select a datasource"
// landing) — user feedback: "les vues drilldown n'affichent rien".
// Format matches Grafana Scenes' URL sync.
const METRICS_DRILLDOWN =
  'http://localhost:3000/a/grafana-metricsdrilldown-app/trail?var-ds=prometheus' +
  '&var-filters=service_name%7C%3D%7Cmirador';
const TRACES_DRILLDOWN =
  'http://localhost:3000/a/grafana-exploretraces-app/explore?var-ds=tempo' +
  '&var-filters=resource.service.name%7C%3D%7Cmirador';
const LOGS_DRILLDOWN =
  'http://localhost:3000/a/grafana-lokiexplore-app/explore/service/mirador/logs';
const PYROSCOPE_EXPLORE = 'http://localhost:3000/a/grafana-pyroscope-app/explore';
const REDIS_COMMANDER = 'http://localhost:8082';

test.describe('Demo recording for README @demo', () => {
  test('full walkthrough: create → traffic → Grafana → trace → logs → Kafka', async ({ page }) => {
    // ═══════════════════════════════════════════════════════════════
    // 0. PRE-FLIGHT — dismiss the first-visitor tour overlay
    // ═══════════════════════════════════════════════════════════════
    // TourService.maybeAutoStart() fires the welcome tour on first
    // visit (localStorage 'mirador:tour:seen' missing). The tour's
    // backdrop intercepts pointer events on every link in the layout
    // — including the `Customers` nav link the demo clicks at step 3.
    // Use addInitScript (NOT page.evaluate after goto) so the flag is
    // set BEFORE Angular boots — page.evaluate after goto runs too
    // late, the tour is already mounted.
    await page.addInitScript(() => {
      window.localStorage.setItem('mirador:tour:seen', '1');
    });

    // ═══════════════════════════════════════════════════════════════
    // 1. LOGIN
    // ═══════════════════════════════════════════════════════════════
    await page.goto(`${UI}/login`);
    await page.waitForTimeout(700);

    await page.getByLabel('Username').clear();
    await page.getByLabel('Username').pressSequentially('admin', { delay: 70 });
    await page.getByLabel('Password').clear();
    await page.getByLabel('Password').pressSequentially('admin', { delay: 70 });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // Defensive : if the tour still fires despite the addInitScript
    // localStorage flag (e.g. some component re-triggers it on login),
    // dismiss it by pressing Escape (per TourOverlayComponent's onKey
    // handler : Escape → service.end()).
    await page.waitForTimeout(1500); // let post-login redirect settle
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    // ═══════════════════════════════════════════════════════════════
    // 2. SIDEBAR SWEEP — establish the scope of the UI
    // ═══════════════════════════════════════════════════════════════
    // Each tab visited with an explicit scrollIntoView + hover +
    // 2.5 s dwell so the viewer sees the page title land before the
    // next click. User feedback: 1.5 s was too short — the navigation
    // was invisible. Customers is intentionally last so the sweep
    // rolls naturally into section 3.
    const sidebarOrder: RegExp[] = [
      /Dashboard/,
      /Activity/,
      /Database/,
      /Diagnostic/,
      /Chaos/,
      /API Client|Request Builder/,
      /Settings/,
      /Security/,
      /Code Report|Quality/,
      /Pipelines/,
      /About/,
    ];
    for (const re of sidebarOrder) {
      // Scope to the `<nav>` element so we don't catch other links with
      // the same text elsewhere on the page (e.g. inline help / breadcrumbs).
      const navLink = page
        .locator('nav a.nav-link, nav a.nav-child')
        .filter({ hasText: re })
        .first();
      if (await navLink.isVisible().catch(() => false)) {
        await navLink.scrollIntoViewIfNeeded().catch(() => {});
        await navLink.hover().catch(() => {});
        await page.waitForTimeout(250); // hover-state flash
        await navLink.click();
        await page.waitForTimeout(2500); // dwell long enough to read page
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. CUSTOMER CREATE — the end-to-end POST chain
    // ═══════════════════════════════════════════════════════════════
    await page.getByRole('link', { name: /Customers/ }).click();
    await page.waitForTimeout(1000);

    const stamp = Date.now();
    const name = `Demo Customer ${stamp}`;
    const email = `demo-${stamp}@example.com`;

    await page.getByPlaceholder(/ex: Alice Martin/).clear();
    await page.getByPlaceholder(/ex: Alice Martin/).pressSequentially(name, { delay: 55 });
    await page.getByPlaceholder(/ex: alice@example.com/).clear();
    await page.getByPlaceholder(/ex: alice@example.com/).pressSequentially(email, { delay: 55 });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /(^|\s)Create(\s|$)/ }).click();
    await page.waitForTimeout(1800); // let "Created → ID N" toast render

    // ═══════════════════════════════════════════════════════════════
    // 4. CHAOS → GENERATE TRAFFIC (fills dashboards with real data)
    // ═══════════════════════════════════════════════════════════════
    await page.getByRole('link', { name: /Chaos/ }).click();
    await page.waitForTimeout(1200);

    // Each chaos action is a `.scenario-row` with a `.run-btn` button
    // (text "▶ Run"). Scope by row text so we click only the traffic
    // generator, not SQL stall / invalid payload flood / concurrent writes.
    const trafficRow = page.locator('.scenario-row').filter({
      hasText: /Generate Traffic/i,
    });
    await trafficRow.locator('.run-btn').first().click();
    // 6 s of live request bars — enough to produce visible metric + trace
    // activity in Grafana while keeping the GIF trim.
    await page.waitForTimeout(6000);

    // ═══════════════════════════════════════════════════════════════
    // 5. GRAFANA METRICS DRILLDOWN — "the request passes through"
    // ═══════════════════════════════════════════════════════════════
    // Drilldown is more predictable than a provisioned dashboard: it
    // auto-discovers every Prometheus metric and groups them by service,
    // so the viewer sees the request-rate / p99 panels even if the JSON
    // dashboard is absent or renamed in a future LGTM image bump
    // (user feedback: dashboards blurred past, drilldown is clearer).
    await page.goto(METRICS_DRILLDOWN, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10_000);

    // ═══════════════════════════════════════════════════════════════
    // 6. GRAFANA TRACES DRILLDOWN → trace → span → logs
    // ═══════════════════════════════════════════════════════════════
    // Traces Drilldown pre-filters by service automatically — more
    // predictable than crafting a TraceQL query URL that breaks when
    // Grafana's Explore pane schema changes (LGTM 0.22 → 0.25 moved
    // several keys).
    await page.goto(TRACES_DRILLDOWN, { waitUntil: 'domcontentloaded' });
    // 8 s so the traces list populates visibly.
    await page.waitForTimeout(8000);

    // Click the first trace-id link in the result table to open the
    // waterfall view. Trace IDs are 32 hex chars.
    const firstTrace = page.locator('a').filter({ hasText: /^[0-9a-f]{32}$/ }).first();
    if (await firstTrace.isVisible().catch(() => false)) {
      await firstTrace.click();
      // Waterfall unfolds — 5 s so the viewer can count the spans
      // and see which layers the trace passed through (Tomcat → JPA →
      // Kafka producer etc.).
      await page.waitForTimeout(5000);
      // Click the first span row so the detail panel (tags + logs button) appears.
      await page
        .locator('[data-testid^="span-"], .span-row, .TraceTimelineViewer .span')
        .first()
        .click({ trial: false })
        .catch(() => {
          /* layout varies across Grafana minor versions — don't hard fail */
        });
      // 4 s so the span-detail pane (attributes, events, process) is
      // legible — this is the core "span-level observability" moment.
      await page.waitForTimeout(4000);
      // "Logs for this span" button — Grafana adds it when Tempo dataset
      // has trace-to-logs mapping in datasources.yaml (we override it).
      const logsBtn = page.getByRole('button', { name: /Logs for this span|Related logs|Logs/ });
      if (await logsBtn.first().isVisible().catch(() => false)) {
        await logsBtn.first().click();
        // 5 s so the Loki logs panel renders + the viewer sees the
        // trace_id-correlated log lines — the PAYOFF of the drill-down.
        await page.waitForTimeout(5000);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6b. GRAFANA LOGS DRILLDOWN — standalone log exploration
    // ═══════════════════════════════════════════════════════════════
    // Separate from the trace→log correlation above: show the raw Loki
    // log volume by service, label filters, live log lines.
    await page.goto(LOGS_DRILLDOWN, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // ═══════════════════════════════════════════════════════════════
    // 7. KAFKA UI — the messaging side (customer.created topic)
    // ═══════════════════════════════════════════════════════════════
    await page.goto(`${KAFKA_UI}/ui/clusters/local/all-topics`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(4000); // topic list renders

    // Drill into the customer.created topic → messages tab so the
    // viewer sees actual events from the traffic burst above.
    const topicLink = page.getByRole('link', { name: /customer.created/ });
    if (await topicLink.isVisible().catch(() => false)) {
      await topicLink.click();
      await page.waitForTimeout(2500);
      const msgsTab = page.getByRole('tab', { name: /Messages/ }).or(
        page.getByRole('link', { name: /Messages/ }),
      );
      if (await msgsTab.first().isVisible().catch(() => false)) {
        await msgsTab.first().click();
        await page.waitForTimeout(3500);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. SWAGGER UI — the API contract (springdoc)
    // ═══════════════════════════════════════════════════════════════
    await page.goto(SWAGGER, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // spec loads

    // Expand the customer endpoints section so the viewer sees the
    // operations available (GET/POST/PUT/DELETE /customers + the
    // X-API-Version header selector from ADR-0020).
    const customersTag = page.locator('.opblock-tag').filter({ hasText: /customer/i }).first();
    if (await customersTag.isVisible().catch(() => false)) {
      await customersTag.click();
      await page.waitForTimeout(1500);
      // Expand the POST /customers operation so the schema renders visibly.
      const postOp = page.locator('.opblock-post').filter({ hasText: /\/customers/ }).first();
      if (await postOp.isVisible().catch(() => false)) {
        await postOp.click();
        await page.waitForTimeout(3000);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 9. ACTUATOR — self-description via HAL links
    // ═══════════════════════════════════════════════════════════════
    // The raw /actuator JSON is HAL-formatted; HAL Explorer renders it
    // interactively at /actuator/hal-explorer (Spring Boot Actuator's
    // built-in HATEOAS browser) — no extra dependency needed here.
    await page.goto(ACTUATOR, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    // ═══════════════════════════════════════════════════════════════
    // 10. PYROSCOPE — continuous profiling inside Grafana
    // ═══════════════════════════════════════════════════════════════
    // Pyroscope is bundled inside the LGTM container; Grafana ships a
    // Profiles UI under the grafana-pyroscope-app that surfaces live
    // CPU flame graphs of the Spring process (JFR → Pyroscope pipeline).
    await page.goto(PYROSCOPE_EXPLORE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500); // flame graph renders

    // ═══════════════════════════════════════════════════════════════
    // 11. REDIS COMMANDER — cache / idempotency / JWT blacklist
    // ═══════════════════════════════════════════════════════════════
    // Redis is used for: Bucket4j rate-limit counters (ADR-0019),
    // the idempotency-key store, and the JWT refresh-token blacklist
    // (ADR-0018). Redis Commander lets the viewer see live keys from
    // the traffic burst above.
    await page.goto(REDIS_COMMANDER, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000); // key browser renders
  });
});
