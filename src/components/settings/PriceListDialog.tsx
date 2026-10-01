import { useEffect, useState } from "react";
import type { PriceListDto, PriceListRates, SavePriceListCommand } from "@/types";
import { PARKING_TYPES, type ParkingType } from "@/lib/pricing/parking-type";
import { savePriceListSchema } from "@/lib/schemas/price-list.schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceListTable, type PriceListDraftRates } from "./PriceListTable";
import { MOBILE_FULLSCREEN_DIALOG } from "@/components/common/dialog-layout";
import { cn } from "@/lib/utils";

export type PriceListDialogState =
  | { mode: "create"; template: PriceListRates; validFrom: string }
  | { mode: "edit"; priceList: PriceListDto };

interface PriceListDialogProps {
  state: PriceListDialogState | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: SavePriceListCommand, id?: string) => Promise<void>;
}

function toDraft(rates: PriceListRates): PriceListDraftRates {
  return Object.fromEntries(
    PARKING_TYPES.map((type) => [
      type,
      {
        day_prices: rates[type].day_prices.map(String),
        extra_day_price: String(rates[type].extra_day_price),
      },
    ])
  ) as PriceListDraftRates;
}

function fromDraft(draft: PriceListDraftRates): Record<ParkingType, { day_prices: number[]; extra_day_price: number }> {
  const toNumber = (value: string) => (value.trim() === "" ? NaN : Number(value.replace(",", ".")));
  return Object.fromEntries(
    PARKING_TYPES.map((type) => [
      type,
      {
        day_prices: draft[type].day_prices.map(toNumber),
        extra_day_price: toNumber(draft[type].extra_day_price),
      },
    ])
  ) as Record<ParkingType, { day_prices: number[]; extra_day_price: number }>;
}

export function PriceListDialog({ state, isSaving, onOpenChange, onSave }: PriceListDialogProps) {
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [openEnded, setOpenEnded] = useState(true);
  const [rates, setRates] = useState<PriceListDraftRates | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!state) return;
    setErrors([]);
    if (state.mode === "edit") {
      setValidFrom(state.priceList.valid_from);
      setValidTo(state.priceList.valid_to ?? "");
      setOpenEnded(state.priceList.valid_to === null);
      setRates(toDraft(state.priceList.rates));
      return;
    }
    setValidFrom(state.validFrom);
    setValidTo("");
    setOpenEnded(true);
    setRates(toDraft(state.template));
  }, [state]);

  const handleCellChange = (type: ParkingType, column: number | "extra", value: string) => {
    setRates((current) => {
      if (!current) return current;
      const row = current[type];
      const nextRow =
        column === "extra"
          ? { ...row, extra_day_price: value }
          : { ...row, day_prices: row.day_prices.map((price, index) => (index === column - 1 ? value : price)) };
      return { ...current, [type]: nextRow };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rates) return;

    const parsed = savePriceListSchema.safeParse({
      valid_from: validFrom,
      valid_to: openEnded ? null : validTo,
      rates: fromDraft(rates),
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fieldMessages = Object.entries(flat.fieldErrors).flatMap(([field, messages]) =>
        field === "rates" ? ["Uzupełnij wszystkie ceny liczbami nieujemnymi"] : (messages ?? [])
      );
      setErrors([...new Set([...flat.formErrors, ...fieldMessages])]);
      return;
    }

    setErrors([]);
    try {
      await onSave(parsed.data, state?.mode === "edit" ? state.priceList.id : undefined);
      onOpenChange(false);
    } catch {
      // Toast already shown by the hook; keep the dialog open for correction.
    }
  };

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(MOBILE_FULLSCREEN_DIALOG, "max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl")}
      >
        <DialogHeader>
          <DialogTitle>{state?.mode === "edit" ? "Edytuj cennik" : "Nowy okres cennika"}</DialogTitle>
          <DialogDescription>
            Ceny łączne za pobyt od 1 do 14 dni oraz cena za każdą kolejną dobę powyżej 14 dni.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price-list-valid-from">Obowiązuje od</Label>
              <Input
                id="price-list-valid-from"
                type="date"
                className="w-44"
                value={validFrom}
                required
                disabled={isSaving}
                onChange={(event) => setValidFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-list-valid-to">Obowiązuje do</Label>
              <Input
                id="price-list-valid-to"
                type="date"
                className="w-44"
                value={openEnded ? "" : validTo}
                min={validFrom || undefined}
                required={!openEnded}
                disabled={isSaving || openEnded}
                onChange={(event) => setValidTo(event.target.value)}
              />
            </div>
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="price-list-open-ended"
                checked={openEnded}
                disabled={isSaving}
                onCheckedChange={(checked) => setOpenEnded(checked === true)}
              />
              <Label htmlFor="price-list-open-ended" className="font-normal">
                Bezterminowo
              </Label>
            </div>
          </div>

          {rates && <PriceListTable mode="edit" rates={rates} onChange={handleCellChange} disabled={isSaving} />}

          {errors.length > 0 && (
            <ul className="space-y-1 text-sm text-red-600" role="alert">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving || !rates}>
              {isSaving ? "Zapisywanie…" : "Zapisz cennik"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
