import type { FullReservationFormData } from "@/types";
import type { VoiceFieldKey } from "./merge";
import type { ParsedVoiceFields, VoiceDateTime } from "./types";

type StaffFormField = keyof FullReservationFormData;

/** Voice field → staff form field (`fullReservationSchema` names). */
export const STAFF_FORM_FIELD: Record<VoiceFieldKey, StaffFormField> = {
  lastName: "lastName",
  firstName: "firstName",
  phone: "phone",
  email: "email",
  licensePlate: "licensePlate",
  checkIn: "checkInDate",
  checkOut: "checkOutDate",
  parkingType: "parkingType",
  flightDirection: "flightDirection",
};

/** Same display format as the form's own phone input: "xxx xxx xxx". */
export function formatPhoneDisplay(digits: string): string {
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`.trim();
}

/** Local Date for the staff DateTimePicker; keeps the field's current time when none was spoken. */
export function voiceDateToLocalDate(value: VoiceDateTime, current: Date | null | undefined): Date {
  const [y, m, d] = value.date.split("-").map(Number);
  const [hh, mm] = value.time
    ? value.time.split(":").map(Number)
    : [current?.getHours() ?? 0, current?.getMinutes() ?? 0];
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export interface StaffFormWrite {
  key: VoiceFieldKey;
  field: StaffFormField;
  value: FullReservationFormData[StaffFormField];
}

/** Converts planned voice updates into staff form `setValue` calls. */
export function toStaffFormWrites(
  updates: Partial<ParsedVoiceFields>,
  getCurrent: (field: "checkInDate" | "checkOutDate") => Date | null | undefined
): StaffFormWrite[] {
  const writes: StaffFormWrite[] = [];
  for (const key of Object.keys(updates) as VoiceFieldKey[]) {
    const update = updates[key];
    if (!update) continue;
    const field = STAFF_FORM_FIELD[key];
    let value: StaffFormWrite["value"];
    if (key === "checkIn" || key === "checkOut") {
      const formField = key === "checkIn" ? "checkInDate" : "checkOutDate";
      value = voiceDateToLocalDate(update.value as VoiceDateTime, getCurrent(formField));
    } else if (key === "phone") {
      value = formatPhoneDisplay(update.value as string);
    } else {
      value = update.value as StaffFormWrite["value"];
    }
    writes.push({ key, field, value });
  }
  return writes;
}
