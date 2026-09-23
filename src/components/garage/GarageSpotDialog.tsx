import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { garageSpotFormSchema, type GarageSpotFormData } from "@/lib/schemas/garage-spot.schema";
import type { GarageSpotDto } from "@/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type GarageSpotDialogState = { mode: "create" } | { mode: "edit"; spot: GarageSpotDto };

interface GarageSpotDialogProps {
  state: GarageSpotDialogState | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: GarageSpotFormData, spotId?: string) => Promise<void>;
}

export function GarageSpotDialog({ state, isSaving, onOpenChange, onSave }: GarageSpotDialogProps) {
  const form = useForm<GarageSpotFormData>({
    resolver: zodResolver(garageSpotFormSchema),
    defaultValues: { name: "", spot_type: "garage", capacity_label: "single", price_per_day: 0 },
  });

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      form.reset({
        name: state.spot.name,
        spot_type: state.spot.spot_type as GarageSpotFormData["spot_type"],
        capacity_label: state.spot.capacity_label as GarageSpotFormData["capacity_label"],
        price_per_day: state.spot.price_per_day,
      });
      return;
    }
    form.reset({ name: "", spot_type: "garage", capacity_label: "single", price_per_day: 0 });
  }, [state, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSave(data, state?.mode === "edit" ? state.spot.id : undefined);
    onOpenChange(false);
  });

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.mode === "edit" ? "Edytuj miejsce garażowe" : "Nowe miejsce garażowe"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazwa</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="np. Garaż 1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="spot_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="garage">Garaż</SelectItem>
                      <SelectItem value="carport">Wiata</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pojemność</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="single">Pojedynczy</SelectItem>
                      <SelectItem value="double">Podwójny</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price_per_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cena za dobę</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Anuluj
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
