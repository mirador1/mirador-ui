import { expect, test } from '@playwright/test';

/**
 * Mobile-viewport smoke tests — added 2026-04-22 alongside the new
 * CLAUDE.md "UI must work on mobile" hard rule. Runs ONLY in the
 * `mobile-chromium` Playwright project (iPhone 12 Pro viewport =
 * 390 × 844). See `playwright.config.ts` → `projects[name=mobile-chromium]`.
 *
 * The check is intentionally shallow for now — layout doesn't
 * overflow horizontally, the app reaches interactive state, the
 * main heading is present. Per-route mobile specs (dashboard,
 * quality, customers) will land as part of the spawned mobile-audit
 * follow-up task; this file establishes the pattern + a floor.
 *
 * If this spec ever starts failing on main, something shipped
 * mobile-broken — root-cause before merging the next MR.
 */
test.describe('Mobile viewport smoke', () => {
    test('home page — no horizontal overflow, main heading visible', async ({ page }) => {
        // Sanity check — we MUST be running in a mobile viewport.
        // If the project config drifts back to desktop, this guards against
        // a silently-skipped mobile check.
        // page.viewportSize() returns the current viewport at runtime
        // (replaces the now-removed `viewportSize` test fixture per
        // Playwright's typed API).
        const vp = page.viewportSize();
        expect(vp?.width, 'mobile.spec.ts must run at mobile viewport').toBeLessThanOrEqual(500);

        await page.goto('/');

        // Wait for hydration / first meaningful paint.
        await page.waitForLoadState('networkidle');

        // No horizontal scrollbar means nothing is wider than the viewport.
        // `document.documentElement.scrollWidth` is the measured content
        // width; `clientWidth` is the visible width. Content ≤ visible
        // means no horizontal overflow.
        const overflow = await page.evaluate(() => {
            const el = document.documentElement;
            return { scroll: el.scrollWidth, client: el.clientWidth };
        });
        expect(
            overflow.scroll,
            `Horizontal overflow: scrollWidth=${overflow.scroll} > clientWidth=${overflow.client}. ` +
                'Some element is wider than the viewport — check recent SCSS changes for hardcoded px widths.',
        ).toBeLessThanOrEqual(overflow.client);

        // At least one h1 / h2 — proves the page rendered and is not a
        // blank-canvas regression.
        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible({ timeout: 5000 });
    });
});
