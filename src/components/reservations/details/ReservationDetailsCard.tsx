import React from "react";
import { Calendar, Plane, Warehouse } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReservationDetailsCardProps } from "@/types";
import { format, differenceInDays } from "date-fns";
import { pl } from "date-fns/locale";

/**
 * Karta wyświetlająca szczegóły rezerwacji (daty, liczba dni, kierunek lotu).
 */
export function ReservationDetailsCard({
  plannedCheckIn,
  plannedCheckOut,
  flightDirection,
  garageSpotLabel,
}: ReservationDetailsCardProps) {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);

      // Validate date
      if (isNaN(date.getTime())) {
        return dateString;
      }

      return format(date, "d MMMM yyyy, HH:mm", { locale: pl });
    } catch {
      return dateString;
    }
  };

  const calculateDays = (): number => {
    try {
      const checkIn = new Date(plannedCheckIn);
      const checkOut = new Date(plannedCheckOut);

      // Validate dates
      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        return 0;
      }

      const days = differenceInDays(checkOut, checkIn);

      // Ensure we return a valid number
      if (isNaN(days) || days < 0) {
        return 0;
      }

      return days;
    } catch {
      return 0;
    }
  };

  const getFlightDirectionLabel = (): string | null => {
    if (!flightDirection) return null;
    if (flightDirection === "departure") return "Wylot";
    if (flightDirection === "arrival") return "Przylot";
    return flightDirection;
  };

  const days = calculateDays();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Szczegóły rezerwacji</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Check-in Date */}
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Przyjazd</p>
            <p className="font-medium">{formatDate(plannedCheckIn)}</p>
          </div>
        </div>

        {/* Check-out Date */}
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Wyjazd</p>
            <p className="font-medium">{formatDate(plannedCheckOut)}</p>
          </div>
        </div>

        {/* Duration */}
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">Liczba dni</p>
          <p className="text-2xl font-bold">{isNaN(days) ? 0 : days}</p>
        </div>

        {/* Flight Direction */}
        {flightDirection && (
          <div className="pt-2">
            <Badge variant="outline" className="gap-2">
              <Plane className="h-4 w-4" />
              {getFlightDirectionLabel()}
            </Badge>
          </div>
        )}

        {/* Garage / carport assignment */}
        {garageSpotLabel && (
          <div className="pt-2">
            <Badge variant="outline" className="gap-2">
              <Warehouse className="h-4 w-4" />
              {garageSpotLabel}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
