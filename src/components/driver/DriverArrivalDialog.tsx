import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReservationDto } from "@/types";
import {
  driverArrivalFormSchema,
  datetimeLocalToIso,
  isoToDatetimeLocal,
  type DriverArrivalFormData,
} from "@/lib/schemas/driver-form.schema";
import { driverDisplayName, isAgencyPaid } from "@/lib/driver/display";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { FlightDirectionInput } from "@/components/reservations/FlightDirectionInput";

interface DriverArrivalDialogProps {
  reservation: ReservationDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, body: Record<string, unknown>) => Promise<void>;
  isProcessing: boolean;
}

function normalizeFlightDirection(value: string | null | undefined): string {
  return value ?? "";
}

export function DriverArrivalDialog({
  reservation,
  open,
  onOpenChange,
  onSubmit,
  isProcessing,
}: DriverArrivalDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<DriverArrivalFormData>({
    resolver: zodResolver(driverArrivalFormSchema) as Resolver<DriverArrivalFormData>,
    defaultValues: {
      planned_check_out: "",
      flight_direction: "",
      passenger_count: null,
      parking_sector: "",
      license_plate: "",
      paid_at_arrival: false,
    },
  });

  useEffect(() => {
    if (!reservation || !open) return;
    form.reset({
      planned_check_out: isoToDatetimeLocal(reservation.planned_check_out),
      flight_direction: normalizeFlightDirection(reservation.flight_direction),
      passenger_count: reservation.passenger_count,
      parking_sector: reservation.parking_sector ?? "",
      license_plate: reservation.license_plate ?? "",
      paid_at_arrival: reservation.paid_at_arrival ?? false,
    });
    setSubmitError(null);
  }, [reservation, open, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!reservation) return;
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        ...(isAgencyPaid(reservation) ? {} : { paid_at_arrival: data.paid_at_arrival }),
        passenger_count: data.passenger_count ?? null,
        parking_sector: data.parking_sector?.trim() ? data.parking_sector.trim() : null,
        license_plate: data.license_plate?.trim() ? data.license_plate.trim().toUpperCase() : null,
        flight_direction: data.flight_direction?.trim() ? data.flight_direction.trim() : null,
      };
      const checkoutIso = datetimeLocalToIso(data.planned_check_out);
      if (checkoutIso) body.planned_check_out = checkoutIso;
      await onSubmit(reservation.id, body);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nie udało się potwierdzić przyjazdu");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Potwierdź przyjazd</DialogTitle>
          {reservation ? (
            <p className="text-sm text-muted-foreground">
              {driverDisplayName(reservation)}
              {reservation.license_plate ? ` · ${reservation.license_plate}` : ""}
            </p>
          ) : null}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="license_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numer rejestracyjny</FormLabel>
                  <FormControl>
                    <Input
                      className="min-h-11"
                      placeholder="np. WX 12345"
                      maxLength={15}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="planned_check_out"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Planowany wyjazd</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" className="min-h-11" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flight_direction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kierunek lotu</FormLabel>
                  <FlightDirectionInput
                    className="min-h-11"
                    placeholder="np. Londyn, LO 392"
                    maxLength={100}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passenger_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Liczba pasażerów</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      className="min-h-11"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parking_sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sektor</FormLabel>
                  <FormControl>
                    <Input className="min-h-11" placeholder="np. A12" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {reservation && isAgencyPaid(reservation) ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                Biuro podróży – opłacone. Nie pobieraj płatności od klienta.
              </p>
            ) : (
              <FormField
                control={form.control}
                name="paid_at_arrival"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="font-normal">Opłacono przy przyjeździe</FormLabel>
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
                Potwierdź przyjazd
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
