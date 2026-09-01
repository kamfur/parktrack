import type { Tables, TablesInsert, TablesUpdate, Database } from "./db/database.types";

// ############################################################################
//
// ENTITIES
//
// ############################################################################

/**
 * Represents the shape of a reservation record in the database.
 * This type is derived directly from the auto-generated Supabase types.
 */
export type Reservation = Tables<"reservations">;

// ############################################################################
//
// DATA TRANSFER OBJECTS (DTOs)
//
// ############################################################################

/**
 * Data Transfer Object for a reservation, used for API responses.
 * It directly maps to the `Reservation` entity.
 */
export type ReservationDto = Reservation;

/**
 * DTO for the successful creation of a reservation via the external API.
 */
export interface CreateExternalReservationResponseDto {
  reservationId: string;
  message: string;
}

// ############################################################################
//
// COMMAND MODELS
//
// ############################################################################

/**
 * Command model for creating a new reservation through internal endpoints.
 * It selects a subset of fields from the database insert type that are
 * expected from the client, as other fields like `created_by` are set server-side.
 */
export type CreateReservationCommand = Pick<
  TablesInsert<"reservations">,
  | "last_name"
  | "planned_check_in"
  | "planned_check_out"
  | "source"
  | "total_cost"
  | "email"
  | "first_name"
  | "phone"
  | "flight_direction"
  | "license_plate"
  | "notes"
>;

/**
 * Command model for updating an existing reservation.
 * It uses the auto-generated `TablesUpdate` type, where all fields are optional,
 * allowing for partial updates.
 */
export type UpdateReservationCommand = TablesUpdate<"reservations">;
/**
 * Command model for creating a reservation from an external source (e.g., public website).
 * Note the use of camelCase to match the external API's contract.
 * The backend service is responsible for mapping this to the snake_case database schema.
 */
export interface CreateExternalReservationCommand {
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  licensePlate: string;
  checkInDate: string;
  checkOutDate: string;
}

// ############################################################################
//
// DASHBOARD VIEW MODELS
//
// ############################################################################

export type StatsPeriod = 'day' | 'month';

export interface StatsData {
  arrivalsCount: number;
  departuresCount: number;
  occupancyPct: number;
  freeSpots: number;
  totalSpots: number;
  revenue: number;
  period: StatsPeriod;
}

/**
 * ViewModel dla metryk dashboardu.
 * Reprezentuje kluczowe wskaźniki wyświetlane w sekcji metryk.
 */
export interface DashboardMetrics {
  /** Liczba wolnych miejsc parkingowych na dziś */
  availableSpots: number;
  /** Całkowita liczba aktywnych rezerwacji na dziś */
  totalReservations: number;
  /** Liczba zaplanowanych przyjazdów na dziś */
  plannedArrivals: number;
  /** Liczba zaplanowanych wyjazdów na dziś */
  plannedDepartures: number;
}

/**
 * ViewModel dla całego dashboardu.
 * Agreguje wszystkie dane potrzebne do wyrenderowania widoku.
 */
export interface DashboardData {
  /** Metryki dashboardu */
  metrics: DashboardMetrics;
  /** Lista rezerwacji z zaplanowanym check-in na dziś */
  todaysArrivals: ReservationDto[];
  /** Lista rezerwacji z zaplanowanym check-out na dziś */
  todaysDepartures: ReservationDto[];
  /** Statystyki z endpointu /api/stats */
  stats: StatsData | null;
}

/**
 * Command model dla operacji check-in.
 * Aktualizuje status rezerwacji na 'in_progress' i ustawia actual_check_in.
 */
export interface CheckInCommand {
  /** Nowy status rezerwacji */
  status: "in_progress";
  /** Rzeczywisty czas check-in (ISO timestamp) */
  actual_check_in: string;
  /** Opcjonalnie: aktualizacja numeru rejestracyjnego przy check-in */
  license_plate?: string;
}

/**
 * Command model dla operacji check-out.
 * Aktualizuje status rezerwacji na 'completed' i ustawia actual_check_out.
 */
