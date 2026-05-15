import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Placeholder dla CheckInModal - będzie zaimplementowany w osobnym zadaniu.
 * Ten komponent wyświetla informację o braku pełnej implementacji.
 */
interface CheckInModalPlaceholderProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  onSuccess?: () => void;
}

export function CheckInModalPlaceholder({
  isOpen,
  onClose,
  reservationId,
  onSuccess,
}: CheckInModalPlaceholderProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                CheckInModal - W trakcie implementacji
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Ten modal będzie zaimplementowany w osobnym zadaniu. Będzie zawierał formularz check-in z opcją
                weryfikacji danych i oznaczenia płatności.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-2">
                Reservation ID: {reservationId}
              </p>
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
              Symuluj Check-in (placeholder)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

