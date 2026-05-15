import React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DetailHeaderProps } from "@/types";

/**
 * Nagłówek widoku szczegółów rezerwacji.
 * Wyświetla imię i nazwisko klienta, status rezerwacji oraz przycisk zamknięcia.
 */
export function DetailHeader({ firstName, lastName, status, onClose }: DetailHeaderProps) {
  const fullName = firstName ? `${firstName} ${lastName}` : lastName;

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      confirmed: "Potwierdzona",
      in_progress: "W trakcie",
      completed: "Zakończona",
      cancelled: "Anulowana",
      no_show: "Niestawienie",
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      confirmed: "default",
      in_progress: "secondary",
      completed: "outline",
      cancelled: "destructive",
      no_show: "destructive",
    };
    return variants[status] || "default";
  };

  return (
    <div className="flex items-start justify-between border-b px-4 sm:px-6 py-3 sm:py-4 bg-background sticky top-0 z-10">
      <div className="flex-1 min-w-0 pr-4">
        <h1 className="text-xl sm:text-2xl font-semibold truncate">{fullName}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Badge variant={getStatusVariant(status)} className="text-xs sm:text-sm">
          {getStatusLabel(status)}
        </Badge>

        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-1"
          aria-label="Zamknij"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
