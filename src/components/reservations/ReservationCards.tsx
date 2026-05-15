import { MoreVertical, Eye, Edit, XCircle, Phone, Calendar, DollarSign } from "lucide-react";
import type { ReservationDto } from "../../types";
import {
  formatPhone,
  formatDateRange,
  formatCost,
  formatFullName,
  getStatusLabel,
  getStatusBadgeClasses,
  getSourceLabel,
} from "../../lib/utils/reservation.formatters";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

export interface ReservationCardsProps {
  /** Lista rezerwacji do wyświetlenia */
  reservations: ReservationDto[];
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Callback wywoływany przy kliknięciu w kartę */
  onCardClick?: (reservation: ReservationDto) => void;
  /** Callback wywoływany przy wyborze akcji */
  onAction?: (action: "view" | "edit" | "cancel", reservation: ReservationDto) => void;
}

/**
 * Skeleton loader dla karty rezerwacji
 */
function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

/**
 * Komponent widoku kart rezerwacji dla urządzeń mobilnych
 */
export function ReservationCards({ reservations, isLoading, onCardClick, onAction }: ReservationCardsProps) {
  // Handler dla kliknięcia w kartę
  const handleCardClick = (reservation: ReservationDto) => {
    if (onCardClick) {
      onCardClick(reservation);
    }
  };

  // Handler dla akcji
  const handleAction = (action: "view" | "edit" | "cancel", reservation: ReservationDto, e: React.MouseEvent) => {
    e.stopPropagation(); // Zapobiegnij wywołaniu onCardClick
    if (onAction) {
      onAction(action, reservation);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">Brak rezerwacji do wyświetlenia</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => {
        const fullName = formatFullName(reservation.first_name, reservation.last_name);
        const formattedPhone = formatPhone(reservation.phone);
        const dateRange = formatDateRange(reservation.planned_check_in, reservation.planned_check_out);
        const cost = formatCost(reservation.total_cost);
        const statusLabel = getStatusLabel(reservation.status);
        const sourceLabel = getSourceLabel(reservation.source);

        return (
          <Card
            key={reservation.id}
            onClick={() => handleCardClick(reservation)}
            className={cn(onCardClick && "cursor-pointer transition-colors hover:bg-muted/50")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-none truncate">{fullName}</h3>
                  <Badge className={cn(getStatusBadgeClasses(reservation.status), "w-fit")}>{statusLabel}</Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Otwórz menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleAction("view", reservation, e)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Szczegóły
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleAction("edit", reservation, e)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edytuj
                    </DropdownMenuItem>
                    {reservation.status !== "cancelled" && reservation.status !== "completed" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleAction("cancel", reservation, e)}
                          className="text-destructive focus:text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Anuluj rezerwację
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {/* Telefon */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{formattedPhone}</span>
              </div>

              {/* Daty */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{dateRange}</span>
              </div>

              {/* Koszt */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-foreground">{cost}</span>
                </div>
                <span className="text-xs text-muted-foreground">{sourceLabel}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