export interface CheckOutCommand {
  /** Nowy status rezerwacji */
  status: "completed";
  /** Rzeczywisty czas check-out (ISO timestamp) */
  actual_check_out: string;
  /** Opcjonalnie: oznaczenie płatności jako zrealizowanej */
  is_paid?: boolean;
}

/**
 * Stan dla hooka useDashboard.
 */
export interface DashboardState {
  /** Dane dashboardu */
  data: DashboardData | null;
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Obiekt błędu, jeśli wystąpił */
  error: Error | null;
  /** Czy operacja check-in/check-out jest w trakcie wykonywania */
  isProcessing: boolean;
}

/**
 * Props dla komponentu MetricCard
 */
export interface MetricCardProps {
  /** Ikona do wyświetlenia (komponent React) */
  icon: React.ReactNode;
  /** Wartość metryki */
  value: number | string;
  /** Etykieta opisowa */
  label: string;
  /** Kolor akcentu dla border-left */
  accentColor: "green" | "blue" | "orange" | "purple";
  /** Czy karta jest w stanie ładowania */
  isLoading?: boolean;
  /** Opcjonalny podtytuł wyświetlany pod wartością */
  subtitle?: string;
}

/**
 * Props dla komponentu ReservationCard
 */
export interface ReservationCardProps {
  /** Obiekt rezerwacji do wyświetlenia */
  reservation: ReservationDto;
  /** Typ akcji dostępnej na karcie */
  actionType: "check-in" | "check-out";
  /** Callback wywoływany po kliknięciu przycisku akcji */
  onAction: (reservationId: string) => Promise<void>;
  /** Czy akcja jest w trakcie wykonywania */
  isLoading?: boolean;
}

// ############################################################################
//
// RESERVATIONS LIST VIEW TYPES
//
// ############################################################################

/**
 * Status rezerwacji - importowany z Database types dla spójności z bazą danych
 */
export type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

/**
 * Źródło rezerwacji - importowane z Database types dla spójności z bazą danych
 */
export type ReservationSource = Database["public"]["Enums"]["reservation_source"];

/**
 * Filtry dla listy rezerwacji
 */
export interface ReservationsListFilters {
  /** Wyszukiwana fraza (nazwisko) */
  search: string;
  /** Zaznaczone statusy (multi-select) */
  statuses: ReservationStatus[];
  /** Wybrane źródło (null = wszystkie) */
  source: ReservationSource | null;
  /** Zakres dat przyjazdu */
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
}

/**
 * Parametry sortowania
 */
export interface SortParams {
  /** Kolumna sortowania */
  column: string;
  /** Kierunek sortowania */
  order: "asc" | "desc";
}

/**
 * Parametry paginacji
 */
export interface PaginationParams {
  /** Numer strony (1-based) */
  page: number;
  /** Liczba wyników na stronę */
  limit: number;
}

/**
 * Pełne parametry zapytania do API
 */
export interface ReservationsQueryParams extends ReservationsListFilters, SortParams, PaginationParams {}

/**
 * Odpowiedź API z listą rezerwacji
 */
export interface ReservationsListResponse {
  /** Lista rezerwacji */
  data: ReservationDto[];
  /** Całkowita liczba wyników (przed paginacją) */
  total: number;
  /** Numer strony */
  page: number;
  /** Liczba wyników na stronę */
  limit: number;
  /** Całkowita liczba stron */
  totalPages: number;
}

/**
 * Stan komponentu ReservationsListContainer
 */
export interface ReservationsListState {
  /** Lista rezerwacji */
  reservations: ReservationDto[];
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Obiekt błędu, jeśli wystąpił */
  error: Error | null;
  /** Aktywne filtry */
  filters: ReservationsListFilters;
  /** Parametry sortowania */
  sort: SortParams;
  /** Parametry paginacji */
  pagination: PaginationParams;
  /** Całkowita liczba wyników */
  total: number;
}

/**
 * Dozwolone kolumny do sortowania
 */
export type SortableColumn =
  | "created_at"
  | "last_name"
  | "planned_check_in"
  | "planned_check_out"
  | "status"
  | "total_cost";

/**
 * ViewModel dla wiersza tabeli rezerwacji
 */
