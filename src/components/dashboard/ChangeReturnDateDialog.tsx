import { useEffect, useState } from "react";
import type { ReservationDto } from "@/types";
import { changeReturnDateFormSchema } from "@/lib/schemas/reservation.schema";
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

interface ChangeReturnDateDialogProps {
  reservation: ReservationDto | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (plannedCheckOut: string) => Promise<void>;
}

export function ChangeReturnDateDialog({
  reservation,
  isOpen,
  isLoading = false,
  onClose,
  onConfirm,
}: ChangeReturnDateDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservation || !isOpen) return;
    setValue(toWarsawDateTimeLocal(reservation.planned_check_out));
    setError(null);
  }, [reservation, isOpen]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    const parsed = changeReturnDateFormSchema.safeParse({ planned_check_out: value });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.planned_check_out?.[0] ?? "Nieprawidłowa data powrotu");
      return;
    }

    const iso = fromWarsawDateTimeLocal(parsed.data.planned_check_out);
    const earliest = reservation?.actual_check_in ?? reservation?.planned_check_in;
    if (earliest && Date.parse(iso) <= Date.parse(earliest)) {
      setError("Data powrotu musi być późniejsza niż przyjazd");
      return;
    }

    await onConfirm(iso);
  };

  const name = reservation
    ? reservation.first_name
      ? `${reservation.first_name} ${reservation.last_name}`
      : reservation.last_name
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zmień datę powrotu</DialogTitle>
          <DialogDescription>
            {name ? `Nowa planowana data wyjazdu dla ${name}.` : "Podaj nową planowaną datę wyjazdu."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="return-date">Data i godzina powrotu</Label>
          <Input
            id="return-date"
            type="datetime-local"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            disabled={isLoading}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            Anuluj
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={isLoading}>
            {isLoading ? "Zapisywanie..." : "Zapisz datę"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
