import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { ParkingType } from "@/types";
import { driverCreateReservationSchema } from "@/lib/schemas/driver.schema";
import { datetimeLocalToIso, isoToDatetimeLocal } from "@/lib/schemas/driver-form.schema";
import { PARKING_TYPES, PARKING_TYPE_LABELS } from "@/lib/pricing/parking-type";
import { useNewStayQuote } from "@/hooks/useCheckoutQuote";
import { PaymentQuote } from "@/components/driver/PaymentQuote";
import { FlightDirectionInput } from "@/components/reservations/FlightDirectionInput";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface DriverNewReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  isProcessing: boolean;
}

interface FormValues {
  lastName: string;
  firstName: string;
  phone: string;
  licensePlate: string;
  checkIn: string;
  checkOut: string;
  parkingType: ParkingType;
  flightDirection: string;
  notes: string;
}

function emptyForm(): FormValues {
  return {
    lastName: "",
    firstName: "",
    phone: "",
    licensePlate: "",
    checkIn: isoToDatetimeLocal(new Date().toISOString()),
    checkOut: "",
    parkingType: "open_air",
    flightDirection: "",
    notes: "",
  };
}

export function DriverNewReservationDialog({
  open,
  onOpenChange,
  onSubmit,
  isProcessing,
}: DriverNewReservationDialogProps) {
  const form = useForm<FormValues>({ defaultValues: emptyForm() });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    form.reset(emptyForm());
    setError(null);
  }, [open, form]);

  const checkInIso = datetimeLocalToIso(form.watch("checkIn")) ?? null;
  const checkOutIso = datetimeLocalToIso(form.watch("checkOut")) ?? null;
  const quote = useNewStayQuote(checkInIso, checkOutIso, form.watch("parkingType"));

  const handleSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const parsed = driverCreateReservationSchema.safeParse({
      last_name: values.lastName,
      first_name: values.firstName.trim() || undefined,
      phone: values.phone.replace(/\s/g, "") || undefined,
      license_plate: values.licensePlate.trim() ? values.licensePlate.trim().toUpperCase() : undefined,
      flight_direction: values.flightDirection.trim() || undefined,
      notes: values.notes.trim() || undefined,
      planned_check_in: checkInIso ?? "",
      planned_check_out: checkOutIso ?? "",
      parking_type: values.parkingType,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane");
      return;
    }

    try {
      await onSubmit(parsed.data);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się utworzyć rezerwacji");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nowa rezerwacja</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} onChange={() => setError(null)} className="space-y-4">
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazwisko *</FormLabel>
                  <FormControl>
                    <Input className="min-h-11" maxLength={100} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imię</FormLabel>
                  <FormControl>
                    <Input className="min-h-11" maxLength={100} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input type="tel" className="min-h-11" maxLength={20} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licensePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numer rejestracyjny</FormLabel>
                  <FormControl>
                    <Input
                      className="min-h-11"
                      placeholder="np. WX 12345"
                      maxLength={15}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="checkIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Przyjazd *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" className="min-h-11" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="checkOut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Powrót *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" className="min-h-11" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parkingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ miejsca</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="min-h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARKING_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {PARKING_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flightDirection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kierunek lotu</FormLabel>
                  <FlightDirectionInput
                    className="min-h-11"
                    placeholder="np. Londyn, LO 392"
                    maxLength={100}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notatki</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-20" maxLength={1000} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            {checkInIso && checkOutIso ? <PaymentQuote {...quote} /> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit" className="min-h-11" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Dodaj rezerwację
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
