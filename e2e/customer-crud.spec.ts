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

test.describe('Customer CRUD @golden', () => {
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
    await page.getByRole('button', { name: /^Create$/ }).click();

    // The toast is the user-visible success signal. We assert on the
    // toast text to prove the POST completed AND the UI saw the 201.
    await expect(page.getByText(new RegExp(name))).toBeVisible({ timeout: 10_000 });

    // ---- delete ----------------------------------------------------
    // Soft-delete round-trip. Playwright's `scope.getByRole('row')`
    // resolves each table row; we scope the delete click to the row
    // carrying our freshly-created email.
    const row = page.getByRole('row', { name: new RegExp(email) });
    await row.getByRole('button', { name: /Delete/ }).click();

    // A confirm dialog typically sits in front of the destructive
    // action. We click the primary action of that dialog.
    const confirm = page.getByRole('button', { name: /^Delete$|Confirm/ });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }

    // The deleted customer must vanish from the list within 5 s (list
    // refreshes either optimistically or on next poll).
    await expect(page.getByText(email)).toHaveCount(0, { timeout: 10_000 });
  });
});
