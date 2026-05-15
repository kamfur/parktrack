import React from "react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Edit, XCircle } from "lucide-react";
import type { ActionFooterProps, ReservationStatus } from "@/types";

/**
 * Footer z akcjami kontekstowymi zależnymi od statusu rezerwacji.
 */
export function ActionFooter({
  reservationId,
  status,
  onCheckIn,
  onCheckOut,
  onEdit,
  onCancel,
  isProcessing,
}: ActionFooterProps) {
  // Determine which actions are available based on status
  const availableActions = getAvailableActions(status);

  return (
    <div className="border-t px-4 sm:px-6 py-3 sm:py-4 bg-muted/20 sticky bottom-0 z-10">
      <div className="flex justify-end gap-2 sm:gap-3 flex-wrap">
        {availableActions.canCheckIn && (
          <Button onClick={onCheckIn} disabled={isProcessing} className="gap-2 min-h-[44px] text-sm sm:text-base">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Check-in</span>
            <span className="sm:hidden">Check-in</span>
          </Button>
        )}

        {availableActions.canCheckOut && (
          <Button onClick={onCheckOut} disabled={isProcessing} className="gap-2 min-h-[44px] text-sm sm:text-base">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Check-out</span>
            <span className="sm:hidden">Check-out</span>
          </Button>
        )}

        {availableActions.canEdit && (
          <Button onClick={onEdit} disabled={isProcessing} variant="secondary" className="gap-2 min-h-[44px] text-sm sm:text-base">
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">Edytuj</span>
            <span className="sm:hidden">Edytuj</span>
          </Button>
        )}

        {availableActions.canCancel && (
          <Button onClick={onCancel} disabled={isProcessing} variant="destructive" className="gap-2 min-h-[44px] text-sm sm:text-base">
            <XCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Anuluj rezerwację</span>
            <span className="sm:hidden">Anuluj</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to determine available actions based on reservation status
 */
function getAvailableActions(status: ReservationStatus) {
  return {
    canCheckIn: status === "confirmed",
    canCheckOut: status === "in_progress",
    canEdit: status === "confirmed" || status === "in_progress",
    canCancel: status === "confirmed" || status === "in_progress",
  };
}
