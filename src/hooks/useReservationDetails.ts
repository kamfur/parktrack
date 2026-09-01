import { useState, useEffect, useCallback } from "react";
import type {
  ReservationDto,
  ReservationDetailsViewModel,
  ConditionalEditRules,
  TimelineEvent,
  FinancialInfoViewModel,
  CheckInCommand,
  CheckOutCommand,
  InvoiceDto,
} from "@/types";

interface UseReservationDetailsParams {
  reservationId: string;
  enabled: boolean;
}

interface UseReservationDetailsResult {
  // Data
  reservation: ReservationDto | null;
  viewModel: ReservationDetailsViewModel | null;
  existingInvoice: InvoiceDto | null;

  // Loading states
  isLoading: boolean;
  isUpdating: boolean;

  // Error handling
  error: Error | null;

  // Edit mode
  isEditMode: boolean;
  isDirty: boolean;
  editRules: ConditionalEditRules;

  // Actions
  enterEditMode: () => void;
  exitEditMode: () => void;
  updateReservation: (data: Partial<ReservationDto>) => Promise<void>;
  updateNotes: (notes: string) => Promise<void>;

  // Modal states
  showCheckInModal: boolean;
  showCheckOutModal: boolean;
  showCancelDialog: boolean;
  openCheckInModal: () => void;
  closeCheckInModal: () => void;
  openCheckOutModal: () => void;
  closeCheckOutModal: () => void;
  openCancelDialog: () => void;
  closeCancelDialog: () => void;

  // Operations
  performCheckIn: (data: CheckInCommand) => Promise<void>;
  performCheckOut: (data: CheckOutCommand) => Promise<void>;
  cancelReservation: (reason?: string) => Promise<void>;

  // Processing state
  isProcessing: boolean;
}

/**
 * Custom hook do zarządzania stanem widoku szczegółów rezerwacji.
 * Obsługuje fetch, update, real-time subscriptions, edit mode, modals.
 */
