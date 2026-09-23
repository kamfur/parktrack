import { useState } from "react";
import type {
  NewReservationModalProps,
  QuickReservationFormData,
  FullReservationFormData,
  CreateReservationCommand,
} from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuickReservationForm } from "./QuickReservationForm";
import { FullReservationForm } from "./FullReservationForm";
import { useCreateReservation } from "@/hooks/useCreateReservation";
import { useCostCalculation } from "@/hooks/useCostCalculation";

/**
 * Główny kontener modala nowej rezerwacji.
 * Zarządza stanem widoczności, trybem formularza oraz obsługą klawiszy.
 */
export function NewReservationModal({ isOpen, onClose, onSuccess, defaultMode = "quick" }: NewReservationModalProps) {
  const [mode, setMode] = useState<"quick" | "full">(defaultMode);
  const [formData, setFormData] = useState<Partial<FullReservationFormData>>({});

  const { createReservation, isCreating } = useCreateReservation();

  // Get estimated cost for both modes
  const { estimatedCost } = useCostCalculation(formData.checkInDate || null, formData.checkOutDate || null);

  // Transform Quick Mode data to API command
  const transformQuickToCommand = (data: QuickReservationFormData): CreateReservationCommand => {
    if (!data.checkInDate || !data.checkOutDate) {
      throw new Error("Daty są wymagane");
    }

    const command: CreateReservationCommand = {
      last_name: data.lastName.trim(),
      planned_check_in: data.checkInDate.toISOString(),
      planned_check_out: data.checkOutDate.toISOString(),
      source: "phone",
    };

    // Only include total_cost if it's a positive number (server will calculate if not provided)
    if (estimatedCost && estimatedCost > 0) {
      command.total_cost = estimatedCost;
    }

    return command;
  };

  // Transform Full Mode data to API command
  const transformFullToCommand = (data: FullReservationFormData): CreateReservationCommand => {
    if (!data.checkInDate || !data.checkOutDate) {
      throw new Error("Daty są wymagane");
    }

    const command: CreateReservationCommand = {
      last_name: data.lastName.trim(),
      first_name: data.firstName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.replace(/\s/g, "") || undefined,
      license_plate: data.licensePlate?.toUpperCase().trim() || undefined,
      flight_direction: data.flightDirection?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      planned_check_in: data.checkInDate.toISOString(),
      planned_check_out: data.checkOutDate.toISOString(),
      source: "phone",
      parking_type: data.requiresGarage ? "garage" : "open_air",
    };

    // Only include total_cost if it's a positive number (server will calculate if not provided)
    if (estimatedCost && estimatedCost > 0) {
      command.total_cost = estimatedCost;
    }

    return command;
  };

  // Handle Quick Mode submit
  const handleQuickSubmit = async (data: QuickReservationFormData) => {
    try {
      const command = transformQuickToCommand(data);
      const reservation = await createReservation(command);
      onSuccess(reservation);
      onClose();
      resetModal();
    } catch (error) {
      // Error handling is done in useCreateReservation hook
      console.error("Failed to create reservation:", error);
    }
  };

  // Handle Full Mode submit
  const handleFullSubmit = async (data: FullReservationFormData) => {
    try {
      const command = transformFullToCommand(data);
      const reservation = await createReservation(command);
      onSuccess(reservation);
      onClose();
      resetModal();
    } catch (error) {
      // Error handling is done in useCreateReservation hook
      console.error("Failed to create reservation:", error);
    }
  };

  // Switch from Quick to Full Mode
  const handleSwitchToFull = (data: QuickReservationFormData) => {
    // Save current Quick Mode data
    setFormData({
      lastName: data.lastName,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
    });
    setMode("full");
  };

  // Switch from Full to Quick Mode
  const handleSwitchToQuick = () => {
    // Keep only common fields
    setFormData({
      lastName: formData.lastName || "",
      checkInDate: formData.checkInDate,
      checkOutDate: formData.checkOutDate,
    });
    setMode("quick");
  };

  // Reset modal state
  const resetModal = () => {
    setMode(defaultMode);
    setFormData({});
  };

  // Handle modal close with unsaved changes detection
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // TODO: Add unsaved changes detection and warning
      // For now, just close
      onClose();
      // Reset after animation completes
      setTimeout(resetModal, 200);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nowa rezerwacja</DialogTitle>
          <DialogDescription>
            {mode === "quick"
              ? "Szybkie utworzenie rezerwacji z podstawowymi danymi"
              : "Szczegółowe informacje o rezerwacji"}
          </DialogDescription>
        </DialogHeader>

        {mode === "quick" ? (
          <QuickReservationForm
            onSubmit={handleQuickSubmit}
            onSwitchToFull={handleSwitchToFull}
            isSubmitting={isCreating}
          />
        ) : (
          <FullReservationForm
            initialData={formData}
            onSubmit={handleFullSubmit}
            onSwitchToQuick={handleSwitchToQuick}
            isSubmitting={isCreating}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