export interface ReservationTableRowViewModel {
  id: string;
  lastName: string;
  phone: string | null;
  formattedPhone: string;
  dateRange: string;
  status: ReservationStatus;
  statusLabel: string;
  statusColor: string;
  totalCost: number;
  formattedCost: string;
  source: ReservationSource;
  sourceLabel: string;
}

/**
 * ViewModel dla karty rezerwacji (mobile)
 */
export interface ReservationCardViewModel {
  id: string;
  lastName: string;
  firstName: string | null;
  fullName: string;
  phone: string | null;
  formattedPhone: string;
  dateRange: string;
  status: ReservationStatus;
  statusLabel: string;
  statusColor: string;
  totalCost: number;
  formattedCost: string;
  source: ReservationSource;
  sourceLabel: string;
}

// ############################################################################
//
// NEW RESERVATION MODAL TYPES
//
// ############################################################################

/**
 * ViewModel dla formularza Quick Mode
 */
export interface QuickReservationFormData {
  lastName: string;
  checkInDate: Date;
  checkOutDate: Date;
}

/**
 * ViewModel dla formularza Full Mode
 * Rozszerza QuickReservationFormData o dodatkowe pola
 */
export interface FullReservationFormData extends QuickReservationFormData {
  firstName: string;
  email: string;
  phone: string;
  licensePlate: string;
  flightDirection: "departure" | "arrival" | null;
  notes: string;
}

/**
 * Props dla komponentu NewReservationModal
 */
export interface NewReservationModalProps {
  /** Czy modal jest otwarty */
  isOpen: boolean;
  /** Callback zamknięcia modala */
  onClose: () => void;
  /** Callback po pomyślnym utworzeniu rezerwacji */
  onSuccess: (reservation: ReservationDto) => void;
  /** Domyślny tryb formularza (default: 'quick') */
  defaultMode?: "quick" | "full";
}

/**
 * Stan wewnętrzny komponentu NewReservationModal
 */
export interface NewReservationModalState {
  /** Aktywny tryb formularza */
  mode: "quick" | "full";
  /** Czy formularz jest w trakcie wysyłania */
  isSubmitting: boolean;
}

/**
 * Props dla QuickReservationForm
 */
export interface QuickReservationFormProps {
  /** Callback submit formularza */
  onSubmit: (data: QuickReservationFormData) => Promise<void>;
  /** Callback przełączenia do trybu Full z danymi z Quick Mode */
  onSwitchToFull: (data: QuickReservationFormData) => void;
  /** Czy formularz jest w trakcie wysyłania */
  isSubmitting: boolean;
}

/**
 * Props dla FullReservationForm
 */
export interface FullReservationFormProps {
  /** Początkowe dane formularza (z Quick Mode) */
  initialData?: Partial<FullReservationFormData>;
  /** Callback submit formularza */
  onSubmit: (data: FullReservationFormData) => Promise<void>;
  /** Callback powrotu do trybu Quick */
  onSwitchToQuick: () => void;
  /** Czy formularz jest w trakcie wysyłania */
  isSubmitting: boolean;
}

/**
 * Props dla CostPreview
 */
export interface CostPreviewProps {
  /** Data przyjazdu */
  checkInDate: Date | null;
  /** Data wyjazdu */
  checkOutDate: Date | null;
  /** Czy koszt jest w trakcie obliczania */
  isCalculating: boolean;
}

/**
 * Props dla AvailabilityIndicator
 */
export interface AvailabilityIndicatorProps {
  /** Data przyjazdu */
  checkInDate: Date | null;
  /** Data wyjazdu */
  checkOutDate: Date | null;
  /** Czy sprawdzanie dostępności jest w trakcie */
  isChecking: boolean;
}

/**
 * Response z API sprawdzającego dostępność miejsc
 */
export interface AvailabilityCheckResponse {
  /** Czy są wolne miejsca */
  available: boolean;
  /** Liczba wolnych miejsc */
  availableSpots: number;
  /** Całkowita liczba miejsc */
  totalSpots: number;
}

/**
 * Response z API obliczającego koszt rezerwacji
 */
export interface CostCalculationResponse {
  /** Całkowity koszt rezerwacji */
  totalCost: number;
  /** Liczba dni */
  days: number;
  /** Koszt za dzień */
  costPerDay: number;
}

