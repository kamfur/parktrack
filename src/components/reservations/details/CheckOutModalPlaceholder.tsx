import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CheckOutModalPlaceholderProps {
  isOpen: boolean;
  onClose: () => void;
  isProcessing?: boolean;
  onConfirm: () => Promise<void>;
}

export function CheckOutModalPlaceholder({
  isOpen,
  onClose,
  isProcessing = false,
  onConfirm,
}: CheckOutModalPlaceholderProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-out</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Potwierdź wyjazd klienta. Status rezerwacji zmieni się na „zakończona”.
        </p>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="outline" disabled={isProcessing}>
            Anuluj
          </Button>
          <Button onClick={() => void onConfirm()} disabled={isProcessing}>
            {isProcessing ? "Zapisywanie..." : "Wymelduj"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