export function useReservationDetails({
  reservationId,
  enabled,
}: UseReservationDetailsParams): UseReservationDetailsResult {
  // State
  const [reservation, setReservation] = useState<ReservationDto | null>(null);
  const [existingInvoice, setExistingInvoice] = useState<InvoiceDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Fetch reservation data
  const fetchReservation = useCallback(async () => {
    if (!enabled || !reservationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [reservationRes, invoiceRes] = await Promise.all([
        fetch(`/api/reservations?id=eq.${reservationId}`),
        fetch(`/api/invoices?reservation_id=${reservationId}`),
      ]);

      if (!reservationRes.ok) {
        if (reservationRes.status === 404) {
          throw new Error("Reservation not found");
        }
        throw new Error("Failed to fetch reservation");
      }

      const data = await reservationRes.json();

      if (!data) {
        throw new Error("Reservation not found");
      }

      // API returns single object
      setReservation(data);

      if (invoiceRes.ok) {
        setExistingInvoice(await invoiceRes.json());
      } else {
        setExistingInvoice(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [reservationId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  // Polling mechanism - refresh every 30 seconds
  useEffect(() => {
    if (!enabled || !reservationId) return;

    const intervalId = setInterval(() => {
      fetchReservation();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [enabled, reservationId, fetchReservation]);

  // Update reservation
  const updateReservation = useCallback(
    async (data: Partial<ReservationDto>) => {
      if (!reservationId) return;

      setIsUpdating(true);
      try {
        const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error("Failed to update reservation");
        }

        const updated = await response.json();
        // API returns single object
        setReservation(updated);
        setIsDirty(false);
      } catch (err) {
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [reservationId]
  );

  // Update notes
  const updateNotes = useCallback(
    async (notes: string) => {
      await updateReservation({ notes });
    },
    [updateReservation]
  );

  // Edit mode actions
  const enterEditMode = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const exitEditMode = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz anulować edycję?");
      if (!confirmed) return;
    }
    setIsEditMode(false);
    setIsDirty(false);
  }, [isDirty]);

  // Modal actions
  const openCheckInModal = useCallback(() => setShowCheckInModal(true), []);
  const closeCheckInModal = useCallback(() => setShowCheckInModal(false), []);
  const openCheckOutModal = useCallback(() => setShowCheckOutModal(true), []);
  const closeCheckOutModal = useCallback(() => setShowCheckOutModal(false), []);
  const openCancelDialog = useCallback(() => setShowCancelDialog(true), []);
  const closeCancelDialog = useCallback(() => setShowCancelDialog(false), []);

  // Operations
  const performCheckIn = useCallback(
    async (data: CheckInCommand) => {
      setIsProcessing(true);
      try {
        await updateReservation(data);
        closeCheckInModal();
      } catch (err) {
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [updateReservation, closeCheckInModal]
  );

  const performCheckOut = useCallback(
    async (data: CheckOutCommand) => {
      setIsProcessing(true);
      try {
        await updateReservation(data);
        closeCheckOutModal();
      } catch (err) {
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [updateReservation, closeCheckOutModal]
  );

  const cancelReservation = useCallback(
    async (reason?: string) => {
      setIsProcessing(true);
      try {
        const updateData: Partial<ReservationDto> = {
          status: "cancelled",
        };

        if (reason) {
          const currentNotes = reservation?.notes || "";
          updateData.notes = currentNotes
            ? `${currentNotes}\n\nPowód anulowania: ${reason}`
            : `Powód anulowania: ${reason}`;
        }

        await updateReservation(updateData);
        closeCancelDialog();
      } catch (err) {
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [updateReservation, closeCancelDialog, reservation]
  );

  // Build ViewModel
  const viewModel: ReservationDetailsViewModel | null = reservation ? buildViewModel(reservation) : null;

  // Get edit rules
  const editRules = reservation ? getEditRules(reservation.status) : getDefaultEditRules();

  return {
    reservation,
    viewModel,
    existingInvoice,
    isLoading,
    isUpdating,
    error,
    isEditMode,
    isDirty,
    editRules,
    enterEditMode,
    exitEditMode,
    updateReservation,
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
    performCheckIn,
    performCheckOut,
    cancelReservation,
    isProcessing,
  };
}

/**
 * Builds ReservationDetailsViewModel from ReservationDto
 */
function buildViewModel(reservation: ReservationDto): ReservationDetailsViewModel {
  const fullName = reservation.first_name
    ? `${reservation.first_name} ${reservation.last_name}`
    : reservation.last_name;

  const financial = buildFinancialViewModel(reservation);
  const timeline = buildTimelineEvents(reservation);
  const availableActions = getAvailableActions(reservation.status);

  return {
    id: reservation.id,
    fullName,
    status: reservation.status,
    statusLabel: getStatusLabel(reservation.status),
    statusColor: getStatusColor(reservation.status),
    email: reservation.email,
    emailDisplay: reservation.email || "Brak danych",
    phone: reservation.phone,
    phoneDisplay: formatPhone(reservation.phone),
    licensePlate: reservation.license_plate,
    licensePlateDisplay: formatLicensePlate(reservation.license_plate),
    plannedCheckIn: reservation.planned_check_in,
    checkInDisplay: formatDate(reservation.planned_check_in),
    plannedCheckOut: reservation.planned_check_out,
    checkOutDisplay: formatDate(reservation.planned_check_out),
    days: calculateDays(reservation.planned_check_in, reservation.planned_check_out),
    flightDirection: reservation.flight_direction,
    flightDirectionLabel: getFlightDirectionLabel(reservation.flight_direction),
    flightDirectionIcon: getFlightDirectionIcon(reservation.flight_direction),
    financial,
    notes: reservation.notes,
    timeline,
    availableActions,
  };
}

/**
 * Builds FinancialInfoViewModel
 */
function buildFinancialViewModel(reservation: ReservationDto): FinancialInfoViewModel {
  return {
    totalCost: reservation.total_cost,
    formattedCost: formatCurrency(reservation.total_cost),
    isPaid: reservation.is_paid,
    paymentStatusLabel: reservation.is_paid ? "Opłacone" : "Nieopłacone",
    paymentStatusColor: reservation.is_paid ? "success" : "warning",
    paymentMethod: reservation.payment_method,
    paymentMethodLabel: getPaymentMethodLabel(reservation.payment_method),
    source: reservation.source,
    sourceLabel: getSourceLabel(reservation.source),
  };
}

/**
 * Builds timeline events from reservation data
 */
function buildTimelineEvents(reservation: ReservationDto): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Created event
  if (reservation.created_at) {
    events.push({
      type: "created",
      timestamp: reservation.created_at,
      performedBy: null,
      details: "Rezerwacja została utworzona w systemie",
    });
  }

  // Check-in event
  if (reservation.actual_check_in) {
    events.push({
      type: "check_in",
      timestamp: reservation.actual_check_in,
      performedBy: null,
      details: "Klient wykonał check-in",
    });
  }

  // Check-out event
  if (reservation.actual_check_out) {
    events.push({
      type: "check_out",
      timestamp: reservation.actual_check_out,
      performedBy: null,
      details: "Klient wykonał check-out",
    });
  }

  // Sort by timestamp (newest first)
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Get edit rules based on reservation status
 */
function getEditRules(status: string): ConditionalEditRules {
  switch (status) {
    case "confirmed":
      return {
        canEditCheckIn: true,
        canEditCheckOut: true,
        canEditPersonalInfo: true,
        canEditVehicleInfo: true,
        canEditNotes: true,
      };

    case "in_progress":
      return {
        canEditCheckIn: false, // LOCKED
        canEditCheckOut: true,
        canEditPersonalInfo: true,
        canEditVehicleInfo: true,
        canEditNotes: true,
      };

    case "completed":
    case "cancelled":
    case "no_show":
      return {
        canEditCheckIn: false,
        canEditCheckOut: false,
        canEditPersonalInfo: false,
        canEditVehicleInfo: false,
        canEditNotes: true, // ONLY NOTES
      };

    default:
      return getDefaultEditRules();
  }
}

function getDefaultEditRules(): ConditionalEditRules {
  return {
    canEditCheckIn: false,
    canEditCheckOut: false,
    canEditPersonalInfo: false,
    canEditVehicleInfo: false,
    canEditNotes: false,
  };
}

/**
 * Get available actions based on status
 */
function getAvailableActions(status: string) {
  return {
    canCheckIn: status === "confirmed",
    canCheckOut: status === "in_progress",
    canEdit: status === "confirmed" || status === "in_progress",
    canCancel: status === "confirmed" || status === "in_progress",
  };
}

// Helper formatting functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amount);
}

function formatPhone(phone: string | null): string {
  if (!phone) return "Brak danych";
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

function formatLicensePlate(plate: string | null): string {
  if (!plate) return "Brak danych";
  const cleaned = plate.replace(/\s/g, "").toUpperCase();
  if (cleaned.length >= 5) {
    const firstPart = cleaned.slice(0, cleaned.length - 4);
    const secondPart = cleaned.slice(cleaned.length - 4);
    return `${firstPart} ${secondPart}`;
  }
  return plate.toUpperCase();
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

function calculateDays(checkIn: string, checkOut: string): number {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Ensure we return a valid number
    if (isNaN(days) || days < 0) {
      return 0;
    }

    return days;
  } catch {
    return 0;
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "Potwierdzona",
    in_progress: "W trakcie",
    completed: "Zakończona",
    cancelled: "Anulowana",
    no_show: "Niestawienie",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    confirmed: "blue",
    in_progress: "green",
    completed: "gray",
    cancelled: "red",
    no_show: "orange",
  };
  return colors[status] || "gray";
}

function getFlightDirectionLabel(direction: string | null): string | null {
  if (direction === "departure") return "Wylot";
  if (direction === "arrival") return "Przylot";
  return null;
}

function getFlightDirectionIcon(direction: string | null): string | null {
  if (direction === "departure") return "✈️";
  if (direction === "arrival") return "🛬";
  return null;
}

function getPaymentMethodLabel(method: string | null): string | null {
  if (!method) return null;
  const labels: Record<string, string> = {
    cash: "Gotówka",
    card: "Karta",
    transfer: "Przelew",
  };
  return labels[method] || method;
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    phone: "Telefon",
    walk_in: "Walk-in",
    api: "API",
  };
  return labels[source] || source;
}
