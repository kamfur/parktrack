import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReservationDto } from "@/types";
import {
  driverDepartureFormSchema,
  datetimeLocalToIso,
  isoToDatetimeLocal,
  type DriverDepartureFormData,
} from "@/lib/schemas/driver-form.schema";
import { driverDisplayName, isAgencyPaid } from "@/lib/driver/display";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface DriverDepartureDialogProps {
  reservation: ReservationDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, body: Record<string, unknown>) => Promise<void>;
  isProcessing: boolean;
}

export function DriverDepartureDialog({
  reservation,
  open,
  onOpenChange,
  onSubmit,
  isProcessing,
}: DriverDepartureDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDateField, setShowDateField] = useState(false);
  const alreadyPaid = reservation?.is_paid ?? false;
  const agencyPaid = reservation ? isAgencyPaid(reservation) : false;

  const form = useForm<DriverDepartureFormData>({
    resolver: zodResolver(driverDepartureFormSchema) as Resolver<DriverDepartureFormData>,
    defaultValues: {
      notes: "",
      paid_at_departure: false,
      surcharge_amount: null,
      planned_check_out: "",
    },
  });

  useEffect(() => {
    if (!reservation || !open) return;
    form.reset({
      notes: reservation.notes ?? "",
      paid_at_departure: reservation.paid_at_departure ?? false,
      surcharge_amount: reservation.surcharge_amount,
      planned_check_out: isoToDatetimeLocal(reservation.planned_check_out),
    });
    setSubmitError(null);
    setShowDateField(false);
  }, [reservation, open, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!reservation) return;
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        notes: data.notes?.trim() ? data.notes.trim() : null,
        ...(agencyPaid ? {} : { surcharge_amount: data.surcharge_amount ?? null }),
      };
      if (!alreadyPaid) body.paid_at_departure = data.paid_at_departure;
      if (showDateField) {
        const checkoutIso = datetimeLocalToIso(data.planned_check_out);
        if (checkoutIso) body.planned_check_out = checkoutIso;
      }
      await onSubmit(reservation.id, body);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nie udało się zakończyć wyjazdu");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zakończ wyjazd</DialogTitle>
          {reservation ? (
            <p className="text-sm text-muted-foreground">
              {driverDisplayName(reservation)}
              {reservation.license_plate ? ` · ${reservation.license_plate}` : ""}
            </p>
          ) : null}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {showDateField ? (
              <FormField
                control={form.control}
                name="planned_check_out"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planowany / skorygowany wyjazd</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="min-h-11" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <Button type="button" variant="link" className="h-auto px-0" onClick={() => setShowDateField(true)}>
                Zmień datę wyjazdu
              </Button>
            )}
            {agencyPaid ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                Biuro podróży – opłacone. Nie pobieraj płatności ani dopłaty od klienta.
              </p>
            ) : null}
            {agencyPaid ? null : (
              <FormField
                control={form.control}
                name="surcharge_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dopłata (PLN)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="min-h-11"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notatki</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-24" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {alreadyPaid ? null : (
              <FormField
                control={form.control}
                name="paid_at_departure"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="font-normal">Opłacono przy wyjeździe</FormLabel>
                  </FormItem>
                )}
              />
            )}
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit" className="min-h-11" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Zakończ wyjazd
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
