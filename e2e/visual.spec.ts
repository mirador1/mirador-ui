/**
 * E2E — visual regression snapshots.
 *
 * Why Playwright's built-in screenshots instead of Chromatic
 * (ROADMAP Tier-2 #8 mentioned Chromatic): ADR-0021's "cost-deferred
 * industrial patterns" rule excludes paid SaaS for this demo.
 * Playwright's `toHaveScreenshot()` ships free, commits baselines to
 * the repo, and catches the same class of "I refactored SCSS and the
 * dashboard layout is now misaligned" regressions.
 *
 * Maintenance model:
 *   - First run on a spec: no baseline → creates
 *     `e2e/visual.spec.ts-snapshots/*.png`. Commit these as the
 *     canonical baseline.
 *   - Subsequent runs: diff is computed; if it exceeds the tolerance
 *     (default 0.2%), the test fails with an attached diff image.
 *   - To accept a new baseline on purpose (intentional redesign):
 *     `npx playwright test --grep @visual --update-snapshots`.
 *
 * Tagged @visual so it can be run in isolation (`--grep @visual`) or
 * excluded from the fast golden path (default npm script already uses
 * `--grep @golden`, so visual specs don't accidentally block CI until
 * we're confident the baselines are stable).
 *
 * Known caveat — platform-specific baselines: Playwright names snapshots
 * `<name>-chromium-<platform>.png`, so macOS baselines don't apply on
 * Linux CI runners. First-iteration ships the macOS baselines committed
 * from a dev laptop; a future pass adds a CI opt-in that auto-regenerates
 * `-linux` baselines on first CI run and commits them via a separate MR.
 */
import { test, expect } from '@playwright/test';

// Tolerance per test: 0.2% of pixels differing is the quietest signal
// that still catches a real layout break; tightening further would
// flag anti-aliasing on the Mirador SVG logo between CI and local.
test.describe('Visual regression @visual', () => {
  test('login page layout', async ({ page }) => {
    await page.goto('/login');
    // Wait for the login card to render — SVG icons finish last.
    await expect(page.getByRole('heading', { name: /Sign in/ })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('login.png', {
      maxDiffPixelRatio: 0.002,
      fullPage: false,
    });
  });

  test('dashboard layout (authenticated)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    // Wait for the dashboard to render + health chips to flip to UP,
    // otherwise the screenshot catches the UNKNOWN placeholder.
    await expect(page.getByRole('link', { name: /Customers/ })).toBeVisible();
    await expect(page.getByText(/UP/i).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800); // let chart SVGs settle
    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixelRatio: 0.005, // dashboard has live counters — slightly looser
      fullPage: false,
    });
  });

  test('customers page empty search', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    await page.getByRole('link', { name: /Customers/ }).click();
    // Wait for the table to load at least one row (seeded data).
    await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('customers.png', {
      maxDiffPixelRatio: 0.002,
      fullPage: false,
    });
  });
});
