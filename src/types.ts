import type { Tables, TablesInsert, TablesUpdate, Database } from "./db/database.types";
import type {
  QuickReservationFormData,
  FullReservationFormData,
  EditReservationFormData,
  ChangeReturnDateFormData,
} from "./lib/schemas/reservation.schema";
import type { AppRole } from "./lib/auth/resolve-app-role";
import type { ParkingType } from "./lib/pricing/parking-type";
import type { PriceListRates } from "./lib/pricing/price-list";
import type { SavePriceListCommand } from "./lib/schemas/price-list.schema";
import type { SaveTravelAgencyCommand, SaveTravelAgencyInput } from "./lib/schemas/travel-agency.schema";
import type { VoiceFieldKey } from "./lib/voice/merge";
import type { ParsedVoiceFields } from "./lib/voice/types";
import type {
  CalendarRangeQuery,
  DriverShiftFormData,
  DriverShiftWrite,
  ShiftRangeQuery,
} from "./lib/schemas/calendar.schema";

export type {
  QuickReservationFormData,
  FullReservationFormData,
  EditReservationFormData,
  ChangeReturnDateFormData,
  AppRole,
  CalendarRangeQuery,
  DriverShiftFormData,
  DriverShiftWrite,
  ShiftRangeQuery,
  ParkingType,
  PriceListRates,
  SavePriceListCommand,
  SaveTravelAgencyCommand,
  SaveTravelAgencyInput,
};

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

export interface KtwArrivalHourDto {
  scheduled_at: string;
  origin_label: string;
  /** Official board status (current time or delay); omit when the board left it blank. */
  status?: string;
}

/** Departure list row: reservation fields plus optional in-memory KTW hours (not a DB column). */
export interface DepartureListItem extends ReservationDto {
  ktw_arrival_hours?: KtwArrivalHourDto[];
  /** Assigned garage/carport spot name, resolved client-side for garage reservations (not a DB column). */
  garage_spot_name?: string | null;
}

export type DriverShiftDto = Tables<"driver_shifts">;

/** A staff-configured garage/carport unit. Single/double is a capacity label, not a sub-spot hierarchy. */
export type GarageSpotDto = Tables<"garage_spots">;

/**
 * Price list for a validity period; `rates` holds one row per parking type.
 */
export interface PriceListDto {
  id: string;
  /** YYYY-MM-DD */
  valid_from: string;
  /** YYYY-MM-DD, null = open-ended */
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  rates: PriceListRates;
}

/** Travel agency billed monthly for its clients; `archived_at` set = hidden from reservation pickers. */
export type TravelAgencyDto = Tables<"travel_agencies">;

/**
 * How a reservation counts for the agency's billing month:
 * invoiceable (arrived) · blocking (arrival not confirmed) · excluded (cancelled / no-show) · invoiced.
 */
export type AgencyMonthCategory = "invoiceable" | "blocking" | "excluded" | "invoiced";

/** Row of `agency_month_summary` (net/VAT/gross null for blocking and excluded rows). */
export interface AgencyMonthRowDto {
  reservation_id: string;
  last_name: string;
  first_name: string | null;
  license_plate: string | null;
  planned_check_in: string;
  planned_check_out: string;
  status: ReservationStatus;
  actual_check_in: string | null;
  actual_check_out: string | null;
  parking_type: string;
  total_cost: number;
  category: AgencyMonthCategory;
  invoice_id: string | null;
  invoice_number: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
}

export interface AgencyMonthSummaryDto {
  /** `YYYY-MM` */
  month: string;
  rows: AgencyMonthRowDto[];
  /** Amount to invoice (invoiceable rows only) */
  totals: { net: number; vat: number; gross: number };
  counts: Record<AgencyMonthCategory, number>;
  /** The Warsaw month has ended — invoicing is possible */
  monthClosed: boolean;
  /** The agency's invoice for this month, if already issued */
  invoice: { id: string; invoice_number: string } | null;
}

/** A reservation-to-garage-spot assignment; `superseded_at: null` means it is the currently active one. */
export type GarageAssignmentDto = Tables<"garage_assignments">;

/** Descriptive (non-applied) downtime-reduction suggestion for a garage spot. */
export interface GarageOptimizationSuggestionDto {
  garageSpotId: string;
  description: string;
}

