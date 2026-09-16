import { useState } from "react";
import type { ReservationCardProps } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Car, Clock, Mail, Plane, PlaneLanding } from "lucide-react";
import { cn } from "@/lib/utils";
import { flightDirectionLabel, isOverdue } from "@/lib/driver/display";
import { formatKtwHourList } from "@/lib/ktw/format-hours";

function formatWarsawDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Kompaktowa karta wyświetlająca kluczowe informacje o rezerwacji.
 * Zawiera dane klienta, status rezerwacji oraz przyciski akcji.
 */
export function ReservationCard({
  reservation,
  actionType,
  onAction,
  onCancel,
  onChangeReturnDate,
  isLoading = false,
}: ReservationCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const plannedAt = actionType === "check-in" ? reservation.planned_check_in : reservation.planned_check_out;
  const overdue = isOverdue(plannedAt);

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
  const canCancel =
    Boolean(onCancel) &&
    overdue &&
    reservation.status !== "cancelled" &&
    reservation.status !== "completed" &&
    !isProcessing;

  const fullName = reservation.first_name
    ? `${reservation.first_name} ${reservation.last_name}`
    : reservation.last_name;
  const directionLabel = actionType === "check-out" ? flightDirectionLabel(reservation.flight_direction) : null;
  const ktwHoursLabel = actionType === "check-out" ? formatKtwHourList(reservation.ktw_arrival_hours) : null;

  const handleAction = async () => {
    setIsProcessing(true);
    try {
      await onAction(reservation.id);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card
      className={cn(
        "border-l-4",
        overdue && "border-l-amber-500 bg-amber-50/50",
        !overdue && actionType === "check-in" && "border-l-emerald-500",
        !overdue && actionType === "check-out" && "border-l-rose-500"
      )}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-lg">{fullName}</h3>
            {overdue ? <Badge variant="secondary">{actionType === "check-in" ? "Zaległe" : "Opóźniony"}</Badge> : null}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            {reservation.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{reservation.phone}</span>
              </div>
            )}

            {reservation.license_plate && (
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                <span className="font-mono">{reservation.license_plate}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{formatWarsawDateTime(plannedAt)}</span>
            </div>

            {directionLabel ? (
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4" aria-hidden />
                <span>{directionLabel}</span>
              </div>
            ) : null}

            {ktwHoursLabel ? (
              <div className="flex items-center gap-2">
                <PlaneLanding className="h-4 w-4" aria-hidden />
                <span>{ktwHoursLabel}</span>
              </div>
            ) : null}

            {reservation.email ? (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="text-xs">{reservation.email}</span>
              </div>
            ) : null}

            {reservation.notes ? <p className="text-xs italic">{reservation.notes}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleAction}
              disabled={isButtonDisabled}
              className="w-full"
              variant={actionType === "check-in" ? "default" : "outline"}
              aria-label={`${actionType === "check-in" ? "Zamelduj" : "Wymelduj"} ${fullName}`}
            >
              {isProcessing ? "Przetwarzanie..." : actionType === "check-in" ? "Przyjęcie" : "Check-out"}
            </Button>
            {actionType === "check-in" && canCancel ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                disabled={isLoading}
                onClick={() => onCancel?.(reservation)}
              >
                Anuluj rezerwację
              </Button>
            ) : null}
            {actionType === "check-out" && onChangeReturnDate ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={isLoading || isProcessing}
                onClick={() => onChangeReturnDate(reservation)}
              >
                Zmień datę powrotu
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
