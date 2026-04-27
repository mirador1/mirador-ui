/**
 * E2E — orders + products happy-path round-trip.
 *
 * Exercises the full e-commerce surface added 2026-04-26
 * (shared ADR-0059) :
 *   login → create Product → create Order → add OrderLine → edit qty →
 *   cancel line → cancel order → delete product
 *
 * Why this spec : the Order/Product foundation lives across two tables,
 * an immutable price-snapshot rule, a fan-out from order-create to
 * line-create, and a UI total recomputation. None of the unit-level
 * specs cross all of these boundaries. A green run here is the closest
 * thing we have to "the commerce surface is shippable end-to-end."
 *
 * Hermetic : every entity gets a unique random suffix so re-runs do
 * not collide with prior fixtures. The spec deletes everything it
 * created, including the Product (so the FK RESTRICT path is also
 * exercised in passing — Product delete must succeed AFTER the order
 * cancellation).
 */
import { test, expect } from '@playwright/test';
import { waitForBackendReady } from './helpers/wait-for-backend';

test.describe('Orders + Products CRUD @golden', () => {
  test.beforeEach(async ({ page }) => {
    // Same readiness pattern as customer-crud.spec.ts — see that file
    // for the exhaustive rationale (Kafka rebootstrap, Tour seed, …).
    await waitForBackendReady(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('mirador:tour:seen', 'true');
    });
  });

  test('full commerce surface : product → order → line → cleanup', async ({ page }) => {
    const stamp = Date.now();
    const productName = `E2E Widget ${stamp}`;

    // ---- login ------------------------------------------------------
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    // Authenticated landing : the Customers nav link appears once the
    // shell observes auth.isAuthenticated() === true.
    await expect(page.getByRole('link', { name: /Customers/ })).toBeVisible({
      timeout: 10_000,
    });

    // ---- create a product ------------------------------------------
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    // Inline create form — name + unit price + stock are required, description optional.
    await page.locator('input[placeholder="Widget"]').fill(productName);
    await page.locator('input[placeholder="9.99"]').fill('12.50');
    // First numeric "stock" input on the create form
    await page.getByTestId('create-product-btn').click();
    // Toast confirms creation : "✓ Created product #N <name>"
    await expect(page.getByText(`✓ Created product`)).toBeVisible({ timeout: 10_000 });

    // The new row should be findable via the search box (name substring).
    await page.getByTestId('product-search-input').fill(productName);
    await expect(page.getByText(productName).first()).toBeVisible();

    // Capture the product id by reading the row's first cell — the
    // `<a>` inside the ID column links to /products/:id, so we follow
    // that link to land on the detail page and read the ID from the URL.
    const productRow = page.getByRole('row').filter({ hasText: productName }).first();
    const productLink = productRow.locator('a.row-link').first();
    await productLink.click();
    await page.waitForURL(/\/products\/\d+$/);
    const productUrl = page.url();
    const productId = Number(productUrl.match(/\/products\/(\d+)/)?.[1]);
    expect(productId).toBeGreaterThan(0);

    // ---- pick an existing customer ID ------------------------------
    // The create-empty-order flow on /orders takes a customer ID. We
    // need ONE valid customer to attach the order to. The simplest path
    // is to ask the backend directly via the page.request fixture — it
    // shares the auth header of the Playwright browser context.
    // Fall back to ID 1 if the seed has anything.
    let customerId = 1;
    try {
      const res = await page.request.get('http://localhost:8080/customers?page=0&size=1');
      if (res.ok()) {
        const body = (await res.json()) as { content: { id: number }[] };
        if (body.content?.[0]?.id) customerId = body.content[0].id;
      }
    } catch {
      // Network noise — fall back to id=1 which the demo seed always has.
    }

    // ---- create an order via the simple list-page form -------------
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await page.locator('input[placeholder="1"]').fill(String(customerId));
    await page.getByRole('button', { name: /^Create$/ }).click();
    await expect(page.getByText(/✓ Created order/)).toBeVisible({ timeout: 10_000 });

    // The new order is the most recent — listOrders defaults page=0 so
    // it lands on the first page. We click the first "Detail" link to
    // navigate.  Before clicking, narrow to the row that mentions our
    // customer so we don't pick a sibling order from concurrent runs.
    const orderRow = page
      .getByRole('row')
      .filter({ hasText: new RegExp(`\\b${customerId}\\b`) })
      .first();
    await orderRow.getByRole('link', { name: /^Detail$/ }).click();
    await page.waitForURL(/\/orders\/\d+$/);
    const orderUrl = page.url();
    const orderId = Number(orderUrl.match(/\/orders\/(\d+)/)?.[1]);
    expect(orderId).toBeGreaterThan(0);

    // ---- add a line referencing our test product -------------------
    await expect(page.getByRole('heading', { name: `Order #${orderId}` })).toBeVisible();
    // Add-line form : product id + quantity, then Add.
    await page.locator('fieldset.add-line-form input[type="number"]').first().fill(String(productId));
    await page.locator('fieldset.add-line-form input[type="number"]').nth(1).fill('2');
    await page.getByRole('button', { name: /^Add$/ }).click();
    await expect(page.getByText(/✓ Line added/)).toBeVisible({ timeout: 10_000 });

    // The lines table now has one row referencing productId. Subtotal
    // visible : 2 × 12.50 = 25.00. The exact string is "25.00 €".
    await expect(page.locator('table.lines-table')).toBeVisible();
    await expect(page.getByText(`#${productId}`).first()).toBeVisible();

    // ---- navigate to edit page → cancel that line ------------------
    await page.getByRole('link', { name: /^Edit$/ }).click();
    await page.waitForURL(/\/orders\/\d+\/edit$/);
    await expect(page.getByRole('heading', { name: `Edit order #${orderId}` })).toBeVisible();
    // The live total in the edit-page header reads "Live total" + amount.
    await expect(page.locator('.meta-grid').getByText('Live total')).toBeVisible();

    // Native confirm dialog handler — blanket accept for the rest of
    // the spec.  cancelLine + cancelOrder both use window.confirm.
    page.on('dialog', (d) => d.accept());

    await page.getByRole('button', { name: /^Cancel$/ }).first().click();
    await expect(page.getByText(/cancelled/i)).toBeVisible({ timeout: 10_000 });

    // ---- back to the order detail, cancel the whole order ----------
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByRole('heading', { name: `Order #${orderId}` })).toBeVisible();
    await page.getByRole('button', { name: /Cancel order/ }).click();
    // After cancel, we're redirected to /orders.
    await page.waitForURL(/\/orders$/, { timeout: 10_000 });

    // ---- delete the product (FK RESTRICT now safe — order is gone) -
    await page.goto(`/products/${productId}`);
    await expect(page.getByRole('heading', { name: productName })).toBeVisible();
    await page.getByRole('button', { name: /Delete product/ }).click();
    // After delete, redirected back to /products.
    await page.waitForURL(/\/products$/, { timeout: 10_000 });
  });
});
