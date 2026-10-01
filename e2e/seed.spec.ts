import { test, expect } from "@playwright/test";

test("parking capacity persists after save and reload — settings write path", async ({ page }) => {
  const uniqueCapacity = 50 + (Date.now() % 950);

  await page.goto("/ustawienia");
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.locator('astro-island[component-url*="SettingsForm"][client-render-time]').waitFor();

  const capacityInput = page.getByRole("spinbutton", { name: "Pojemność parkingu (miejsc)" });
  const originalValue = await capacityInput.inputValue();

  await capacityInput.fill(String(uniqueCapacity));

  const capacityPatch = page.waitForResponse(
    (response) =>
      response.url().includes("/api/settings") &&
      response.url().includes("key=eq.total_parking_spots") &&
      response.request().method() === "PATCH" &&
      response.ok()
  );

  await page.getByRole("button", { name: "Zapisz ustawienia" }).click();
  await capacityPatch;

  await page.reload();
  await page.locator('astro-island[component-url*="SettingsForm"][client-render-time]').waitFor();
  await expect(page.getByRole("spinbutton", { name: "Pojemność parkingu (miejsc)" })).toHaveValue(
    String(uniqueCapacity)
  );

  const restorePatch = page.waitForResponse(
    (response) =>
      response.url().includes("key=eq.total_parking_spots") && response.request().method() === "PATCH" && response.ok()
  );

  await page.getByRole("spinbutton", { name: "Pojemność parkingu (miejsc)" }).fill(originalValue);
  await page.getByRole("button", { name: "Zapisz ustawienia" }).click();
  await restorePatch;
});
