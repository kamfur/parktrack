import type { ReservationStatus, ReservationSource } from "../../types";

/**
 * Formatuje numer telefonu do czytelnej postaci
 * @param phone - numer telefonu lub null
 * @returns Sformatowany numer telefonu lub "—" jeśli null
 */
export function formatPhone(phone: string | null): string {
  if (!phone) {
    return "—";
  }

  // Usuń wszystkie znaki oprócz cyfr
  const cleaned = phone.replace(/\D/g, "");

  // Format: 123 456 789
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }

  // Format z kodem kraju: +48 123 456 789
  if (cleaned.length === 11 && cleaned.startsWith("48")) {
    return `+48 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }

  // Jeśli format nie pasuje, zwróć oryginalny
  return phone;
}

/**
 * Formatuje zakres dat do czytelnej postaci
 * @param from - data początkowa
 * @param to - data końcowa
 * @returns Sformatowany zakres dat, np. "10.11 → 17.11"
 */
export function formatDateRange(from: string | Date, to: string | Date): string {
  const fromDate = typeof from === "string" ? new Date(from) : from;
  const toDate = typeof to === "string" ? new Date(to) : to;

  // Format: DD.MM
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}.${month}`;
  };

  return `${formatDate(fromDate)} → ${formatDate(toDate)}`;
}

/**
 * Formatuje kwotę do postaci z walutą
 * @param cost - kwota w PLN
 * @returns Sformatowana kwota, np. "210,00 zł"
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost);
}

/**
 * Zwraca polską etykietę dla statusu rezerwacji
 * @param status - status rezerwacji
 * @returns Polska etykieta statusu
 */
export function getStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    confirmed: "Potwierdzona",
    in_progress: "W realizacji",
    completed: "Zakończona",
    cancelled: "Anulowana",
    no_show: "Nie pojawił się",
  };

  return labels[status] || status;
}

/**
 * Zwraca kolor Tailwind dla statusu rezerwacji
 * @param status - status rezerwacji
 * @returns Tailwind color class (np. "blue", "green")
 */
export function getStatusColor(status: ReservationStatus): string {
  const colors: Record<ReservationStatus, string> = {
    confirmed: "blue",
    in_progress: "green",
    completed: "gray",
    cancelled: "red",
    no_show: "orange",
  };

  return colors[status] || "gray";
}

/**
 * Zwraca pełną klasę badge dla statusu (z background i text color)
 * @param status - status rezerwacji
 * @returns Klasy Tailwind dla badge
 */
export function getStatusBadgeClasses(status: ReservationStatus): string {
  const baseClasses = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";

  const colorClasses: Record<ReservationStatus, string> = {
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    in_progress: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    no_show: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return `${baseClasses} ${colorClasses[status] || colorClasses.confirmed}`;
}

/**
 * Zwraca polską etykietę dla źródła rezerwacji
 * @param source - źródło rezerwacji
 * @returns Polska etykieta źródła
 */
export function getSourceLabel(source: ReservationSource): string {
  const labels: Record<ReservationSource, string> = {
    phone: "Telefon",
    walk_in: "Na miejscu",
    api: "API",
  };

  return labels[source] || source;
}

/**
 * Tworzy pełne imię i nazwisko z opcjonalnym imieniem
 * @param firstName - imię (może być null)
 * @param lastName - nazwisko
 * @returns Pełne imię lub samo nazwisko
 */
export function formatFullName(firstName: string | null, lastName: string): string {
  if (firstName) {
    return `${lastName} ${firstName}`;
  }
  return lastName;
}

/**
 * Formatuje datę do formatu ISO (YYYY-MM-DD) dla inputów
 * @param date - obiekt Date
 * @returns Data w formacie ISO
 */
export function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Sprawdza czy data jest dzisiaj
 * @param date - data do sprawdzenia
 * @returns true jeśli data jest dzisiaj
 */
export function isToday(date: string | Date): boolean {
  const checkDate = typeof date === "string" ? new Date(date) : date;
  const today = new Date();

  return (
    checkDate.getDate() === today.getDate() &&
    checkDate.getMonth() === today.getMonth() &&
    checkDate.getFullYear() === today.getFullYear()
  );
}

/**
 * Oblicza liczbę dni między datami
 * @param from - data początkowa
 * @param to - data końcowa
 * @returns Liczba dni
 */
export function getDaysBetween(from: string | Date, to: string | Date): number {
  const fromDate = typeof from === "string" ? new Date(from) : from;
  const toDate = typeof to === "string" ? new Date(to) : to;

  const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}