/**
 * Stan hooka useAvailabilityCheck
 */
export interface UseAvailabilityCheckResult {
  /** Liczba wolnych miejsc (null jeśli nie sprawdzano) */
  availableSpots: number | null;
  /** Czy miejsca są dostępne */
  isAvailable: boolean;
  /** Czy sprawdzanie jest w trakcie */
  isChecking: boolean;
  /** Błąd sprawdzania */
  error: Error | null;
}

/**
 * Stan hooka useCostCalculation
 */
export interface UseCostCalculationResult {
  /** Obliczony koszt (null jeśli nie obliczano) */
  estimatedCost: number | null;
  /** Liczba dni */
  days: number;
  /** Czy obliczanie jest w trakcie */
  isCalculating: boolean;
  /** Błąd obliczania */
  error: Error | null;
}

// ############################################################################
//
// RESERVATION DETAILS VIEW TYPES
//
// ############################################################################

/**
 * Props dla głównego kontenera widoku szczegółów
 */
export interface ReservationDetailsViewProps {
  /** ID rezerwacji do wyświetlenia */
  reservationId: string;
  /** Czy widok jest otwarty (dla modal mode) */
  isOpen: boolean;
  /** Callback zamknięcia widoku */
  onClose: () => void;
  /** Callback po aktualizacji rezerwacji */
  onUpdate?: (reservation: ReservationDto) => void;
}

/**
 * Stan wewnętrzny widoku szczegółów
 */
export interface ReservationDetailsViewState {
  /** Dane rezerwacji */
  reservation: ReservationDto | null;
  /** Czy dane są w trakcie ładowania */
  isLoading: boolean;
  /** Błąd pobrania danych */
  error: Error | null;
  /** Czy widok jest w trybie edycji */
  isEditMode: boolean;
  /** Czy operacja jest w trakcie (check-in, check-out, etc.) */
  isProcessing: boolean;
  /** Czy są niezapisane zmiany */
  isDirty: boolean;
}

/**
 * Event w timeline historii rezerwacji
 */
export interface TimelineEvent {
  /** Typ eventu */
  type: "created" | "updated" | "check_in" | "check_out" | "cancelled" | "status_changed";
  /** Timestamp eventu (ISO string) */
  timestamp: string;
  /** Osoba wykonująca akcję */
  performedBy: string | null;
  /** Dodatkowe szczegóły */
  details?: string;
  /** Zmiany w polach (dla type = 'updated') */
  changes?: Record<string, { old: any; new: any }>;
}

/**
 * ViewModel dla danych finansowych
 */
export interface FinancialInfoViewModel {
  /** Całkowity koszt */
  totalCost: number;
  /** Sformatowany koszt (z walutą) */
  formattedCost: string;
  /** Czy opłacone */
  isPaid: boolean;
  /** Label statusu płatności */
  paymentStatusLabel: string;
  /** Kolor statusu płatności */
  paymentStatusColor: "success" | "warning";
  /** Forma płatności */
  paymentMethod: "cash" | "card" | "transfer" | null;
  /** Label formy płatności */
  paymentMethodLabel: string | null;
  /** Źródło rezerwacji */
  source: ReservationSource;
  /** Label źródła */
  sourceLabel: string;
}

/**
 * ViewModel dla szczegółów rezerwacji
 */
