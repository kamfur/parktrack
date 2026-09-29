import type { DepartureListItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  amountDue,
  driverDisplayName,
  flightDirectionLabel,
  formatDriverTime,
  garageSpotLabel,
  isAfterToday,
  isAgencyPaid,
  isNearCheckout,
  isOverdue,
} from "@/lib/driver/display";
import { formatKtwHourList } from "@/lib/ktw/format-hours";
import { formatCost } from "@/lib/utils/reservation.formatters";
import { Banknote, Car, Clock, Mail, Phone, PlaneLanding, Users, Warehouse } from "lucide-react";

interface DriverReservationRowProps {
  reservation: DepartureListItem;
  mode: "arrival" | "departure" | "occupancy";
  handled?: boolean;
  onOpen?: () => void;
  actionLabel?: string;
  disabled?: boolean;
}

export function DriverReservationRow({
  reservation,
  mode,
  handled = false,
  onOpen,
  actionLabel,
  disabled = false,
}: DriverReservationRowProps) {
  const planned = mode === "arrival" ? reservation.planned_check_in : reservation.planned_check_out;
  const actual =
    mode === "arrival" ? reservation.actual_check_in : mode === "departure" ? reservation.actual_check_out : null;
  const displayTime = handled && actual ? actual : planned;
  const overdue = !handled && mode !== "occupancy" && isOverdue(planned);
  const nearCheckout = !handled && mode === "departure" && isNearCheckout(reservation.planned_check_out);
  const tomorrow = !handled && mode !== "occupancy" && isAfterToday(planned);
  const direction = flightDirectionLabel(reservation.flight_direction);
  const ktwHoursLabel = mode === "departure" ? formatKtwHourList(reservation.ktw_arrival_hours) : null;
  const garageLabel = garageSpotLabel(reservation.parking_type, reservation.garage_spot_name);
  const due = !handled && mode !== "occupancy" ? amountDue(reservation) : null;

  return (
    <Card
      className={cn(
        "border-l-4",
        handled && "border-l-emerald-500 bg-emerald-50/50",
        overdue && "border-l-amber-500 bg-amber-50/60",
        nearCheckout && !overdue && "border-l-sky-500 bg-sky-50/60",
        !handled && !overdue && !nearCheckout && "border-l-muted-foreground/40"
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{driverDisplayName(reservation)}</h3>
            {handled ? <Badge variant="secondary">Obsłużone</Badge> : null}
            {overdue ? <Badge variant="secondary">Zaległe</Badge> : null}
            {nearCheckout ? <Badge variant="secondary">Odbiór wkrótce</Badge> : null}
            {tomorrow ? <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Jutro</Badge> : null}
            {isAgencyPaid(reservation) ? (
              <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Biuro podróży – opłacone</Badge>
            ) : null}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {due != null ? (
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                <span>Do zapłaty: {formatCost(due)}</span>
              </div>
            ) : null}
            {reservation.phone ? (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                <a href={`tel:${reservation.phone}`} className="underline-offset-2 hover:underline">
                  {reservation.phone}
                </a>
              </div>
            ) : null}
            {reservation.license_plate ? (
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 shrink-0" aria-hidden />
                <span className="font-mono">{reservation.license_plate}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                {handled && mode === "arrival" ? "Przyjęto " : null}
                {handled && mode === "departure" ? "Wydano " : null}
                {formatDriverTime(displayTime)}
              </span>
            </div>
            {reservation.passenger_count != null ? (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                <span>{reservation.passenger_count} os.</span>
              </div>
            ) : null}
            {direction || reservation.parking_sector ? (
              <p className="text-xs">
                {[direction, reservation.parking_sector ? `Sektor ${reservation.parking_sector}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {ktwHoursLabel ? (
              <div className="flex items-center gap-2">
                <PlaneLanding className="h-4 w-4 shrink-0" aria-hidden />
                <span>{ktwHoursLabel}</span>
              </div>
            ) : null}
            {garageLabel ? (
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 shrink-0" aria-hidden />
                <span>{garageLabel}</span>
              </div>
            ) : null}
            {reservation.email ? (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate text-xs">{reservation.email}</span>
              </div>
            ) : null}
            {reservation.notes ? <p className="whitespace-pre-line text-xs italic">{reservation.notes}</p> : null}
          </div>
        </div>
        {onOpen && actionLabel ? (
          <Button type="button" className="min-h-11 w-full shrink-0 sm:w-auto" onClick={onOpen} disabled={disabled}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
