import React, { useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ReservationDetailsViewProps } from "@/types";
import { DetailHeader } from "./DetailHeader";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { ReservationDetailsCard } from "./ReservationDetailsCard";
import { FinancialSection } from "./FinancialSection";
import { NotesSection } from "./NotesSection";
import { TimelineSection } from "./TimelineSection";
import { ActionFooter } from "./ActionFooter";
import { CheckInModalPlaceholder } from "./CheckInModalPlaceholder";
import { CheckOutModalPlaceholder } from "./CheckOutModalPlaceholder";
import { CancelDialogPlaceholder } from "./CancelDialogPlaceholder";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import { ReservationDetailsErrorBoundary } from "./ErrorBoundary";
import { useReservationDetails } from "@/hooks/useReservationDetails";

/**
 * Główny kontener widoku szczegółów rezerwacji.
 * Wyświetla pełne informacje o rezerwacji z możliwością edycji i akcjami.
 */
export function ReservationDetailsView({ reservationId, isOpen, onClose, onUpdate }: ReservationDetailsViewProps) {
  const {
    reservation,
    viewModel,
    isLoading,
    error,
    isDirty,
    updateNotes,
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
    enterEditMode,
    isProcessing,
  } = useReservationDetails({ reservationId, enabled: isOpen });

  // Handle successful updates
  useEffect(() => {
    if (reservation && onUpdate) {
      onUpdate(reservation);
    }
  }, [reservation, onUpdate]);

  // Handle close with dirty state check
  const handleClose = useCallback(() => {
    if (isDirty) {
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
  }, [isDirty, onClose]);

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
                <PersonalInfoCard
                  email={reservation.email}
                  phone={reservation.phone}
                  licensePlate={reservation.license_plate}
                />

                <ReservationDetailsCard
                  plannedCheckIn={reservation.planned_check_in}
                  plannedCheckOut={reservation.planned_check_out}
                  flightDirection={
                    reservation.flight_direction === "departure" || reservation.flight_direction === "arrival"
                      ? reservation.flight_direction
                      : null
                  }
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
              </div>

              <ActionFooter
                reservationId={reservationId}
                status={reservation.status}
                onCheckIn={openCheckInModal}
                onCheckOut={openCheckOutModal}
                onEdit={enterEditMode}
                onCancel={openCancelDialog}
                isProcessing={isProcessing}
              />
            </>
          )}

          {/* Modals */}
          {reservation && (
            <>
              <CheckInModalPlaceholder
                isOpen={showCheckInModal}
                onClose={closeCheckInModal}
                reservationId={reservationId}
                onSuccess={() => {
                  toast.success("Check-in wykonany pomyślnie");
                }}
              />

              <CheckOutModalPlaceholder
                isOpen={showCheckOutModal}
                onClose={closeCheckOutModal}
                reservationId={reservationId}
                onSuccess={() => {
                  toast.success("Check-out wykonany pomyślnie");
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
