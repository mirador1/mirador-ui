/**
 * E2E — demo recording spec.
 *
 * Purpose: produce the .webm recorded by `bin/record-demo.sh` for the
 * README's demo GIF. NOT part of the CI assertion suite (excluded via
 * the `@demo` tag in `--grep` inversion), because:
 *   - It deliberately takes ~30 s to give the viewer time to read.
 *   - It stops to "showcase" the UI (hover effects, small delays) that
 *     would slow down the golden-path specs for no test value.
 *
 * The flow mirrors the recruiter's 3-minute demo script:
 *   login → customers → create → search → delete → dashboard → logout.
 *
 * If the UI evolves, update this spec FIRST (cheapest regeneration of
 * the GIF) and only re-run `bin/record-demo.sh` after merging.
 */
import { test } from '@playwright/test';

test.describe('Demo recording for README @demo', () => {
  test('login → customers → dashboard (~30s walkthrough)', async ({ page }) => {
    // ---- login -----------------------------------------------------
    await page.goto('/login');
    await page.waitForTimeout(800); // let the page settle (purely cosmetic)

    await page.getByLabel('Username').pressSequentially('admin', { delay: 70 });
    await page.getByLabel('Password').pressSequentially('admin', { delay: 70 });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // ---- customers -------------------------------------------------
    await page.getByRole('link', { name: /Customers/ }).click();
    await page.waitForTimeout(1000);

    const stamp = Date.now();
    const name = `Demo Customer ${stamp}`;
    const email = `demo-${stamp}@example.com`;

    await page.getByPlaceholder(/ex: Alice Martin/).pressSequentially(name, { delay: 60 });
    await page.getByPlaceholder(/ex: alice@example.com/).pressSequentially(email, { delay: 60 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /(^|\s)Create(\s|$)/ }).click();
    await page.waitForTimeout(1500); // let the toast render

    // Filter to show the new row on page 1 (like customer-crud spec).
    await page.getByPlaceholder(/Search name or email/).pressSequentially(email, { delay: 50 });
    await page.waitForTimeout(1500);

    // ---- dashboard -------------------------------------------------
    await page.getByRole('link', { name: /Dashboard/ }).click();
    await page.waitForTimeout(3000); // hover on the health chips

    // ---- logout ----------------------------------------------------
    await page.getByRole('button', { name: /Sign out/ }).click();
    await page.waitForTimeout(1500);
  });
});
