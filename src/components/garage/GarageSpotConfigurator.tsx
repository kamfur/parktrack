import { useState } from "react";
import { Plus } from "lucide-react";
import { useGarageSpots } from "@/hooks/useGarageSpots";
import { GarageSpotDialog, type GarageSpotDialogState } from "./GarageSpotDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { GarageSpotFormData } from "@/lib/schemas/garage-spot.schema";

const SPOT_TYPE_LABEL: Record<string, string> = { garage: "Garaż", carport: "Wiata" };
const CAPACITY_LABEL: Record<string, string> = { single: "Pojedynczy", double: "Podwójny" };

export function GarageSpotConfigurator() {
  const { spots, isLoading, isSaving, createSpot, updateSpot, toggleAvailability } = useGarageSpots();
  const [dialogState, setDialogState] = useState<GarageSpotDialogState | null>(null);

  const handleSave = async (data: GarageSpotFormData, spotId?: string) => {
    if (spotId) {
      await updateSpot(spotId, data);
    } else {
      await createSpot(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Miejsca garażowe</h2>
        <Button type="button" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="mr-2 h-4 w-4" />
          Nowe miejsce
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Pojemność</TableHead>
              <TableHead>Dostępne</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Akcje</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : spots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Brak skonfigurowanych miejsc garażowych
                </TableCell>
              </TableRow>
            ) : (
              spots.map((spot) => (
                <TableRow key={spot.id}>
                  <TableCell className="font-medium">{spot.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{SPOT_TYPE_LABEL[spot.spot_type] ?? spot.spot_type}</Badge>
                  </TableCell>
                  <TableCell>{CAPACITY_LABEL[spot.capacity_label] ?? spot.capacity_label}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={spot.is_available}
                      disabled={isSaving}
                      onCheckedChange={() => void toggleAvailability(spot)}
                      aria-label={`Przełącz dostępność: ${spot.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialogState({ mode: "edit", spot })}
                    >
                      Edytuj
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GarageSpotDialog
        state={dialogState}
        isSaving={isSaving}
        onOpenChange={(open) => !open && setDialogState(null)}
        onSave={handleSave}
      />
    </div>
  );
}