/** One active garage assignment, denormalized for the occupancy view. */
export interface GarageOccupancyEntryDto {
  assignmentId: string;
  garageSpotId: string;
  garageSpotName: string;
  reservationId: string;
  lastName: string;
  plannedCheckIn: string;
  plannedCheckOut: string;
}

export interface CalendarEventDto {
  kind: "arrival" | "departure";
  at: string;
  reservationId: string;
  firstName: string | null;
  lastName: string;
  licensePlate: string | null;
  status: "confirmed" | "in_progress" | "completed";
  handled: boolean;
  parkingType: ParkingType;
  /** Free-text flight direction (e.g. "Londyn, LO 392"); shown on departure chips. */
  flightDirection: string | null;
  /** Client left the car keys at arrival; shown on arrival and departure chips. */
  keysLeft: boolean;
  /** Staff notes of the reservation, shown on the chip. */
  notes: string | null;
  /** Assigned garage/carport spot name, resolved client-side (not part of the API response). */
  garageSpotName?: string | null;
}

export interface CalendarMonthDayDto {
  date: string;
  arrivals: number;
  departures: number;
  occupancy: number;
}

export interface CalendarDriverDto {
  id: string;
  email: string;
}

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
export type CreateReservationCommand = Omit<
  Pick<
    TablesInsert<"reservations">,
    | "last_name"
    | "planned_check_in"
    | "planned_check_out"
    | "source"
    | "email"
    | "first_name"
    | "phone"
    | "flight_direction"
    | "license_plate"
    | "notes"
    | "parking_type"
    | "travel_agency_id"
    | "vehicle_count"
    | "extra_license_plates"
  >,
  never
> & {
  /** Optional — server calculates when omitted */
  total_cost?: number;
  /** Chosen garage/carport spot (covered types); omitted = auto-assign. Not a reservations column. */
  garage_spot_id?: string;
};

/**
 * Command model for creating a garage/carport spot (configurator).
 */
export type CreateGarageSpotCommand = Pick<TablesInsert<"garage_spots">, "name" | "spot_type" | "capacity_label"> & {
  is_available?: boolean;
};

/**
 * Command model for updating a garage/carport spot (partial update).
 */
export type UpdateGarageSpotCommand = TablesUpdate<"garage_spots">;

/**
 * Command model for updating an existing reservation.
 * It uses the auto-generated `TablesUpdate` type, where all fields are optional,
 * allowing for partial updates.
 */
export type UpdateReservationCommand = TablesUpdate<"reservations"> & {
  /** Move to this garage/carport spot — handled via garage_assignments, not a reservations column. */
  garage_spot_id?: string;
};
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
  licensePlate?: string;
  checkInDate: string;
  checkOutDate: string;
}

// ############################################################################
//
// DASHBOARD VIEW MODELS
//
// ############################################################################

export type StatsPeriod = "day" | "month";

export interface StatsData {
  arrivalsCount: number;
  departuresCount: number;
  occupancyPct: number;
  freeSpots: number;
  totalSpots: number;
  revenue: number;
  /** Nie-anulowane rezerwacje utworzone w okresie */
  reservationsCount: number;
  /** Miejsca garażowe zajęte teraz (aktywny przydział + auto na parkingu) */
  garageOccupiedSpots: number;
  /** Dostępne miejsca garażowe */
  garageTotalSpots: number;
  garageOccupancyPct: number;
  period: StatsPeriod;
}

export type AnalyticsGranularity = "day" | "month";

export interface AnalyticsRevenuePoint {
  /** Klucz kubełka: YYYY-MM-DD (dzień) lub YYYY-MM (miesiąc) */
  bucket: string;
  revenue: number;
}

export interface AnalyticsOccupancyPoint {
  bucket: string;
  /** Średnia liczba zajętych miejsc w kubełku */
  occupied: number;
  occupancyPct: number;
  /** true, gdy kubełek leży w przyszłości (prognoza z rezerwacji potwierdzonych) */
  forecast: boolean;
}

export interface AnalyticsBreakdownItem {
  key: string;
  count: number;
}

export interface AnalyticsAgencyItem {
  id: string;
  name: string;
  stays: number;
  revenue: number;
}

