import { test, expect } from "@playwright/test";

test.describe("unauthenticated access — Risk #5", () => {
  test("GET /ustawienia redirects to login", async ({ page }) => {
    await page.goto("/ustawienia");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
  });

  test("GET /faktury/nowy redirects to login", async ({ page }) => {
    await page.goto("/faktury/nowy");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /api/stats returns 401 without session", async ({ request }) => {
    const response = await request.get("/api/stats");
    expect(response.status()).toBe(401);
  });
});
