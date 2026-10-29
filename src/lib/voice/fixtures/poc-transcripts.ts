import type { ParkingType } from "@/lib/pricing/parking-type";
import type { VoiceDateTime } from "../types";

/**
 * Real Soniox `stt-rt-v5` output (context mode) from the PoC run on 2026-10-01
 * (scripts/soniox-poc, see context/changes/voice-reservations/research.md → "PoC results").
 * All personal data is fictional.
 *
 * `expected` is what a human would enter **reading this transcript**. Where Soniox misheard the
 * dictation, `sttError` records the spoken truth — those are STT limits, not parser bugs, and are
 * why plate confirmation exists.
 */
export interface PocFixture {
  id: string;
  transcript: string;
  expected: {
    lastName?: string;
    firstName?: string;
    phone?: string;
    email?: string;
    licensePlate?: string;
    plateFormatWarning?: boolean;
    checkIn?: VoiceDateTime;
    checkOut?: VoiceDateTime;
    parkingType?: ParkingType;
    flightDirection?: string;
  };
  sttError?: string;
}

/** Fixtures resolve dates relative to this day. */
export const POC_TODAY = "2026-10-01";

export const POC_FIXTURES: PocFixture[] = [
  {
    id: "s01-basic",
    transcript:
      "Dobrze, to zapisuję: pan Tomasz Wróblewski, przyjazd 12 października o 6 rano, powrót 19 października około 22:00. Numer rejestracyjny: KR 7HX29. Parking odkryty, 2 osoby.",
    expected: {
      lastName: "Wróblewski",
      firstName: "Tomasz",
      licensePlate: "KR7HX29",
      checkIn: { date: "2026-10-12", time: "06:00" },
      checkOut: { date: "2026-10-19", time: "22:00" },
      parkingType: "open_air",
    },
  },
  {
    id: "s02-phone-groups",
    transcript:
      "Pani Agnieszka Szczepańska, telefon 604 123 987, rejestracja SK4R27A. Od 3 listopada do 10 listopada, garaż, lot do Londynu, Stansted.",
    expected: {
      lastName: "Szczepańska",
      firstName: "Agnieszka",
      phone: "604123987",
      licensePlate: "SK4R27A",
      checkIn: { date: "2026-11-03", time: null },
      checkOut: { date: "2026-11-10", time: null },
      parkingType: "garage",
      flightDirection: "Londynu Stansted",
    },
  },
  {
    id: "s03-correction",
    transcript:
      "Marek Gregorczyk, przyjazd 15 października, nie, przepraszam, 17 października o 04:40. Powrót 24 października: numer SO12 345.",
    expected: {
      lastName: "Gregorczyk",
      firstName: "Marek",
      licensePlate: "SO12345",
      checkIn: { date: "2026-10-17", time: "04:40" },
      checkOut: { date: "2026-10-24", time: null },
    },
    sttError: "surname spoken as Grzegorczyk",
  },
  {
    id: "s04-phone-digits",
    transcript:
      "Paweł Kędzierski, telefon 501 223 445, samochód SKL 519C. Wiata 4 osoby, lot do Eindhoven, wylot 20 października.",
    expected: {
      lastName: "Kędzierski",
      firstName: "Paweł",
      phone: "501223445",
      licensePlate: "SKL519C",
      checkIn: { date: "2026-10-20", time: null },
      parkingType: "carport",
      flightDirection: "Eindhoven",
    },
  },
  {
    id: "s05-weekdays",
    transcript:
      "Bartłomiej Żurawski, w piątek 24 października wraca w niedzielę 2 listopada, rejestracja KK9CZ4, 3 osoby, Antalya.",
    expected: {
      lastName: "Żurawski",
      firstName: "Bartłomiej",
      licensePlate: "KK9CZ4",
      checkIn: { date: "2026-10-24", time: null },
      checkOut: { date: "2026-11-02", time: null },
    },
  },
  {
    id: "s06-email",
    transcript:
      "Anna Nowak. Mail: anna.nowak@gmail.com. Przyjazd 6 listopada, powrót 13 listopada, parking odkryty, rejestracja ST 577K.",
    expected: {
      lastName: "Nowak",
      firstName: "Anna",
      email: "anna.nowak@gmail.com",
      licensePlate: "ST577K",
      checkIn: { date: "2026-11-06", time: null },
      checkOut: { date: "2026-11-13", time: null },
      parkingType: "open_air",
    },
  },
  {
    id: "s07-foreign-name",
    transcript:
      "Nazwisko: Nguyen. Literuję: N-G-U-Y-E-N. Imię: Michn. Przyjazd jutro rano o 7:00, powrót za tydzień w środę. Numer DW: 23 7F.",
    expected: {
      lastName: "Nguyen",
      firstName: "Michn",
      licensePlate: "DW237F",
      checkIn: { date: "2026-10-02", time: "07:00" },
    },
    sttError: "first name spoken as Minh; 'za tydzień w środę' is out of scope",
  },
  {
    id: "s08-hours",
    transcript:
      "Kowalczyk, 14 listopada, godzina 05:15, powrót 21 listopada, o 23:40, przylot z Dortmundu. Numer rejestracyjny: KRK1234.",
    expected: {
      lastName: "Kowalczyk",
      licensePlate: "KRK1234",
      checkIn: { date: "2026-11-14", time: "05:15" },
      checkOut: { date: "2026-11-21", time: "23:40" },
      flightDirection: "Dortmundu",
    },
  },
  {
    id: "s09-double-surname",
    transcript: "Katarzyna Wiśniewska-Lis, telefon 790 12 34 56, rejestracja SK475W, od 8 do 15 listopada.",
    expected: {
      lastName: "Wiśniewska-Lis",
      firstName: "Katarzyna",
      phone: "790123456",
      licensePlate: "SK475W",
      checkIn: { date: "2026-11-08", time: null },
      checkOut: { date: "2026-11-15", time: null },
    },
    sttError: "plate spoken as SI475W",
  },
  {
    id: "s10-long-stay",
    transcript: "Jerzy Dąbrowski, od 1 grudnia do 6 stycznia garaż. Samochód numer KCH 07.",
    expected: {
      lastName: "Dąbrowski",
      firstName: "Jerzy",
      licensePlate: "KCH07",
      plateFormatWarning: true,
      checkIn: { date: "2026-12-01", time: null },
      checkOut: { date: "2027-01-06", time: null },
      parkingType: "garage",
    },
    sttError: "plate spoken as KCH007 (repeated zero collapsed)",
  },
  {
    id: "s11-family",
    transcript: "Zielińscy: 4 osoby, przyjazd 31 października; powrót 7 listopada. Numer SB-552R, parking odkryty.",
    expected: {
      lastName: "Zielińscy",
      licensePlate: "SB552R",
      checkIn: { date: "2026-10-31", time: null },
      checkOut: { date: "2026-11-07", time: null },
      parkingType: "open_air",
    },
  },
  {
    id: "s12-background-noise",
    transcript:
      "Piotr Lewandowski, telefon 512 300 45 678, przyjazd 9 listopada powrót 16 listopada, rejestracja SKR 661.",
    expected: {
      lastName: "Lewandowski",
      firstName: "Piotr",
      phone: "512345678",
      licensePlate: "SKR661",
      checkIn: { date: "2026-11-09", time: null },
      checkOut: { date: "2026-11-16", time: null },
    },
  },
  {
    id: "s13-year-digits",
    transcript: "Ewa Michalak, wylot do Barcelony. 28 października, powrót 3 listopada, rejestracja ST2025.",
    expected: {
      lastName: "Michalak",
      firstName: "Ewa",
      licensePlate: "ST2025",
      checkIn: { date: "2026-10-28", time: null },
      checkOut: { date: "2026-11-03", time: null },
      flightDirection: "Barcelony",
    },
  },
  {
    id: "s14-fillers",
    transcript:
      "To dobrze, pani Małgorzata Chrząszcz. Eee, przyjazd 4 listopada, powrót—moment, 11 listopada, numer SKM 7124.",
    expected: {
      lastName: "Chrząszcz",
      firstName: "Małgorzata",
      licensePlate: "SKM7124",
      checkIn: { date: "2026-11-04", time: null },
      checkOut: { date: "2026-11-11", time: null },
    },
    sttError: "plate spoken as SKM7142 (digits swapped)",
  },
  {
    id: "s15-change-type",
    transcript:
      "Robert Jankowski, pan tego listopada do 20 listopada, parking odkryty. A nie, jednak wiata. Rejestracja: PO 22KH.",
    expected: {
      lastName: "Jankowski",
      firstName: "Robert",
      licensePlate: "PO22KH",
      checkOut: { date: "2026-11-20", time: null },
      parkingType: "carport",
    },
    sttError: "dates spoken as 5–12 listopada; plate spoken as PO222KH",
  },
];
