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
    performCheckIn,
    performCheckOut,
    enterEditMode,
    exitEditMode,
    isProcessing,
  } = useReservationDetails({ reservationId, enabled: isOpen, initialEditMode });

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

    const datesChanged =
      data.checkInDate.toISOString() !== new Date(reservation.planned_check_in).toISOString() ||
      data.checkOutDate.toISOString() !== new Date(reservation.planned_check_out).toISOString();

    const payload: Parameters<typeof updateReservation>[0] = {
      last_name: data.lastName.trim(),
      first_name: data.firstName?.trim() || "",
      email: data.email?.trim() || "",
      phone: data.phone?.replace(/\s/g, "") || "",
      license_plate: data.licensePlate?.trim() || "",
      flight_direction: data.flightDirection?.trim() || "",
      notes: data.notes?.trim() || "",
    };

    if (editRules.canEditCheckIn) {
      payload.planned_check_in = data.checkInDate.toISOString();
    }
    if (editRules.canEditCheckOut) {
      payload.planned_check_out = data.checkOutDate.toISOString();
    }

    if (datesChanged && (editRules.canEditCheckIn || editRules.canEditCheckOut)) {
      try {
        const params = new URLSearchParams({
          check_in: data.checkInDate.toISOString(),
          check_out: data.checkOutDate.toISOString(),
        });
        const costRes = await fetch(`/api/calculate-cost?${params.toString()}`);
        if (costRes.ok) {
          const costData = (await costRes.json()) as { totalCost?: number };
          if (typeof costData.totalCost === "number" && costData.totalCost > 0) {
            payload.total_cost = costData.totalCost;
          }
        }
      } catch {
        // Keep existing cost if recalculation fails
      }
    }

    try {
      await updateReservation(payload);
      exitEditMode();
      toast.success("Rezerwacja została zaktualizowana");
    } catch (err) {
      toast.error("Nie udało się zapisać zmian");
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

  // Handle dialog change with validation
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <ReservationDetailsErrorBoundary>
      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] md:max-h-[90vh] overflow-hidden flex flex-col p-0 sm:rounded-lg gap-0">
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
                    />

                    <ReservationDetailsCard
                      plannedCheckIn={reservation.planned_check_in}
                      plannedCheckOut={reservation.planned_check_out}
                      flightDirection={reservation.flight_direction}
                      garageSpotLabel={viewModel.garageSpotLabel}
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
                  isProcessing={isProcessing}
                  existingInvoiceId={existingInvoice?.id ?? null}
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
