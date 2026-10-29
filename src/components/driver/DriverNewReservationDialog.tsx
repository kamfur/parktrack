import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { ParkingType } from "@/types";
import { driverCreateReservationSchema } from "@/lib/schemas/driver.schema";
import { datetimeLocalToIso, isoToDatetimeLocal } from "@/lib/schemas/driver-form.schema";
import { PARKING_TYPES, PARKING_TYPE_LABELS } from "@/lib/pricing/parking-type";
import { useNewStayQuote } from "@/hooks/useCheckoutQuote";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { VehicleCountInput } from "@/components/shared/VehicleCountInput";
import { PaymentQuote } from "@/components/driver/PaymentQuote";
import { FlightDirectionInput } from "@/components/reservations/FlightDirectionInput";
import { GarageSpotSelect } from "@/components/reservations/GarageSpotSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  TABLET_FORM_BLEED,
  TABLET_FORM_GUTTER,
  TABLET_FULLSCREEN_DIALOG,
  TOUCH_FORM_READABILITY,
} from "@/components/common/dialog-layout";
import { cn } from "@/lib/utils";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useVoiceFormFill } from "@/hooks/useVoiceFormFill";
import { toDriverFormWrites } from "@/lib/voice/apply-to-driver-form";
import type { VoiceFieldKey } from "@/lib/voice/merge";
import type { ParsedVoiceFields } from "@/lib/voice/types";
import { VoiceCaptureButton } from "@/components/voice/VoiceCaptureButton";
import { ManualPriceInput } from "@/components/reservations/ManualPriceInput";
import { TranscriptPreview } from "@/components/voice/TranscriptPreview";
import { VoiceFieldBadge } from "@/components/voice/VoiceFieldBadge";
import { PlateConfirmation } from "@/components/voice/PlateConfirmation";

interface DriverNewReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  isProcessing: boolean;
  /** Staff may agree a price with the client; drivers never see the field (the API rejects it too). */
  canSetPrice?: boolean;
}

interface FormValues {
  lastName: string;
  firstName: string;
  phone: string;
  licensePlate: string;
  vehicleCount: number;
  checkIn: string;
  checkOut: string;
  parkingType: ParkingType;
  /** "" = auto-assign the first free garage/carport spot. */
  garageSpotId: string;
  flightDirection: string;
  notes: string;
  /** Price agreed with the client (whole reservation); null = price list. */
  totalCost: number | null;
}

function emptyForm(): FormValues {
  return {
    lastName: "",
    firstName: "",
    phone: "",
    licensePlate: "",
    vehicleCount: 1,
    checkIn: isoToDatetimeLocal(new Date().toISOString()),
    checkOut: "",
    parkingType: "open_air",
    garageSpotId: "",
    flightDirection: "",
    notes: "",
    totalCost: null,
  };
}

