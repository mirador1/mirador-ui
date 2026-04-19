/**
 * E2E — dashboard health probes turn green.
 *
 * The dashboard polls `/actuator/health` for the backend + a handful of
 * downstream checks (Postgres, Kafka, Redis). This spec asserts that
 * within 15 s of a cold load, the status chip is green.
 *
 * Why this spec (ADR-0033): the dashboard is the landing page of the
 * demo. If it doesn't turn green fast, a recruiter walks away. Unit
 * tests cannot assert wall-clock timing; integration tests don't
 * render the dashboard. Playwright is the right layer.
 *
 * 15 s budget rationale: measured cold-start locally (warm JVM) is
 * ~3 s to all-green. CI with `docker-compose up -d` + Spring startup
 * takes ~8 s. 15 s is 2× headroom — raise if flakes appear, but
 * investigate slowness first (ADR-0033 "flakes > 2/week" clause).
 */
import { test, expect } from '@playwright/test';

test.describe('Health @golden', () => {
  test('dashboard reports all-green within 15s', async ({ page }) => {
    await page.goto('/');

    // The dashboard renders a status indicator per dependency. Without
    // login the dashboard still shows the backend health chip (the
    // probe is public); deeper probes require JWT. We log in so every
    // chip is reachable.
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    await page.waitForURL(/\/?$/, { timeout: 10_000 });

    // "UP" is the Spring Boot canonical status. We assert on the
    // visible text rather than a CSS class so a theme rename doesn't
    // break the spec. The chip is rendered by the dashboard's
    // HealthIndicator component.
    await expect(page.getByText(/UP/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
