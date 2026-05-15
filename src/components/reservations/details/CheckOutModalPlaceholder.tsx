import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Placeholder dla CheckOutModal - będzie zaimplementowany w osobnym zadaniu.
 * Ten komponent wyświetla informację o braku pełnej implementacji.
 */
interface CheckOutModalPlaceholderProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  onSuccess?: () => void;
}

export function CheckOutModalPlaceholder({ isOpen, onClose, reservationId, onSuccess }: CheckOutModalPlaceholderProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-out</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                CheckOutModal - W trakcie implementacji
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Ten modal będzie zaimplementowany w osobnym zadaniu. Będzie zawierał podsumowanie kosztów i opcję
                finalizacji płatności.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-2">Reservation ID: {reservationId}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline">
              Zamknij
            </Button>
            <Button
              onClick={() => {
                onSuccess?.();
                onClose();
              }}
            >
              Symuluj Check-out (placeholder)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