/** Odpowiedź /api/stats/analytics dla strony /statystyki. */
export interface AnalyticsData {
  range: { from: string; to: string; granularity: AnalyticsGranularity };
  revenue: {
    total: number;
    previousTotal: number;
    /** null, gdy poprzedni okres miał zerowy przychód */
    changePct: number | null;
    avgPerReservation: number;
    avgPerDay: number;
    series: AnalyticsRevenuePoint[];
  };
  occupancy: {
    totalSpots: number;
    peakPct: number;
    series: AnalyticsOccupancyPoint[];
  };
  quality: {
    /** Rezerwacje z planowanym przyjazdem w zakresie (wszystkie statusy) */
    total: number;
    cancelled: number;
    noShow: number;
    cancelledPct: number;
    noShowPct: number;
  };
  /** Zakończone pobyty klientów indywidualnych z przyjazdem w zakresie, nadal nieopłacone */
  receivables: { count: number; amount: number };
  topAgencies: AnalyticsAgencyItem[];
  breakdown: {
    parkingType: AnalyticsBreakdownItem[];
    source: AnalyticsBreakdownItem[];
    customerType: AnalyticsBreakdownItem[];
    stayLength: AnalyticsBreakdownItem[];
  };
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
  /** Przyjazdy na dziś (Warsaw) oraz zaległe, jeszcze nieprzyjęte */
  todaysArrivals: ReservationDto[];
  /** Wyjazdy na dziś (Warsaw) oraz opóźnione powroty bez check-out */
  todaysDepartures: DepartureListItem[];
  /** Przyjęte auta: dziś (Warsaw) lub w ostatnich 12h — jak "Obsłużone" w panelu kierowcy */
  handledArrivals: DepartureListItem[];
  /** Wydane auta: dziś (Warsaw) lub w ostatnich 12h */
  handledDepartures: DepartureListItem[];
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
  accentColor: "green" | "blue" | "orange" | "purple" | "teal" | "indigo";
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
  reservation: DepartureListItem;
  /** Typ akcji dostępnej na karcie */
  actionType: "check-in" | "check-out";
  /** Callback otwierający formularz przyjęcia / wyjazdu */
  onAction: (reservation: ReservationDto) => void;
  /** Anulowanie rezerwacji z listy przyjazdów */
  onCancel?: (reservation: ReservationDto) => void;
  /** Zmiana planowanej daty powrotu z listy wyjazdów */
  onChangeReturnDate?: (reservation: ReservationDto) => void;
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
// (QuickReservationFormData / FullReservationFormData — re-exported at top from Zod schemas)
//
// ############################################################################

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
  /** Dyktowanie: przełącza do trybu Full z bieżącymi danymi i listą pól zmienionych ręcznie */
  onStartVoice?: (
    data: Partial<QuickReservationFormData>,
    manualFields: readonly ("lastName" | "checkIn" | "checkOut")[]
  ) => void;
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
  /** Dyktowanie: rozpoznane pola i pola już wpisane ręcznie (nie nadpisywane głosem) */
  voice?: {
    parsed: ParsedVoiceFields;
    initialManual?: readonly VoiceFieldKey[];
  };
  /** Czy formularz jest w trakcie wysyłania */
  isSubmitting: boolean;
}

/**
 * Props dla EditReservationForm
 */
export interface EditReservationFormProps {
  reservation: ReservationDto;
  editRules: ConditionalEditRules;
  /** Currently assigned garage/carport spot, preselected in the spot picker. */
  currentGarageSpotId?: string | null;
  onSubmit: (data: EditReservationFormData) => Promise<void>;
  onCancel: () => void;
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
  /** Typ miejsca — wybiera wiersz cennika (domyślnie parking) */
  parkingType?: ParkingType;
  /** Biuro podróży — cena po jego rabacie, płaci biuro */
  travelAgencyId?: string | null;
  /** Liczba aut — cena = cena za auto × liczba aut (domyślnie 1) */
  vehicleCount?: number;
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
  /** Cena z cennika przed rabatem biura */
  baseCost: number;
  /** Rabat biura podróży w % (0 bez biura) */
  discountPct: number;
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
  /** Cena z cennika przed rabatem biura (null jeśli nie obliczano) */
  baseCost: number | null;
  /** Rabat biura w % (0 bez biura) */
  discountPct: number;
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
  /** Otwórz od razu w trybie edycji (np. z listy rezerwacji) */
  initialEditMode?: boolean;
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
  flightDirection: string | null;
  /** Label kierunku lotu */
  flightDirectionLabel: string | null;
  /** Ikona kierunku lotu */
  flightDirectionIcon: string | null;
  /** Nazwa przydzielonego miejsca garażowego (null dla zwykłych miejsc parkingowych) */
  garageSpotLabel: string | null;
  /** Ikona oznaczająca przydział garażowy */
  garageSpotIcon: string | null;
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
  /** Czy można zmienić biuro podróży (płatnika) */
  canEditTravelAgency: boolean;
  /** Czy można zmienić typ miejsca (parking / wiata / garaż) — w każdym statusie, poza fakturą */
  canEditParkingType: boolean;
  /** Czy można zmienić „Zostawił kluczyki” — tylko gdy auto stoi na parkingu (in_progress) */
  canEditKeysLeft: boolean;
  /** Czy można zmienić „Opłacono przy przyjeździe/wyjeździe” (nie dla biur podróży) */
  canEditPayment: boolean;
  /** Numer faktury, na której jest rezerwacja — pola rozliczeniowe są wtedy zablokowane */
  lockedByInvoiceNumber: string | null;
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
  /** Numery aut 2..N */
  extraLicensePlates?: string[];
  /** Liczba aut w rezerwacji (domyślnie 1) */
  vehicleCount?: number;
}

