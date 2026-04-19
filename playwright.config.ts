/**
 * Playwright E2E configuration for Mirador UI.
 *
 * Scope + placement rationale: `docs/adr/0033-playwright-e2e-in-kind-in-ci.md`
 * (in the mirador-service repo).
 *
 * Key choices:
 * - Chromium only for the first iteration. Firefox + WebKit added
 *   if we ever see browser-specific regressions (unlikely given
 *   Angular's zoneless setup is Chromium-first tested upstream).
 * - Retries: 2 on CI to absorb network flakes; 0 locally so the
 *   dev sees the real first-shot failure.
 * - baseURL points at http://localhost:4200 — `ng serve` or
 *   `http-server dist/mirador-ui` during the test run.
 * - No global setup / teardown here: each spec is expected to
 *   bring up its own state via the backend API.
 */

import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  // CI retries absorb runner flake (DNS hiccup, cold start).
  // Local = 0 so the first red is visible, not buried in a retry.
  retries: CI ? 2 : 0,
  // Single worker on CI — keeps logs readable + deterministic.
  workers: CI ? 1 : undefined,
  reporter: CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
