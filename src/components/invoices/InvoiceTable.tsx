import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Printer, CalendarDays } from "lucide-react";
import type { InvoiceDto, InvoiceSortableColumn } from "../../types";
import { formatCost } from "../../lib/utils/reservation.formatters";
import { formatInvoiceDate } from "../../lib/utils/invoice.formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

export interface InvoiceTableProps {
  /** Lista faktur do wyświetlenia */
  invoices: InvoiceDto[];
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Kolumna sortowania */
  sortBy: InvoiceSortableColumn;
  /** Kierunek sortowania */
  sortOrder: "asc" | "desc";
  /** Callback wywoływany przy zmianie sortowania */
  onSort: (column: InvoiceSortableColumn) => void;
  /** Callback wywoływany przy kliknięciu w wiersz */
  onRowClick?: (invoice: InvoiceDto) => void;
  /** Callback wywoływany przy wyborze akcji */
  onAction?: (action: "print" | "reservation", invoice: InvoiceDto) => void;
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
  column: InvoiceSortableColumn;
  label: string;
  sortBy: InvoiceSortableColumn;
  sortOrder: "asc" | "desc";
  onSort: (column: InvoiceSortableColumn) => void;
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
        <Skeleton className="h-4 w-36" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
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
 * Komponent tabeli faktur dla desktopu
 */
export function InvoiceTable({
  invoices,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  onAction,
}: InvoiceTableProps) {
  const handleAction = (action: "print" | "reservation", invoice: InvoiceDto, e: React.MouseEvent) => {
    e.stopPropagation(); // Zapobiegnij wywołaniu onRowClick
    if (onAction) {
      onAction(action, invoice);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader
                column="invoice_number"
                label="Numer"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                column="created_at"
                label="Wystawiono"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                column="buyer_name"
                label="Nabywca"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>NIP</TableHead>
            <TableHead>
              <SortableHeader
                column="total_amount"
                label="Kwota"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="w-[50px]">
              <span className="sr-only">Akcje</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} />
              ))}
            </>
          ) : invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <p className="text-muted-foreground">Brak faktur do wyświetlenia</p>
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                onClick={() => onRowClick?.(invoice)}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              >
                <TableCell className="font-medium whitespace-nowrap">{invoice.invoice_number}</TableCell>
                <TableCell className="whitespace-nowrap">{formatInvoiceDate(invoice.created_at)}</TableCell>
                <TableCell>{invoice.buyer_name}</TableCell>
                <TableCell className="text-muted-foreground">{invoice.buyer_nip}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{formatCost(invoice.total_amount)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Otwórz menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => handleAction("print", invoice, e)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Podgląd / druk
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleAction("reservation", invoice, e)}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Rezerwacja
                      </DropdownMenuItem>
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