/**
 * Props dla ReservationDetailsCard
 */
export interface ReservationDetailsCardProps {
  plannedCheckIn: string;
  plannedCheckOut: string;
  flightDirection: string | null;
  garageSpotLabel?: string | null;
  /** Klient zostawił kluczyki — widoczne, gdy auto jest przyjęte */
  keysLeft?: boolean;
}

/**
 * Props dla FinancialSection
 */
export interface FinancialSectionProps {
  totalCost: number;
  isPaid: boolean;
  paymentMethod: "cash" | "card" | "transfer" | null;
  source: ReservationSource;
  /** Paying travel agency (name), when the stay is billed to an agency */
  travelAgencyName?: string | null;
  /** Agency discount snapshot in % */
  agencyDiscountPct?: number | null;
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
  /** Marks a confirmed reservation as no-show (client never arrived) */
  onNoShow: () => void;
  /** Reverts a cancelled reservation back to confirmed (re-assigning a free garage spot if needed) */
  onRestore: () => void;
  isProcessing: boolean;
  existingInvoiceId: string | null;
  /** Agency reservations are billed on the agency's monthly invoice, never individually */
  isAgencyReservation: boolean;
}

// ############################################################################
//
// AUTH DTOs / COMMANDS
//
// ############################################################################

export interface AuthUserDTO {
  id: string;
  email: string;
  role: AppRole;
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

/**
 * Pozycja faktury — snapshot rezerwacji z chwili wystawienia.
 * net_amount / vat_amount są null na fakturach sprzed rozbicia VAT (legacy).
 */
export type InvoiceItemDto = Tables<"invoice_items">;

export interface InvoiceDto {
  id: string;
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
  /** Kwota brutto (suma pozycji) */
  total_amount: number;
  total_net: number | null;
  total_vat: number | null;
  /** Stawka VAT w %; null = faktura legacy (tylko brutto) */
  vat_rate: number | null;
  issue_date: string;
  sale_date: string | null;
  payment_due_date: string | null;
  travel_agency_id: string | null;
  billing_year: number | null;
  billing_month: number | null;
  created_at: string;
  created_by: string;
  /** Pozycje w kolejności `position` */
  items: InvoiceItemDto[];
}

/**
 * Dozwolone kolumny do sortowania listy faktur
 */
export type InvoiceSortableColumn = "created_at" | "invoice_number" | "buyer_name" | "total_amount";

/**
 * Parametry zapytania o listę faktur
 */
export interface InvoicesQueryParams {
  /** Wyszukiwanie po numerze faktury lub nabywcy */
  search: string;
  /** Kolumna sortowania */
  sortBy: InvoiceSortableColumn;
  /** Kierunek sortowania */
  sortOrder: "asc" | "desc";
  /** Numer strony (1-based) */
  page: number;
  /** Liczba wyników na stronę */
  limit: number;
}

/**
 * Odpowiedź API z listą faktur
 */
export interface InvoicesListResponse {
  /** Lista faktur */
  data: InvoiceDto[];
  /** Całkowita liczba wyników (przed paginacją) */
  total: number;
  /** Numer strony */
  page: number;
  /** Liczba wyników na stronę */
  limit: number;
  /** Całkowita liczba stron */
  totalPages: number;
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
