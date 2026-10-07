/**
 * Domain hints for Soniox real-time (the PoC showed they fix phone grouping and "wiata").
 * Kept in sync by hand with SONIOX_CONTEXT in scripts/soniox-poc/lib.mjs.
 */
export const SONIOX_CONTEXT = {
  general: [
    { key: "domain", value: "Rezerwacja parkingu przy lotnisku" },
    { key: "topic", value: "Pracownik parkingu powtarza na głos dane klienta podczas rozmowy telefonicznej" },
    { key: "setting", value: "Parking przy lotnisku Katowice-Pyrzowice (KTW)" },
  ],
  text:
    "Pracownik podaje nazwisko i imię klienta, numer rejestracyjny samochodu literowany po polsku " +
    "(np. es ka cztery er dwa siedem a = SK4R27A), numer telefonu, adres e-mail, datę i godzinę przyjazdu " +
    "oraz powrotu, liczbę osób, typ parkingu (parking odkryty, wiata, garaż) i kierunek lotu.",
  terms: ["Pyrzowice", "KTW", "wiata", "garaż", "parking odkryty", "numer rejestracyjny", "rejestracja", "dopłata"],
};

export const SONIOX_MODEL = "stt-rt-v5";
/** Default 2000 ms made finals lag ~5 s in the PoC; 500 is the SDK minimum. */
export const SONIOX_MAX_ENDPOINT_DELAY_MS = 500;
