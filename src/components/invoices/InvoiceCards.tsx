import { MoreVertical, Printer, CalendarDays, Building2, Receipt } from "lucide-react";
import type { InvoiceDto } from "../../types";
import { formatCost } from "../../lib/utils/reservation.formatters";
import { formatInvoiceDate } from "../../lib/utils/invoice.formatters";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

export interface InvoiceCardsProps {
  /** Lista faktur do wyświetlenia */
  invoices: InvoiceDto[];
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Callback wywoływany przy kliknięciu w kartę */
  onCardClick?: (invoice: InvoiceDto) => void;
  /** Callback wywoływany przy wyborze akcji */
  onAction?: (action: "print" | "reservation", invoice: InvoiceDto) => void;
}

/**
 * Skeleton loader dla karty faktury
 */
function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

/**
 * Komponent widoku kart faktur dla urządzeń mobilnych
 */
export function InvoiceCards({ invoices, isLoading, onCardClick, onAction }: InvoiceCardsProps) {
  const handleAction = (action: "print" | "reservation", invoice: InvoiceDto, e: React.MouseEvent) => {
    e.stopPropagation(); // Zapobiegnij wywołaniu onCardClick
    if (onAction) {
      onAction(action, invoice);
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

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">Brak faktur do wyświetlenia</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <Card
          key={invoice.id}
          onClick={() => onCardClick?.(invoice)}
          className={cn(onCardClick && "cursor-pointer transition-colors hover:bg-muted/50")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="font-semibold text-base leading-none truncate">{invoice.invoice_number}</h3>
                <p className="text-xs text-muted-foreground">Wystawiono {formatInvoiceDate(invoice.created_at)}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{invoice.buyer_name}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4 shrink-0" />
                <span className="font-medium text-foreground">{formatCost(invoice.total_amount)}</span>
              </div>
              <span className="text-xs text-muted-foreground">NIP {invoice.buyer_nip}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
