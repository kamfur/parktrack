/**
 * Risk: voice reservations (context/changes/voice-reservations, plan Phase 6) — a dictated phone
 * reservation must reach the database with the dictated surname, plate and dates, and must not be
 * savable until the voice-filled plate is confirmed (PoC: 27% of plates misheard).
 * Real: auth (storageState), modal UI, parser, form, POST /api/reservations, Supabase.
 * Faked: the STT engine only — PUBLIC_VOICE_FAKE swaps Soniox for window.__parktrackFakeVoice.
 * Modeled on e2e/seed.spec.ts.
 */
import { test, expect, type Page } from "@playwright/test";

const MONTHS_GENITIVE = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

const spoken = (d: Date) => `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;

/** Surnames must be letters only (fullReservationSchema), so the unique suffix is base-26 letters. */
function uniqueSurname(): string {
  let n = Date.now() * 100 + Math.floor(Math.random() * 100);
  let suffix = "";
  while (n > 0) {
    suffix += String.fromCharCode(97 + (n % 26));
    n = Math.floor(n / 26);
  }
  return `Dyktowany${suffix}`;
}

let createdId: string | null = null;

async function openNewReservationModal(page: Page) {
  await page.goto("/rezerwacje");
  await page.locator('astro-island[component-url*="AppProvider"][client-render-time]').waitFor();
  await page.locator('astro-island[component-url*="NewReservationButton"][client-render-time]').waitFor();
  await page.getByRole("button", { name: "Nowa rezerwacja" }).click();
  await expect(page.getByRole("dialog", { name: "Nowa rezerwacja" })).toBeVisible();
}

// Staff cannot DELETE reservations (no RLS delete policy) — cancel, like the dashboard does.
test.afterEach(async ({ page }) => {
  if (!createdId) return;
  const res = await page.request.patch(`/api/reservations?id=eq.${createdId}`, {
    data: { status: "cancelled", notes: "E2E voice-reservation cleanup" },
  });
  expect(res.ok()).toBeTruthy();
  createdId = null;
});

test("dictated reservation is saved with dictated fields only after the plate is confirmed", async ({ page }) => {
  const surname = uniqueSurname();
  const checkIn = daysFromNow(20);
  const checkOut = daysFromNow(27);

  // Scripted dictation, as Soniox would finalize it segment by segment.
  await page.addInitScript(
    (steps) => {
      (window as unknown as { __parktrackFakeVoice: unknown }).__parktrackFakeVoice = steps;
    },
    [
      { finalText: `Dobrze, to zapisuję: pan Tomasz ${surname}, `, partialText: "pan Tomasz", delayMs: 150 },
      {
        finalText: `przyjazd ${spoken(checkIn)} o 6 rano, powrót ${spoken(checkOut)} około 22:00. `,
        delayMs: 150,
      },
      { finalText: "Numer rejestracyjny: KR 7HX29. Parking odkryty.", delayMs: 150 },
    ]
  );

  // Staff opens the modal and starts dictating from quick mode.
  await openNewReservationModal(page);
  const dialog = page.getByRole("dialog", { name: "Nowa rezerwacja" });
  await dialog.getByRole("button", { name: "Dyktuj" }).click();

  // Fields fill from the dictation (quick mode switched to full).
  await expect(dialog.getByLabel("Nazwisko")).toHaveValue(surname);
  await expect(dialog.getByLabel("Imię")).toHaveValue("Tomasz");
  await expect(dialog.getByLabel("Numer rejestracyjny")).toHaveValue("KR7HX29");

  // A voice-filled plate blocks saving until it is read back and confirmed.
  // Wait for the availability check first — it also disables saving while in flight.
  await expect(dialog.getByText(/Pozostało \d+ woln/)).toBeVisible();
  const save = dialog.getByRole("button", { name: "Zapisz rezerwację" });
  await expect(dialog.getByRole("group", { name: "Potwierdzenie numeru rejestracyjnego" })).toBeVisible();
  await expect(save).toBeDisabled();
  await dialog.getByRole("button", { name: "Potwierdź rejestrację" }).click();
  await expect(save).toBeEnabled();

  // Save and check what actually reached the database.
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/reservations") && r.request().method() === "POST" && r.status() === 201
  );
  await save.click();
  const reservation = (await (await created).json()) as {
    id: string;
    last_name: string;
    first_name: string | null;
    license_plate: string | null;
    planned_check_in: string;
    planned_check_out: string;
  };
  createdId = reservation.id;

  const at = (day: Date, hours: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours).getTime();
  expect(reservation).toMatchObject({ last_name: surname, first_name: "Tomasz", license_plate: "KR7HX29" });
  expect(Date.parse(reservation.planned_check_in)).toBe(at(checkIn, 6));
  expect(Date.parse(reservation.planned_check_out)).toBe(at(checkOut, 22));
  await expect(dialog).toBeHidden();
});