export interface ReservationDetailsViewModel {
  /** ID rezerwacji */
  id: string;
  /** Pełne imię i nazwisko */
  fullName: string;
  /** Status rezerwacji */
  status: ReservationStatus;
  /** Label statusu */
  statusLabel: string;
  /** Kolor statusu */
  statusColor: string;
  /** Email */
  email: string | null;
  /** Sformatowany email dla display */
  emailDisplay: string;
  /** Telefon */
  phone: string | null;
  /** Sformatowany telefon */
  phoneDisplay: string;
  /** Numer rejestracyjny */
  licensePlate: string | null;
  /** Sformatowany nr rejestracyjny */
  licensePlateDisplay: string;
  /** Data przyjazdu */
  plannedCheckIn: string;
  /** Sformatowana data przyjazdu */
  checkInDisplay: string;
  /** Data wyjazdu */
  plannedCheckOut: string;
  /** Sformatowana data wyjazdu */
  checkOutDisplay: string;
  /** Liczba dni */
  days: number;
  /** Kierunek lotu */
  flightDirection: "departure" | "arrival" | null;
  /** Label kierunku lotu */
  flightDirectionLabel: string | null;
  /** Ikona kierunku lotu */
  flightDirectionIcon: string | null;
  /** Dane finansowe */
  financial: FinancialInfoViewModel;
  /** Notatki */
  notes: string | null;
  /** Timeline events */
  timeline: TimelineEvent[];
  /** Dostępne akcje */
  availableActions: {
    canCheckIn: boolean;
    canCheckOut: boolean;
    canEdit: boolean;
    canCancel: boolean;
  };
}

/**
 * Reguły edycji warunkowej według statusu
 */
export interface ConditionalEditRules {
  /** Czy można edytować daty przyjazdu */
  canEditCheckIn: boolean;
  /** Czy można edytować daty wyjazdu */
  canEditCheckOut: boolean;
  /** Czy można edytować dane osobowe */
  canEditPersonalInfo: boolean;
  /** Czy można edytować dane pojazdu */
  canEditVehicleInfo: boolean;
  /** Czy można edytować notatki */
  canEditNotes: boolean;
}

/**
 * Props dla DetailHeader
 */
export interface DetailHeaderProps {
  firstName: string | null;
  lastName: string;
  status: ReservationStatus;
  onClose: () => void;
}

/**
 * Props dla PersonalInfoCard
 */
export interface PersonalInfoCardProps {
  email: string | null;
  phone: string | null;
  licensePlate: string | null;
}

/**
 * Props dla ReservationDetailsCard
 */
export interface ReservationDetailsCardProps {
  plannedCheckIn: string;
  plannedCheckOut: string;
  flightDirection: "departure" | "arrival" | null;
}

/**
 * Props dla FinancialSection
 */
export interface FinancialSectionProps {
  totalCost: number;
  isPaid: boolean;
  paymentMethod: "cash" | "card" | "transfer" | null;
  source: ReservationSource;
}

/**
 * Props dla NotesSection
 */
export interface NotesSectionProps {
  reservationId: string;
  initialNotes: string | null;
  isEditable: boolean;
  onSave: (notes: string) => Promise<void>;
}

/**
 * Props dla TimelineSection
 */
export interface TimelineSectionProps {
  events: TimelineEvent[];
  isCollapsed?: boolean;
}

/**
 * Props dla TimelineEvent component
 */
export interface TimelineEventProps {
  event: TimelineEvent;
}

/**
 * Props dla ActionFooter
 */
export interface ActionFooterProps {
  reservationId: string;
  status: ReservationStatus;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onEdit: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

// ############################################################################
//
// AUTH DTOs / COMMANDS
//
// ############################################################################

export interface AuthUserDTO {
  id: string;
  email: string;
}

export interface LoginCommand {
  email: string;
  password: string;
}

export interface RegisterCommand {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordCommand {
  email: string;
}

export interface ResetPasswordCommand {
  password: string;
  confirmPassword: string;
  accessToken?: string;
}

// ############################################################################
//
// INVOICE TYPES
//
// ############################################################################

export interface InvoiceDto {
  id: string;
  reservation_id: string;
  invoice_number: string;
  invoice_year: number;
  invoice_month: number;
  invoice_seq: number;
  seller_name: string;
  seller_address: string;
  seller_nip: string;
  seller_bank_account: string;
  buyer_name: string;
  buyer_nip: string;
  buyer_address: string;
  buyer_email: string | null;
  total_amount: number;
  days_count: number;
  daily_rate_snapshot: number;
  created_at: string;
  created_by: string;
}

export interface CreateInvoiceCommand {
  reservation_id: string;
  buyer_name: string;
  buyer_nip: string;
  buyer_address: string;
  buyer_email?: string;
}

export interface AuthErrorResponse {
  error: string;
  details?: unknown;
}

export interface AuthSuccessResponse {
  user?: AuthUserDTO;
  message?: string;
}
