import { useState } from "react";
import type { ReservationCardProps } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Car, Clock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kompaktowa karta wyświetlająca kluczowe informacje o rezerwacji.
 * Zawiera dane klienta, status rezerwacji oraz przycisk akcji (Check-in lub Check-out).
 */
export function ReservationCard({ reservation, actionType, onAction, isLoading = false }: ReservationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mapowanie statusu na kolor border-left
  const statusColorClasses = {
    confirmed: "border-l-orange-500",
    in_progress: "border-l-blue-500",
    completed: "border-l-green-500",
    cancelled: "border-l-red-500",
    no_show: "border-l-gray-500",
  };

  // Walidacja przycisków
  const isCheckInDisabled =
    actionType === "check-in" &&
    (reservation.status !== "confirmed" || reservation.actual_check_in !== null || isProcessing || isLoading);

  const isCheckOutDisabled =
    actionType === "check-out" &&
    (reservation.status !== "in_progress" ||
      reservation.actual_check_in === null ||
      reservation.actual_check_out !== null ||
      isProcessing ||
      isLoading);

  const isButtonDisabled = actionType === "check-in" ? isCheckInDisabled : isCheckOutDisabled;

  // Formatowanie godziny
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  };

  // Wybór odpowiedniej godziny
  const displayTime =
    actionType === "check-in" ? formatTime(reservation.planned_check_in) : formatTime(reservation.planned_check_out);

  // Obsługa kliknięcia przycisku
  const handleAction = async () => {
    setIsProcessing(true);
    try {
      await onAction(reservation.id);
    } finally {
      setIsProcessing(false);
    }
  };

  // Pełne imię i nazwisko
  const fullName = reservation.first_name
    ? `${reservation.first_name} ${reservation.last_name}`
    : reservation.last_name;

  return (
    <Card
      className={cn("border-l-4 transition-shadow hover:shadow-md", statusColorClasses[reservation.status])}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Nazwa klienta */}
          <div>
            <h3 className="font-semibold text-lg">{fullName}</h3>
          </div>

          {/* Informacje podstawowe */}
          <div className="space-y-2 text-sm text-muted-foreground">
            {/* Telefon */}
            {reservation.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{reservation.phone}</span>
              </div>
            )}

            {/* Numer rejestracyjny */}
            {reservation.license_plate && (
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                <span className="font-mono">{reservation.license_plate}</span>
              </div>
            )}

            {/* Godzina */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{displayTime}</span>
            </div>

            {/* Dodatkowe informacje przy hover */}
            {isHovered && reservation.email && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Mail className="h-4 w-4" />
                <span className="text-xs">{reservation.email}</span>
              </div>
            )}

            {/* Notatki przy hover */}
            {isHovered && reservation.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs italic">{reservation.notes}</p>
              </div>
            )}
          </div>

          {/* Przycisk akcji */}
          <Button
            onClick={handleAction}
            disabled={isButtonDisabled}
            className="w-full"
            variant={actionType === "check-in" ? "default" : "outline"}
            aria-label={`${actionType === "check-in" ? "Zamelduj" : "Wymelduj"} ${fullName}`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin" aria-hidden="true">
                  ⏳
                </span>
                Przetwarzanie...
              </span>
            ) : actionType === "check-in" ? (
              "Check-in"
            ) : (
              "Check-out"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
