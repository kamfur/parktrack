import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { CreateLegacyDepartureCommand } from "@/lib/schemas/reservation.schema";
import { createLegacyDepartureSchema } from "@/lib/schemas/reservation.schema";
import { fromWarsawDateTimeLocal } from "@/lib/calendar/warsaw-time";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FlightDirectionInput } from "@/components/reservations/FlightDirectionInput";

interface LegacyDepartureDialogProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (command: CreateLegacyDepartureCommand) => Promise<void>;
}

interface LegacyDepartureFormValues {
  lastName: string;
  firstName: string;
  phone: string;
  licensePlate: string;
  checkOut: string;
  flightDirection: string;
  parkingSector: string;
  passengerCount: number | null;
  totalCost: string;
  notes: string;
}

const EMPTY_FORM: LegacyDepartureFormValues = {
  lastName: "",
  firstName: "",
  phone: "",
  licensePlate: "",
  checkOut: "",
  flightDirection: "",
  parkingSector: "",
  passengerCount: null,
  totalCost: "",
  notes: "",
};

/**
 * TYMCZASOWE (przejście na system): rejestracja samochodu, który stał na parkingu
 * przed wdrożeniem ParkTrack — trafia od razu na listę wyjazdów.
 */
export function LegacyDepartureDialog({ isOpen, isLoading = false, onClose, onConfirm }: LegacyDepartureDialogProps) {
  const form = useForm<LegacyDepartureFormValues>({ defaultValues: EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    form.reset(EMPTY_FORM);
    setError(null);
  }, [isOpen, form]);

  const handleConfirm = form.handleSubmit(async (values) => {
    setError(null);
    if (!values.checkOut) {
      setError("Podaj planowaną datę powrotu");
      return;
    }
    const cost = values.totalCost.trim() ? Number(values.totalCost.replace(",", ".")) : undefined;
    if (cost !== undefined && Number.isNaN(cost)) {
      setError("Nieprawidłowa kwota");
      return;
    }

    const parsed = createLegacyDepartureSchema.safeParse({
      last_name: values.lastName,
      first_name: values.firstName || undefined,
      phone: values.phone || undefined,
      license_plate: values.licensePlate.trim() ? values.licensePlate.trim().toUpperCase() : undefined,
      notes: values.notes || undefined,
      flight_direction: values.flightDirection.trim() || undefined,
      parking_sector: values.parkingSector.trim() || undefined,
      passenger_count: values.passengerCount ?? undefined,
      planned_check_out: fromWarsawDateTimeLocal(values.checkOut),
      total_cost: cost,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane");
      return;
    }

    try {
      await onConfirm(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać wyjazdu");
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj wyjazd (samochód już na parkingu)</DialogTitle>
          <DialogDescription>
            Tymczasowo, na czas przejścia na system: rezerwacja zostanie utworzona jako „na parkingu” i pojawi się na
            liście wyjazdów.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleConfirm} onChange={() => setError(null)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwisko *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isLoading} />
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
                      <Input {...field} disabled={isLoading} />
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
                        {...field}
                        maxLength={15}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        disabled={isLoading}
                      />
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
                      <Input type="tel" {...field} disabled={isLoading} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planowany powrót *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} disabled={isLoading} />
                    </FormControl>
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
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      disabled={isLoading}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parkingSector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sektor</FormLabel>
                    <FormControl>
                      <Input placeholder="np. A12" maxLength={50} {...field} disabled={isLoading} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passengerCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liczba pasażerów</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="totalCost"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Kwota (zł)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="Puste = wylicz z cennika (od dziś do powrotu)"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notatki</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isLoading} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Anuluj
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Zapisywanie..." : "Dodaj wyjazd"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
