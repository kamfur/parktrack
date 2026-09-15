import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CheckInModalPlaceholderProps {
  isOpen: boolean;
  onClose: () => void;
  isProcessing?: boolean;
  onConfirm: () => Promise<void>;
}

export function CheckInModalPlaceholder({
  isOpen,
  onClose,
  isProcessing = false,
  onConfirm,
}: CheckInModalPlaceholderProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Potwierdź przyjazd klienta. Status rezerwacji zmieni się na „w trakcie”.
        </p>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="outline" disabled={isProcessing}>
            Anuluj
          </Button>
          <Button onClick={() => void onConfirm()} disabled={isProcessing}>
            {isProcessing ? "Zapisywanie..." : "Zamelduj"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
