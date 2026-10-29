import type { ParkingType } from "@/lib/pricing/parking-type";
import { formatPhoneDisplay } from "./apply-to-staff-form";
import type { VoiceFieldKey } from "./merge";
import type { ParsedVoiceFields, VoiceDateTime } from "./types";

/** String-valued fields of DriverNewReservationDialog (datetime-local strings for dates). */
export type DriverFormField =
  | "lastName"
  | "firstName"
  | "phone"
  | "licensePlate"
  | "checkIn"
  | "checkOut"
  | "parkingType"
  | "flightDirection";

/** Voice field → driver form field. The driver form has no email field. */
export const DRIVER_FORM_FIELD: Partial<Record<VoiceFieldKey, DriverFormField>> = {
  lastName: "lastName",
  firstName: "firstName",
  phone: "phone",
  licensePlate: "licensePlate",
  checkIn: "checkIn",
  checkOut: "checkOut",
  parkingType: "parkingType",
  flightDirection: "flightDirection",
};

/** "YYYY-MM-DDTHH:mm" (local); keeps the current time when none was spoken, else midnight. */
export function voiceDateToDatetimeLocal(value: VoiceDateTime, current: string | undefined): string {
  const currentTime = /T(\d{2}:\d{2})/.exec(current ?? "")?.[1];
  return `${value.date}T${value.time ?? currentTime ?? "00:00"}`;
}

export interface DriverFormWrite {
  key: VoiceFieldKey;
  field: DriverFormField;
  value: string | ParkingType;
}

/** Converts planned voice updates into driver form `setValue` calls. */
export function toDriverFormWrites(
  updates: Partial<ParsedVoiceFields>,
  getCurrent: (field: "checkIn" | "checkOut") => string | undefined
): DriverFormWrite[] {
  const writes: DriverFormWrite[] = [];
  for (const key of Object.keys(updates) as VoiceFieldKey[]) {
    const update = updates[key];
    const field = DRIVER_FORM_FIELD[key];
    if (!update || !field) continue;
    let value: DriverFormWrite["value"];
    if (field === "checkIn" || field === "checkOut") {
      value = voiceDateToDatetimeLocal(update.value as VoiceDateTime, getCurrent(field));
    } else if (field === "phone") {
      value = formatPhoneDisplay(update.value as string);
    } else {
      value = update.value as string;
    }
    writes.push({ key, field, value });
  }
  return writes;
}
