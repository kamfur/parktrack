import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Eye, Edit, XCircle } from "lucide-react";
import type { ReservationDto, SortableColumn } from "../../types";
import {
  formatPhone,
  formatDateRange,
  formatCost,
  getStatusLabel,
  getStatusBadgeClasses,
} from "../../lib/utils/reservation.formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
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

export interface ReservationTableProps {
  /** Lista rezerwacji do wyświetlenia */
  reservations: ReservationDto[];
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Kolumna sortowania */
  sortBy: string;
  /** Kierunek sortowania */
  sortOrder: "asc" | "desc";
  /** Callback wywoływany przy zmianie sortowania */
  onSort: (column: SortableColumn) => void;
  /** Callback wywoływany przy kliknięciu w wiersz */
  onRowClick?: (reservation: ReservationDto) => void;
  /** Callback wywoływany przy wyborze akcji */
  onAction?: (action: "view" | "edit" | "cancel", reservation: ReservationDto) => void;
}

/**
 * Komponent nagłówka kolumny z sortowaniem
 */
function SortableHeader({
  column,
  label,
  sortBy,
  sortOrder,
  onSort,
}: {
  column: SortableColumn;
  label: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: SortableColumn) => void;
}) {
  const isActive = sortBy === column;

  return (
    <Button variant="ghost" onClick={() => onSort(column)} className="h-auto p-0 hover:bg-transparent font-semibold">
      {label}
      <span className="ml-2">
        {isActive ? (
          sortOrder === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </span>
    </Button>
  );
}

/**
 * Skeleton loader dla wiersza tabeli
 */
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8 rounded-md" />
      </TableCell>
    </TableRow>
  );
}

/**
 * Komponent tabeli rezerwacji dla desktopu
 */
export function ReservationTable({
  reservations,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  onAction,
}: ReservationTableProps) {
  // Handler dla kliknięcia w wiersz
  const handleRowClick = (reservation: ReservationDto) => {
    if (onRowClick) {
      onRowClick(reservation);
    }
  };

  // Handler dla akcji
  const handleAction = (action: "view" | "edit" | "cancel", reservation: ReservationDto, e: React.MouseEvent) => {
    e.stopPropagation(); // Zapobiegnij wywołaniu onRowClick
    if (onAction) {
      onAction(action, reservation);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader
                column="last_name"
                label="Nazwisko"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>
              <SortableHeader
                column="planned_check_in"
                label="Daty"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader column="status" label="Status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader column="total_cost" label="Koszt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead className="w-[50px]">
              <span className="sr-only">Akcje</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Skeleton loaders podczas ładowania
            <>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} />
              ))}
            </>
          ) : reservations.length === 0 ? (
            // Empty state
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <p className="text-muted-foreground">Brak rezerwacji do wyświetlenia</p>
              </TableCell>
            </TableRow>
          ) : (
            // Dane rezerwacji
            reservations.map((reservation) => (
              <TableRow
                key={reservation.id}
                onClick={() => handleRowClick(reservation)}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              >
                <TableCell className="font-medium">
                  {reservation.last_name}
                  {reservation.first_name && (
                    <span className="text-muted-foreground ml-1">{reservation.first_name}</span>
                  )}
                </TableCell>
                <TableCell>{formatPhone(reservation.phone)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDateRange(reservation.planned_check_in, reservation.planned_check_out)}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusBadgeClasses(reservation.status)}>
                    {getStatusLabel(reservation.status)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{formatCost(reservation.total_cost)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
