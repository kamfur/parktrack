import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FinancialSectionProps } from "@/types";

/**
 * Sekcja wyświetlająca informacje finansowe rezerwacji.
 */
export function FinancialSection({ totalCost, isPaid, paymentMethod, source }: FinancialSectionProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  };

  const getPaymentMethodLabel = (method: string | null): string | null => {
    if (!method) return null;
    const labels: Record<string, string> = {
      cash: "Gotówka",
      card: "Karta",
      transfer: "Przelew",
    };
    return labels[method] || method;
  };

  const getSourceLabel = (sourceValue: string): string => {
    const labels: Record<string, string> = {
      phone: "Telefon",
      walk_in: "Walk-in",
      api: "API",
    };
    return labels[sourceValue] || sourceValue;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finanse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Cost */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Całkowity koszt</p>
          <p className="text-3xl font-bold">{formatCurrency(totalCost)}</p>
        </div>

        {/* Payment Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Status płatności</p>
            <Badge variant={isPaid ? "default" : "secondary"}>{isPaid ? "Opłacone" : "Nieopłacone"}</Badge>
          </div>

          {/* Payment Method */}
          {isPaid && paymentMethod && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Forma płatności</p>
              <Badge variant="outline">{getPaymentMethodLabel(paymentMethod)}</Badge>
            </div>
          )}
        </div>

        {/* Source */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Źródło rezerwacji</p>
          <Badge variant="outline">{getSourceLabel(source)}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
