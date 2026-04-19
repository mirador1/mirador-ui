/**
 * E2E — 30-second teaser recording for the top-of-README hook.
 *
 * Tagged @teaser; tagged tests are excluded from `--grep @golden` so
 * this spec doesn't run in CI assertion suites. Driven by
 * `TEASER=1 bin/record-demo.sh` which produces `docs/media/teaser.gif`.
 *
 * Why a separate spec from `demo.spec.ts`: the full walkthrough is
 * ~80 s and produces a 12-MB GIF. A second-glance reader on the
 * README needs a 25-30 s preview that fits above the fold. The full
 * GIF lives below for the curious.
 *
 * Flow (target 25-30 s, ~7-9 MB at fps=8 + 1100 px):
 *   1. login (~3 s)
 *   2. customer create (~5 s)
 *   3. nav to dashboard, hover health chips (~5 s)
 *   4. nav to Grafana metrics drilldown (focused on http_server_requests_seconds_max) (~10 s)
 *   5. final shot of the running stack (~3 s)
 */
import { test } from '@playwright/test';

test.use({ video: 'on', viewport: { width: 1280, height: 720 } });
test.setTimeout(60_000);

const UI = 'http://localhost:4200';
const METRICS_DRILLDOWN =
  'http://localhost:3000/a/grafana-metricsdrilldown-app/drilldown' +
  '?from=now-15m&to=now&timezone=browser' +
  '&var-ds=prometheus&var-filters=service_name%7C%3D%7Cmirador' +
  '&metric=http_server_requests_seconds_max' +
  '&actionView=breakdown&var-groupby=%24__all&breakdownLayout=grid';

test.describe('Teaser recording for README @teaser', () => {
  test('30s preview: login → create → dashboard → Grafana metric', async ({ page }) => {
    // 1. Login (~3 s)
    await page.goto(`${UI}/login`);
    await page.waitForTimeout(400);
    await page.getByLabel('Username').clear();
    await page.getByLabel('Username').pressSequentially('admin', { delay: 60 });
    await page.getByLabel('Password').clear();
    await page.getByLabel('Password').pressSequentially('admin', { delay: 60 });
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // 2. Customer create (~5 s) — proves the full POST chain
    await page.getByRole('link', { name: /Customers/ }).click();
    await page.waitForTimeout(800);
    const stamp = Date.now();
    const email = `teaser-${stamp}@example.com`;
    await page.getByPlaceholder(/ex: Alice Martin/).pressSequentially(`Teaser ${stamp}`, { delay: 40 });
    await page.getByPlaceholder(/ex: alice@example.com/).pressSequentially(email, { delay: 40 });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /(^|\s)Create(\s|$)/ }).click();
    await page.waitForTimeout(2000); // toast + ID render

    // 3. Dashboard (~5 s) — health chips visible
    await page.getByRole('link', { name: /Dashboard/ }).click();
    await page.waitForTimeout(5000);

    // 4. Grafana metrics (~10 s) — the observability moment
    await page.goto(METRICS_DRILLDOWN, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10_000);

    // 5. Final still on the metric (~2 s) — graceful end frame
    await page.waitForTimeout(2000);
  });
});
