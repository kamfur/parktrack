import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { driverShiftFormSchema } from "@/lib/schemas/calendar.schema";
import { fromWarsawDateTimeLocal, toWarsawDateTimeLocal, warsawHourBounds } from "@/lib/calendar/warsaw-time";
import type { CalendarDriverDto, DriverShiftDto, DriverShiftFormData, DriverShiftWrite } from "@/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOBILE_FULLSCREEN_DIALOG } from "@/components/common/dialog-layout";

export type ShiftDialogState = { mode: "create"; dateKey: string } | { mode: "edit"; shift: DriverShiftDto };

interface ShiftDialogProps {
  state: ShiftDialogState | null;
  drivers: CalendarDriverDto[];
  isProcessing: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: DriverShiftWrite, shiftId?: string) => Promise<void>;
  onDelete?: (shiftId: string) => Promise<void>;
}

export function ShiftDialog({ state, drivers, isProcessing, onOpenChange, onSave, onDelete }: ShiftDialogProps) {
  const form = useForm<DriverShiftFormData>({
    resolver: zodResolver(driverShiftFormSchema) as Resolver<DriverShiftFormData>,
    defaultValues: { driver_user_id: "", starts_at: "", ends_at: "" },
  });

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      form.reset({
        driver_user_id: state.shift.driver_user_id,
        starts_at: toWarsawDateTimeLocal(state.shift.starts_at),
        ends_at: toWarsawDateTimeLocal(state.shift.ends_at),
      });
      return;
    }
    form.reset({
      driver_user_id: drivers[0]?.id ?? "",
      starts_at: toWarsawDateTimeLocal(warsawHourBounds(state.dateKey, 8).start),
      ends_at: toWarsawDateTimeLocal(warsawHourBounds(state.dateKey, 16).start),
    });
  }, [state, drivers, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSave(
      {
        driver_user_id: data.driver_user_id,
        starts_at: fromWarsawDateTimeLocal(data.starts_at),
        ends_at: fromWarsawDateTimeLocal(data.ends_at),
      },
      state?.mode === "edit" ? state.shift.id : undefined
    );
  });

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className={MOBILE_FULLSCREEN_DIALOG}>
        <DialogHeader>
          <DialogTitle>{state?.mode === "edit" ? "Edytuj zmianę" : "Nowa zmiana"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="driver_user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kierowca</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Wybierz kierowcę" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="starts_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Początek</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ends_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Koniec</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:justify-between">
              {state?.mode === "edit" && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isProcessing}
                  onClick={() => void onDelete(state.shift.id)}
                >
                  Usuń
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={isProcessing || drivers.length === 0}>
                  {isProcessing ? "Zapisywanie..." : "Zapisz"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
