import { test, expect } from "@playwright/test";

/**
 * Optional smoke: set E2E_DRIVER_EMAIL + E2E_DRIVER_PASSWORD (app_metadata.role=driver).
 * Skips when unset so CI without driver credentials stays green.
 */
test.describe("driver role gates", () => {
  test.beforeEach(({}, testInfo) => {
    if (!process.env.E2E_DRIVER_EMAIL || !process.env.E2E_DRIVER_PASSWORD) {
      testInfo.skip(true, "E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD not set");
    }
  });

  test("login lands on /kierowca and staff APIs return 403", async ({ page, request }) => {
    const email = process.env.E2E_DRIVER_EMAIL;
    const password = process.env.E2E_DRIVER_PASSWORD;
    if (!email || !password) {
      return;
    }

    const login = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto("/");
    await expect(page).toHaveURL(/\/kierowca/);
    await expect(page.getByRole("heading", { name: "Kierowca" })).toBeVisible();

    const stats = await request.get("/api/stats");
    expect(stats.status()).toBe(403);

    const invoices = await request.get("/api/invoices");
    expect(invoices.status()).toBe(403);
  });
});
