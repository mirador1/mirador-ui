/**
 * E2E — local JWT login flow.
 *
 * Asserts the **user-visible login contract** described in ADR-0033:
 *   credentials → token → authenticated UI state visible.
 *
 * Why this spec exists (what earlier layers don't catch):
 *   - unit tests mock `ApiService.login()` and never hit the backend;
 *   - integration tests hit the controller but don't render Angular;
 *   - only a browser actually running the page proves the whole chain
 *     (form → HTTP → token storage → route guard → `authenticated` UI).
 *
 * Golden path only. Wrong-password / locked / 500 branches live in
 * `api.service.spec.ts` + backend integration tests (cheaper signal there).
 */
import { test, expect } from '@playwright/test';

test.describe('Login @golden', () => {
  test('admin / admin signs in and reaches the dashboard', async ({ page }) => {
    await page.goto('/login');

    // The local-dev form sits below an "or (local dev)" divider. We use
    // field labels rather than CSS selectors so the spec survives a
    // cosmetic refactor of the login SCSS.
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');

    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // Post-login the app navigates to `/` (dashboard). We assert via URL
    // + a landmark the dashboard owns ("Customers" link in the sidebar)
    // rather than a single brittle text match.
    await expect(page).toHaveURL(/\/?$/, { timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Customers/ })).toBeVisible();
  });
});