export function DriverNewReservationDialog({
  open,
  onOpenChange,
  onSubmit,
  isProcessing,
  canSetPrice = false,
}: DriverNewReservationDialogProps) {
  const form = useForm<FormValues>({ defaultValues: emptyForm() });
  const [error, setError] = useState<string | null>(null);
  // Same flow as the dashboard: quick (name + dates) first, full details on demand.
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const full = mode === "full";

  // Dictation: the dialog stays mounted, so the session and provenance are reset on every open/close.
  const voice = useVoiceSession();
  const applyVoice = useCallback(
    (updates: Partial<ParsedVoiceFields>) => {
      for (const write of toDriverFormWrites(updates, (field) => form.getValues(field))) {
        form.setValue(write.field, write.value as never, { shouldDirty: true });
      }
    },
    [form]
  );
  const voiceFill = useVoiceFormFill({ parsed: voice.parsed, apply: applyVoice });
  const { cancel: cancelVoice } = voice;
  const { reset: resetVoiceFill } = voiceFill;
  const voiceBadge = (key: VoiceFieldKey) =>
    voiceFill.provenance[key] === "voice" ? (
      <VoiceFieldBadge lowConfidence={voiceFill.meta[key]?.lowConfidence} />
    ) : null;

  useEffect(() => {
    cancelVoice();
    resetVoiceFill();
    if (!open) return;
    form.reset(emptyForm());
    setError(null);
    setMode("quick");
  }, [open, form, cancelVoice, resetVoiceFill]);

  const checkInIso = datetimeLocalToIso(form.watch("checkIn")) ?? null;
  const checkOutIso = datetimeLocalToIso(form.watch("checkOut")) ?? null;
  const parkingType = form.watch("parkingType");
  const vehicleCount = form.watch("vehicleCount");
  const listQuote = useNewStayQuote(checkInIso, checkOutIso, parkingType, vehicleCount);
  const agreedPrice = canSetPrice ? (form.watch("totalCost") ?? null) : null;
  const quote = agreedPrice != null ? { ...listQuote, totalCost: agreedPrice } : listQuote;

  const handleSubmit = form.handleSubmit(async (values) => {
    setError(null);
    if (voiceFill.needsPlateConfirmation) return;
    const parsed = driverCreateReservationSchema.safeParse({
      last_name: values.lastName,
      first_name: values.firstName.trim() || undefined,
      phone: values.phone.replace(/\s/g, "") || undefined,
      license_plate: values.licensePlate.trim() ? values.licensePlate.trim().toUpperCase() : undefined,
      vehicle_count: values.vehicleCount,
      flight_direction: values.flightDirection.trim() || undefined,
      notes: values.notes.trim() || undefined,
      total_cost: canSetPrice && values.totalCost != null ? values.totalCost : undefined,
      planned_check_in: checkInIso ?? "",
      planned_check_out: checkOutIso ?? "",
      parking_type: values.parkingType,
      garage_spot_id: values.parkingType !== "open_air" && values.garageSpotId ? values.garageSpotId : undefined,
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

  const datesFields = (
    <>
      <FormField
        control={form.control}
        name="checkIn"
        render={({ field }) => (
          <FormItem className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <FormLabel>Data i godzina przyjazdu *</FormLabel>
              {voiceBadge("checkIn")}
            </div>
            <FormControl>
              <DateTimePicker
                value={field.value ? new Date(field.value) : null}
                onChange={(d) => {
                  voiceFill.markManual("checkIn");
                  field.onChange(d ? isoToDatetimeLocal(d.toISOString()) : "");
                }}
                placeholder="Wybierz datę i godzinę"
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="checkOut"
        render={({ field }) => (
          <FormItem className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <FormLabel>Data i godzina powrotu *</FormLabel>
              {voiceBadge("checkOut")}
            </div>
            <FormControl>
              <DateTimePicker
                value={field.value ? new Date(field.value) : null}
                onChange={(d) => {
                  voiceFill.markManual("checkOut");
                  field.onChange(d ? isoToDatetimeLocal(d.toISOString()) : "");
                }}
                placeholder="Wybierz datę i godzinę"
              />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          TABLET_FULLSCREEN_DIALOG,
          TOUCH_FORM_READABILITY,
          TABLET_FORM_GUTTER,
          "max-h-[90dvh] max-w-md overflow-y-auto sm:max-w-xl"
        )}
      >
        <DialogHeader>
          <DialogTitle>Nowa rezerwacja</DialogTitle>
          <DialogDescription>
            {full ? "Szczegółowe informacje o rezerwacji" : "Szybkie utworzenie rezerwacji z podstawowymi danymi"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            onChange={() => setError(null)}
            className="grid grid-cols-2 gap-x-4 gap-y-4 max-lg:gap-y-5"
          >
            <div className="col-span-2 space-y-2">
              <VoiceCaptureButton
                size="lg"
                className="w-full"
                state={voice.state}
                onStart={() => {
                  setMode("full");
                  void voice.start();
                }}
                onStop={() => void voice.stop()}
              />
              <TranscriptPreview
                state={voice.state}
                finalText={voice.finalText}
                partialText={voice.partialText}
                error={voice.error}
              />
            </div>
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-2">
                    <FormLabel>Nazwisko *</FormLabel>
                    {voiceBadge("lastName")}
                  </div>
                  <FormControl>
                    <Input
                      className="min-h-11"
                      maxLength={100}
                      {...field}
                      onChange={(e) => {
                        voiceFill.markManual("lastName");
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {!full ? datesFields : null}
            {full ? (
              <>
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-2">
                        <FormLabel>Imię</FormLabel>
                        {voiceBadge("firstName")}
                      </div>
                      <FormControl>
                        <Input
                          className="min-h-11"
                          maxLength={100}
                          {...field}
                          onChange={(e) => {
                            voiceFill.markManual("firstName");
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-2">
                        <FormLabel>Telefon</FormLabel>
                        {voiceBadge("phone")}
                      </div>
                      <FormControl>
                        <Input
                          type="tel"
                          className="min-h-11"
                          maxLength={20}
                          {...field}
                          onChange={(e) => {
                            voiceFill.markManual("phone");
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-2">
                        <FormLabel>Numer rejestracyjny</FormLabel>
                        {voiceBadge("licensePlate")}
                      </div>
                      <FormControl>
                        <Input
                          className="min-h-11"
                          placeholder="np. WX 12345"
                          maxLength={15}
                          {...field}
                          onChange={(e) => {
                            voiceFill.markManual("licensePlate");
                            field.onChange(e.target.value.toUpperCase());
                          }}
                        />
                      </FormControl>
                      {voiceFill.needsPlateConfirmation && field.value ? (
                        <PlateConfirmation
                          plate={field.value}
                          formatWarning={voiceFill.meta.licensePlate?.formatWarning}
                          onConfirm={voiceFill.confirmPlate}
                        />
                      ) : null}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicleCount"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <FormLabel>Liczba aut</FormLabel>
                      <FormControl>
                        <VehicleCountInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parkingType"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-2">
                        <FormLabel>Typ miejsca</FormLabel>
                        {voiceBadge("parkingType")}
                      </div>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          voiceFill.markManual("parkingType");
                          field.onChange(value);
                        }}
                      >
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
                {datesFields}
                {parkingType === "garage" || parkingType === "carport" ? (
                  <FormField
                    control={form.control}
                    name="garageSpotId"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{parkingType === "garage" ? "Garaż" : "Wiata"}</FormLabel>
                        <GarageSpotSelect
                          parkingType={parkingType}
                          checkIn={checkInIso}
                          checkOut={checkOutIso}
                          value={field.value}
                          onChange={field.onChange}
                          emptyLabel="Automatycznie (pierwsze wolne)"
                        />
                      </FormItem>
                    )}
                  />
                ) : null}
                <FormField
                  control={form.control}
                  name="flightDirection"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <div className="flex items-center gap-2">
                        <FormLabel>Kierunek lotu</FormLabel>
                        {voiceBadge("flightDirection")}
                      </div>
                      <FlightDirectionInput
                        className="min-h-11"
                        placeholder="np. Londyn, LO 392"
                        maxLength={100}
                        value={field.value}
                        onChange={(value) => {
                          voiceFill.markManual("flightDirection");
                          field.onChange(value);
                        }}
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
                    <FormItem className="col-span-2">
                      <FormLabel>Notatki</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-20" maxLength={1000} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            ) : null}
            {canSetPrice && full ? (
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="totalCost"
                  render={({ field }) => <ManualPriceInput value={field.value} onChange={field.onChange} />}
                />
              </div>
            ) : null}
            {checkInIso && checkOutIso ? (
              <div className="col-span-2">
                <PaymentQuote {...quote} />
              </div>
            ) : null}
            {error ? <p className="col-span-2 text-sm text-destructive">{error}</p> : null}
            {voiceFill.needsPlateConfirmation ? (
              <p className="col-span-2 text-sm text-muted-foreground">
                Potwierdź numer rejestracyjny z dyktowania, aby dodać rezerwację.
              </p>
            ) : null}
            <DialogFooter
              className={cn(
                "sticky bottom-0 col-span-2 -mx-6 -mb-6 flex-row gap-2 border-t bg-white px-6 py-3",
                TABLET_FORM_BLEED,
                TABLET_FORM_GUTTER
              )}
            >
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => onOpenChange(false)}
              >
                Anuluj
              </Button>
              {!full ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={isProcessing}
                  onClick={() => setMode("full")}
                >
                  Zapisz i dodaj szczegóły
                </Button>
              ) : null}
              <Button
                type="submit"
                className="min-h-11 flex-[2] sm:flex-none"
                disabled={isProcessing || voiceFill.needsPlateConfirmation}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {full ? "Dodaj rezerwację" : "Zapisz szybko"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
