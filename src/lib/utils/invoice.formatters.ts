/**
 * Formatuje datę wystawienia faktury
 * @param iso - data w formacie ISO
 * @returns Data w formacie DD.MM.YYYY
 */
export function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
