import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

/**
 * Dialog anulowania rezerwacji z opcją podania powodu.
 */
interface CancelDialogPlaceholderProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function CancelDialogPlaceholder({ isOpen, onClose, onConfirm, isLoading }: CancelDialogPlaceholderProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    await onConfirm(reason || undefined);
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>Anuluj rezerwację</DialogTitle>
          </div>
          <DialogDescription>
            Czy na pewno chcesz anulować tę rezerwację? Ta operacja nie może być cofnięta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="cancel-reason">Powód anulowania (opcjonalnie)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Wpisz powód anulowania rezerwacji..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">Powód zostanie dodany do notatek rezerwacji.</p>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} disabled={isLoading} variant="outline">
            Anuluj
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} variant="destructive">
            {isLoading ? "Anulowanie..." : "Potwierdź anulowanie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
