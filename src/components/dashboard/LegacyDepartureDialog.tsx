import { useEffect, useState } from "react";
import { createLegacyDepartureSchema, type CreateLegacyDepartureCommand } from "@/lib/schemas/reservation.schema";
import { fromWarsawDateTimeLocal, toWarsawDateTimeLocal } from "@/lib/calendar/warsaw-time";
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
import { Textarea } from "@/components/ui/textarea";

interface LegacyDepartureDialogProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (command: CreateLegacyDepartureCommand) => Promise<void>;
}

const EMPTY_FORM = {
  lastName: "",
  firstName: "",
  phone: "",
  licensePlate: "",
  checkIn: "",
  checkOut: "",
  totalCost: "",
  notes: "",
};

/**
 * TYMCZASOWE (przejście na system): rejestracja samochodu, który stał na parkingu
 * przed wdrożeniem ParkTrack — trafia od razu na listę wyjazdów.
 */
export function LegacyDepartureDialog({ isOpen, isLoading = false, onClose, onConfirm }: LegacyDepartureDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_FORM, checkIn: toWarsawDateTimeLocal(new Date().toISOString()) });
    setError(null);
  }, [isOpen]);

  const update = (field: keyof typeof EMPTY_FORM) => (event: { target: { value: string } }) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setError(null);
  };

  const handleConfirm = async () => {
    if (!form.checkIn || !form.checkOut) {
      setError("Podaj datę przyjazdu i planowaną datę powrotu");
      return;
    }
    const cost = form.totalCost.trim() ? Number(form.totalCost.replace(",", ".")) : undefined;
    if (cost !== undefined && Number.isNaN(cost)) {
      setError("Nieprawidłowa kwota");
      return;
    }

    const parsed = createLegacyDepartureSchema.safeParse({
      last_name: form.lastName,
      first_name: form.firstName || undefined,
      phone: form.phone || undefined,
      license_plate: form.licensePlate || undefined,
      notes: form.notes || undefined,
      planned_check_in: fromWarsawDateTimeLocal(form.checkIn),
      planned_check_out: fromWarsawDateTimeLocal(form.checkOut),
      total_cost: cost,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane");
      return;
    }

    try {
      await onConfirm(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać wyjazdu");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj wyjazd (samochód już na parkingu)</DialogTitle>
          <DialogDescription>
            Tymczasowo, na czas przejścia na system: rezerwacja zostanie utworzona jako „na parkingu” i pojawi się na
            liście wyjazdów.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="legacy-last-name">Nazwisko *</Label>
            <Input id="legacy-last-name" value={form.lastName} onChange={update("lastName")} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legacy-first-name">Imię</Label>
            <Input id="legacy-first-name" value={form.firstName} onChange={update("firstName")} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legacy-plate">Numer rejestracyjny</Label>
            <Input id="legacy-plate" value={form.licensePlate} onChange={update("licensePlate")} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legacy-phone">Telefon</Label>
            <Input id="legacy-phone" type="tel" value={form.phone} onChange={update("phone")} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legacy-check-in">Data przyjazdu *</Label>
            <Input
              id="legacy-check-in"
              type="datetime-local"
              value={form.checkIn}
              onChange={update("checkIn")}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legacy-check-out">Planowany powrót *</Label>
            <Input
              id="legacy-check-out"
              type="datetime-local"
              value={form.checkOut}
              onChange={update("checkOut")}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legacy-cost">Kwota (zł)</Label>
            <Input
              id="legacy-cost"
              inputMode="decimal"
              placeholder="Puste = wylicz z cennika"
              value={form.totalCost}
              onChange={update("totalCost")}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legacy-notes">Notatki</Label>
            <Textarea id="legacy-notes" value={form.notes} onChange={update("notes")} disabled={isLoading} />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Anuluj
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={isLoading}>
            {isLoading ? "Zapisywanie..." : "Dodaj wyjazd"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
