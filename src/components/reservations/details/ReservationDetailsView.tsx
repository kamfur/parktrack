import React, { useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { EditReservationFormData, ReservationDetailsViewProps } from "@/types";
import { DetailHeader } from "./DetailHeader";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { ReservationDetailsCard } from "./ReservationDetailsCard";
import { FinancialSection } from "./FinancialSection";
import { NotesSection } from "./NotesSection";
import { TimelineSection } from "./TimelineSection";
import { ActionFooter } from "./ActionFooter";
import { CancelDialogPlaceholder } from "./CancelDialogPlaceholder";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import { ReservationDetailsErrorBoundary } from "./ErrorBoundary";
import { EditReservationForm } from "@/components/reservations/EditReservationForm";
import { DriverArrivalDialog } from "@/components/driver/DriverArrivalDialog";
import { DriverDepartureDialog } from "@/components/driver/DriverDepartureDialog";
import { useReservationDetails } from "@/hooks/useReservationDetails";
import { useTravelAgency } from "@/hooks/useTravelAgencies";
import { MOBILE_FULLSCREEN_DIALOG } from "@/components/common/dialog-layout";
import { cn } from "@/lib/utils";

/**
 * Główny kontener widoku szczegółów rezerwacji.
 * Wyświetla pełne informacje o rezerwacji z możliwością edycji i akcjami.
 */
export function ReservationDetailsView({
  reservationId,
  isOpen,
  onClose,
  onUpdate,
  initialEditMode = false,
}: ReservationDetailsViewProps) {
  const {
    reservation,
    viewModel,
    existingInvoice,
    isLoading,
    error,
    isDirty,
    isEditMode,
    isUpdating,
    editRules,
    garageSpotId,
    updateNotes,
    updateReservation,
    showCheckInModal,
    showCheckOutModal,
    showCancelDialog,
    openCheckInModal,
    closeCheckInModal,
    openCheckOutModal,
    closeCheckOutModal,
    openCancelDialog,
    closeCancelDialog,
    cancelReservation,
    markNoShow,
    restoreReservation,
    performCheckIn,
    performCheckOut,
    enterEditMode,
    exitEditMode,
    isProcessing,
  } = useReservationDetails({ reservationId, enabled: isOpen, initialEditMode });
  const travelAgency = useTravelAgency(reservation?.travel_agency_id ?? null);

  const lastNotifiedUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    lastNotifiedUpdateRef.current = null;
  }, [reservationId]);

  // Notify parent only after a real change — never on the initial fetch.
  // An unstable onUpdate (inline callback) would otherwise refetch the calendar in a loop.
  useEffect(() => {
    if (!reservation || !onUpdate) return;

    const stamp = reservation.updated_at ?? reservation.id;
    if (lastNotifiedUpdateRef.current === null) {
      lastNotifiedUpdateRef.current = stamp;
      return;
    }
    if (lastNotifiedUpdateRef.current === stamp) return;

    lastNotifiedUpdateRef.current = stamp;
    onUpdate(reservation);
  }, [reservation, onUpdate]);

  const handleEditSubmit = async (data: EditReservationFormData) => {
    if (!reservation) return;

    const payload: Parameters<typeof updateReservation>[0] = {
      last_name: data.lastName.trim(),
      first_name: data.firstName?.trim() || "",
      email: data.email?.trim() || "",
      phone: data.phone?.replace(/\s/g, "") || "",
      license_plate: data.licensePlate?.trim() || "",
      flight_direction: data.flightDirection?.trim() || "",
      notes: data.notes?.trim() || "",
    };

    // The count is price-relevant (same rule as the parking type); plates follow the new count.
    const nextCount = editRules.canEditParkingType ? data.vehicleCount : (reservation.vehicle_count ?? 1);
    if (nextCount !== (reservation.vehicle_count ?? 1)) payload.vehicle_count = nextCount;
    payload.extra_license_plates = data.extraLicensePlates
      .slice(0, nextCount - 1)
      .map((plate) => plate.trim().toUpperCase());

    if (editRules.canEditCheckIn) {
      payload.planned_check_in = data.checkInDate.toISOString();
    }
    if (editRules.canEditCheckOut) {
      payload.planned_check_out = data.checkOutDate.toISOString();
    }
    if (editRules.canEditTravelAgency) {
      const nextAgencyId = data.travelAgencyId || null;
      if (nextAgencyId !== (reservation.travel_agency_id ?? null)) payload.travel_agency_id = nextAgencyId;
    }
    if (editRules.canEditParkingType && data.parkingType !== reservation.parking_type) {
      payload.parking_type = data.parkingType;
    }
    if (editRules.canEditKeysLeft && data.keysLeft !== reservation.keys_left) {
      payload.keys_left = data.keysLeft;
    }
    if (editRules.canEditPayment && !(data.travelAgencyId || null)) {
      if (data.paidAtArrival !== undefined && data.paidAtArrival !== reservation.paid_at_arrival) {
        payload.paid_at_arrival = data.paidAtArrival;
      }
      if (data.paidAtDeparture !== undefined && data.paidAtDeparture !== reservation.paid_at_departure) {
        payload.paid_at_departure = data.paidAtDeparture;
      }
    }
    if (
      editRules.canEditParkingType &&
      (data.parkingType === "garage" || data.parkingType === "carport") &&
      data.garageSpotId &&
      data.garageSpotId !== garageSpotId
    ) {
      payload.garage_spot_id = data.garageSpotId;
    }

    // total_cost is re-priced by the DB trigger (price list + parking type) when dates or type change.

    try {
      await updateReservation(payload);
      exitEditMode();
      toast.success("Rezerwacja została zaktualizowana");
    } catch (err) {
      toast.error("Nie udało się zapisać zmian", {
        description: err instanceof Error && err.message !== "Failed to update reservation" ? err.message : undefined,
      });
      // eslint-disable-next-line no-console
      console.error("Update reservation error:", err);
    }
  };

  // Handle close with dirty state check
  const handleClose = useCallback(() => {
    if (isEditMode || isDirty) {
      const confirmed = window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz zamknąć?");
      if (!confirmed) return;
    }

    // Validate onClose before calling
    if (typeof onClose === "function") {
      onClose();
    } else {
      // Fallback: navigate back
      window.history.back();
    }
  }, [isDirty, isEditMode, onClose]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isDirty, handleClose]);

  // Handle cancel reservation
  const handleCancelReservation = async (reason?: string) => {
    try {
      await cancelReservation(reason);
      toast.success("Rezerwacja została anulowana");
    } catch (err) {
      toast.error("Nie udało się anulować rezerwacji");
      // eslint-disable-next-line no-console
      console.error("Cancel reservation error:", err);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreReservation();
      toast.success("Rezerwacja przywrócona");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się przywrócić rezerwacji");
      // eslint-disable-next-line no-console
      console.error("Restore reservation error:", err);
    }
  };

  const handleNoShow = async () => {
    if (
      !window.confirm("Oznaczyć rezerwację jako „nie przyjechał”? Tej zmiany nie da się cofnąć z poziomu aplikacji.")
    ) {
      return;
    }
    try {
      await markNoShow();
      toast.success("Rezerwacja oznaczona: nie przyjechał");
    } catch (err) {
      toast.error("Nie udało się oznaczyć rezerwacji");
      // eslint-disable-next-line no-console
      console.error("No-show error:", err);
    }
  };

  // Handle dialog change with validation
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <ReservationDetailsErrorBoundary>
      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          className={cn(
            MOBILE_FULLSCREEN_DIALOG,
            "max-w-3xl max-h-[90vh] md:max-h-[90vh] overflow-hidden flex flex-col p-0 sm:rounded-lg gap-0"
          )}
        >
          {isLoading && <LoadingSkeleton />}

          {error && (
            <ErrorState
              error={error}
              onRetry={() => window.location.reload()}
              onBack={() => {
                if (typeof onClose === "function") {
                  onClose();
                }
                window.history.back();
              }}
            />
          )}

          {viewModel && reservation && (
            <>
              <DetailHeader
                firstName={reservation.first_name}
                lastName={reservation.last_name}
                status={reservation.status}
                onClose={handleClose}
              />

              <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 px-4 sm:px-6 py-4">
                {isEditMode ? (
                  <EditReservationForm
                    reservation={reservation}
                    editRules={editRules}
                    currentGarageSpotId={garageSpotId}
                    onSubmit={handleEditSubmit}
                    onCancel={exitEditMode}
                    isSubmitting={isUpdating || isProcessing}
                  />
                ) : (
                  <>
                    <PersonalInfoCard
                      email={reservation.email}
                      phone={reservation.phone}
                      licensePlate={reservation.license_plate}
                      extraLicensePlates={reservation.extra_license_plates}
                      vehicleCount={reservation.vehicle_count}
                    />

                    <ReservationDetailsCard
                      plannedCheckIn={reservation.planned_check_in}
                      plannedCheckOut={reservation.planned_check_out}
                      flightDirection={reservation.flight_direction}
                      garageSpotLabel={viewModel.garageSpotLabel}
                      keysLeft={reservation.keys_left && reservation.actual_check_in != null}
                    />

                    <FinancialSection
                      totalCost={reservation.total_cost}
                      isPaid={reservation.is_paid}
                      paymentMethod={
                        "payment_method" in reservation &&
                        (reservation.payment_method === "cash" ||
                          reservation.payment_method === "card" ||
                          reservation.payment_method === "transfer")
                          ? (reservation.payment_method as "cash" | "card" | "transfer")
                          : null
                      }
                      source={reservation.source}
                      travelAgencyName={reservation.travel_agency_id ? (travelAgency?.name ?? "Biuro podróży") : null}
                      agencyDiscountPct={reservation.agency_discount_pct}
                    />

                    <NotesSection
                      reservationId={reservationId}
                      initialNotes={reservation.notes}
                      isEditable={viewModel.availableActions.canEdit}
                      onSave={updateNotes}
                    />

                    <TimelineSection events={viewModel.timeline} />
                  </>
                )}
              </div>

              {!isEditMode && (
                <ActionFooter
                  reservationId={reservationId}
                  status={reservation.status}
                  onCheckIn={openCheckInModal}
                  onCheckOut={openCheckOutModal}
                  onEdit={enterEditMode}
                  onCancel={openCancelDialog}
                  onNoShow={handleNoShow}
                  onRestore={handleRestore}
                  isProcessing={isProcessing}
                  existingInvoiceId={existingInvoice?.id ?? null}
                  isAgencyReservation={reservation.travel_agency_id !== null}
                />
              )}
            </>
          )}

          {/* Modals — same arrival/departure forms as driver module */}
          {reservation && (
            <>
              <DriverArrivalDialog
                reservation={showCheckInModal ? reservation : null}
                open={showCheckInModal}
                onOpenChange={(open) => {
                  if (!open) closeCheckInModal();
                }}
                isProcessing={isProcessing}
                onSubmit={async (_id, body) => {
                  await performCheckIn(body);
                  toast.success("Przyjazd potwierdzony");
                }}
              />

              <DriverDepartureDialog
                reservation={showCheckOutModal ? reservation : null}
                open={showCheckOutModal}
                onOpenChange={(open) => {
                  if (!open) closeCheckOutModal();
                }}
                isProcessing={isProcessing}
                onSubmit={async (_id, body) => {
                  await performCheckOut(body);
                  toast.success("Wyjazd zakończony");
                }}
              />

              <CancelDialogPlaceholder
                isOpen={showCancelDialog}
                onClose={closeCancelDialog}
                onConfirm={handleCancelReservation}
                isLoading={isProcessing}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </ReservationDetailsErrorBoundary>
  );
}
