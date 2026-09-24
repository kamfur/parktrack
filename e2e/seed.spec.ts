import { test, expect } from "@playwright/test";

test("daily rate persists after save and reload — settings write path", async ({ page }) => {
  const uniqueRate = 50 + (Date.now() % 950);

  await page.goto("/ustawienia");
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.locator('astro-island[component-url*="SettingsForm"][client-render-time]').waitFor();

  const rateInput = page.getByRole("spinbutton", { name: "Stawka dobowa (PLN)" });
  const originalValue = await rateInput.inputValue();

  await rateInput.fill(String(uniqueRate));

  const dailyRatePatch = page.waitForResponse(
    (response) =>
      response.url().includes("/api/settings") &&
      response.url().includes("key=eq.daily_rate") &&
      response.request().method() === "PATCH" &&
      response.ok(),
  );

  await page.getByRole("button", { name: "Zapisz ustawienia" }).click();
  await dailyRatePatch;

  await page.reload();
  await page.locator('astro-island[component-url*="SettingsForm"][client-render-time]').waitFor();
  await expect(page.getByRole("spinbutton", { name: "Stawka dobowa (PLN)" })).toHaveValue(String(uniqueRate));

  const restorePatch = page.waitForResponse(
    (response) =>
      response.url().includes("key=eq.daily_rate") &&
      response.request().method() === "PATCH" &&
      response.ok(),
  );

  await page.getByRole("spinbutton", { name: "Stawka dobowa (PLN)" }).fill(originalValue);
  await page.getByRole("button", { name: "Zapisz ustawienia" }).click();
  await restorePatch;
});
