import { useState } from "react";
import type { GarageOccupancyEntryDto, GarageSpotDto } from "@/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOBILE_FULLSCREEN_DIALOG } from "@/components/common/dialog-layout";

interface GarageSwapDialogProps {
  entry: GarageOccupancyEntryDto | null;
  spots: GarageSpotDto[];
  isSwapping: boolean;
  onOpenChange: (open: boolean) => void;
  onSwap: (reservationId: string, garageSpotId: string, skipBuffer?: boolean) => Promise<void>;
}

export function GarageSwapDialog({ entry, spots, isSwapping, onOpenChange, onSwap }: GarageSwapDialogProps) {
  const [selectedSpotId, setSelectedSpotId] = useState<string>("");
  const [skipBuffer, setSkipBuffer] = useState(false);

  const otherSpots = spots.filter((spot) => spot.id !== entry?.garageSpotId);

  const handleSubmit = async () => {
    if (!entry || !selectedSpotId) return;
    await onSwap(entry.reservationId, selectedSpotId, skipBuffer);
    onOpenChange(false);
    setSelectedSpotId("");
    setSkipBuffer(false);
  };

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedSpotId("");
          setSkipBuffer(false);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className={MOBILE_FULLSCREEN_DIALOG}>
        <DialogHeader>
          <DialogTitle>Zamień przydział garażu</DialogTitle>
        </DialogHeader>
        {entry ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {entry.lastName} · obecnie: <span className="font-medium">{entry.garageSpotName}</span>
            </p>
            <Select value={selectedSpotId} onValueChange={setSelectedSpotId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wybierz nowe miejsce" />
              </SelectTrigger>
              <SelectContent>
                {otherSpots.map((spot) => (
                  <SelectItem key={spot.id} value={spot.id}>
                    {spot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="garage-swap-skip-buffer"
                checked={skipBuffer}
                onCheckedChange={(checked) => setSkipBuffer(checked === true)}
              />
              <Label htmlFor="garage-swap-skip-buffer" className="text-sm font-normal">
                Pomiń bufor 10h
              </Label>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSwapping}>
            Anuluj
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSwapping || !selectedSpotId}>
            {isSwapping ? "Zapisywanie..." : "Zamień"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
