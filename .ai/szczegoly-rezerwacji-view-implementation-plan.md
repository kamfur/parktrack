# Plan implementacji widoku Szczegóły Rezerwacji

## 1. Przegląd

Widok Szczegółów Rezerwacji to modal (desktop) lub full-page (mobile) wyświetlający pełne informacje o wybranej rezerwacji wraz z możliwością edycji, historią zmian (timeline) oraz dostępnymi akcjami zależnymi od statusu rezerwacji. Widok jest kluczowy dla obsługi klienta, umożliwiając pracownikom parkingu dostęp do wszystkich danych rezerwacji oraz ich modyfikację zgodnie z regułami biznesowymi.

Główne cele widoku:
- Wyświetlenie wszystkich danych rezerwacji w przejrzysty sposób
- Umożliwienie edycji danych z warunkami zależnymi od statusu
- Wyświetlenie historii zmian (audit log) w formie timeline
- Udostępnienie akcji kontekstowych (Check-in, Check-out, Edytuj, Anuluj)
- Zapewnienie łatwego dostępu do kontaktu z klientem (click-to-call, click-to-email)

## 2. Routing widoku

Widok dostępny pod dwoma mechanizmami routingu:

### Wariant A: Dedykowana strona (preferowany dla SEO i deep linking)
```
/rezerwacje/[id]
```
Przykład: `/rezerwacje/123e4567-e89b-12d3-a456-426614174000`

### Wariant B: Query parameter (alternatywny)
```
/rezerwacje?id=[uuid]
```

### Triggery otwarcia widoku:
1. Kliknięcie w wiersz tabeli w `/rezerwacje`
2. Kliknięcie w kartę rezerwacji na dashboard
3. Kliknięcie w link z notyfikacji/wyszukiwania
4. Bezpośrednia nawigacja przez URL

### Implementacja routingu:
- Desktop: Modal z zachowaniem URL (dialog overlay)
- Mobile: Full-page navigation z animacją slide-in
- Obsługa przycisku "Wstecz" przeglądarki
- Keyboard: Esc zamyka i cofa do poprzedniego widoku

## 3. Struktura komponentów

```
ReservationDetailsView (Page/Modal Container)
├── DetailHeader
│   ├── FullNameDisplay
│   ├── StatusBadge
│   └── CloseButton
│
├── DetailContent (Scrollable)
│   ├── InfoSection
│   │   ├── PersonalInfoCard
│   │   │   ├── EmailLink (click-to-email)
│   │   │   ├── PhoneLink (click-to-call)
│   │   │   └── LicensePlateDisplay
│   │   │
│   │   └── ReservationDetailsCard
│   │       ├── DateRangeDisplay
│   │       ├── DaysCountDisplay
│   │       └── FlightDirectionBadge
│   │
│   ├── FinancialSection
│   │   ├── TotalCostDisplay
│   │   ├── PaymentStatusBadge
│   │   └── SourceBadge
│   │
│   ├── NotesSection
│   │   ├── NotesTextarea (editable z auto-save)
│   │   └── SaveIndicator
│   │
│   └── TimelineSection
│       ├── TimelineToggle (collapsible)
│       └── TimelineEventsList
│           └── TimelineEvent (n razy)
│               ├── EventIcon
│               ├── EventTitle
│               ├── EventTimestamp
│               └── EventDetails (conditional)
│
└── ActionFooter
    ├── CheckInButton (conditional)
    ├── CheckOutButton (conditional)
    ├── EditButton (conditional)
    └── CancelButton (conditional)
```

## 4. Szczegóły komponentów

### ReservationDetailsView
**Opis:** Główny kontener widoku szczegółów rezerwacji. Odpowiedzialny za pobranie danych rezerwacji, zarządzanie stanem edycji oraz obsługę akcji.

**Główne elementy:**
- Dialog wrapper (desktop) lub Page wrapper (mobile)
- Loading skeleton podczas ładowania danych
- Error state jeśli rezerwacja nie istnieje
- Backdrop blur (desktop)

**Obsługiwane interakcje:**
- Zamknięcie widoku (X button, Esc, backdrop click)
- Pobranie danych rezerwacji przy montowaniu
- Real-time subscriptions do zmian rezerwacji
- Dirty state tracking przed zamknięciem
- Navigation guard przy niezapisanych zmianach

**Obsługiwana walidacja:**
- Walidacja UUID rezerwacji
- Sprawdzenie istnienia rezerwacji (404 handling)
- Walidacja uprawnień do odczytu (future)

**Typy:**
- `ReservationDetailsViewProps`
- `ReservationDetailsViewState`
- `ReservationDto`

**Propsy:**
```typescript
interface ReservationDetailsViewProps {
  reservationId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (reservation: ReservationDto) => void;
}
```

### DetailHeader
**Opis:** Nagłówek widoku wyświetlający imię i nazwisko klienta oraz status rezerwacji.

**Główne elementy:**
- H1 z pełnym imieniem i nazwiskiem
- StatusBadge w prawym górnym rogu
- CloseButton (X icon)

**Obsługiwane interakcje:**
- Kliknięcie w CloseButton zamyka widok
- Hover na StatusBadge pokazuje tooltip z opisem statusu

**Typy:**
- `DetailHeaderProps`

**Propsy:**
```typescript
interface DetailHeaderProps {
  firstName: string | null;
  lastName: string;
  status: ReservationStatus;
  onClose: () => void;
}
```

### PersonalInfoCard
**Opis:** Karta wyświetlająca dane osobowe klienta (email, telefon, nr rejestracyjny).

**Główne elementy:**
- Email z ikoną i linkiem `mailto:`
- Telefon z ikoną i linkiem `tel:`
- Numer rejestracyjny z ikoną
- Każde pole w osobnym wierszu z ikoną po lewej

**Obsługiwane interakcje:**
- Kliknięcie w email otwiera klienta pocztowego
- Kliknięcie w telefon inicjuje połączenie
- Kliknięcie w nr rej. kopiuje do schowka (z toast feedback)

**Obsługiwana walidacja:**
- Display "Brak danych" dla pustych pól opcjonalnych
- Formatowanie telefonu (spacje co 3 cyfry)
- Formatowanie nr rej. (uppercase, spacja po kodzie)

**Typy:**
- `PersonalInfoCardProps`

**Propsy:**
```typescript
interface PersonalInfoCardProps {
  email: string | null;
  phone: string | null;
  licensePlate: string | null;
}
```

### ReservationDetailsCard
**Opis:** Karta wyświetlająca szczegóły rezerwacji (daty, liczba dni, kierunek lotu).

**Główne elementy:**
- Data przyjazdu z ikoną kalendarza
- Data wyjazdu z ikoną kalendarza
- Liczba dni (obliczona)
- Kierunek lotu (badge z ikoną)

**Obsługiwane interakcje:**
- Brak interakcji (read-only display)

**Typy:**
- `ReservationDetailsCardProps`

**Propsy:**
```typescript
interface ReservationDetailsCardProps {
  plannedCheckIn: string;
  plannedCheckOut: string;
  flightDirection: 'departure' | 'arrival' | null;
}
```

### FinancialSection
**Opis:** Sekcja wyświetlająca informacje finansowe rezerwacji.

**Główne elementy:**
- Całkowity koszt (duża czcionka, bold)
- Status płatności (badge: Opłacone/Nieopłacone)
- Źródło rezerwacji (badge: Telefon/Walk-in/API)
- Forma płatności (jeśli is_paid = true)

**Obsługiwane interakcje:**
- Brak interakcji (read-only display)

**Typy:**
- `FinancialSectionProps`

**Propsy:**
```typescript
interface FinancialSectionProps {
  totalCost: number;
  isPaid: boolean;
  paymentMethod: 'cash' | 'card' | 'transfer' | null;
  source: ReservationSource;
}
```

### NotesSection
**Opis:** Sekcja z notatkami o rezerwacji, edytowalna z auto-save.

**Główne elementy:**
- Label "Notatki"
- Textarea z auto-resize
- Save indicator (saving/saved)

**Obsługiwane interakcje:**
- Edycja notatek (textarea)
- Debounced auto-save (1000ms)
- Ctrl+S force save
- Optimistic update

**Obsługiwana walidacja:**
- Max length: 1000 znaków
- Character counter przy zbliżaniu się do limitu

**Typy:**
- `NotesSectionProps`

**Propsy:**
```typescript
interface NotesSectionProps {
  reservationId: string;
  initialNotes: string | null;
  isEditable: boolean;
  onSave: (notes: string) => Promise<void>;
}
```

### TimelineSection
**Opis:** Sekcja wyświetlająca historię zmian rezerwacji w formie pionowego timeline.

**Główne elementy:**
- Collapsible toggle "Historia"
- Lista eventów (TimelineEvent)
- Pusta linia między eventami
- Color-coded ikony

**Obsługiwane interakcje:**
- Kliknięcie w toggle rozwija/zwija timeline
- Domyślnie rozwinięte

**Typy:**
- `TimelineSectionProps`
- `TimelineEvent`

**Propsy:**
```typescript
interface TimelineSectionProps {
  events: TimelineEvent[];
  isCollapsed?: boolean;
}

interface TimelineEvent {
  type: 'created' | 'updated' | 'check_in' | 'check_out' | 'cancelled' | 'status_changed';
  timestamp: string;
  performedBy: string | null;
  details?: string;
  changes?: Record<string, { old: any; new: any }>;
}
```

### TimelineEvent
**Opis:** Pojedynczy event w timeline.

**Główne elementy:**
- Kolorowa kropka (color-coded według typu)
- Tytuł eventu
- Timestamp (data + godzina)
- Performer (kto wykonał)
- Szczegóły zmian (jeśli type = 'updated')

**Obsługiwane interakcje:**
- Hover pokazuje pełne szczegóły zmian (tooltip)

**Typy:**
- `TimelineEventProps`

**Propsy:**
```typescript
interface TimelineEventProps {
  event: TimelineEvent;
}
```

### ActionFooter
**Opis:** Footer z akcjami kontekstowymi zależnymi od statusu rezerwacji.

**Główne elementy:**
- CheckInButton (tylko dla status = 'confirmed')
- CheckOutButton (tylko dla status = 'in_progress')
- EditButton (conditional based on status)
- CancelButton (conditional based on status)

**Obsługiwane interakcje:**
- Kliknięcie w CheckIn otwiera CheckInModal
- Kliknięcie w CheckOut otwiera CheckOutModal
- Kliknięcie w Edit przełącza widok w tryb edycji
- Kliknięcie w Cancel otwiera CancelDialog

**Obsługiwana walidacja:**
- Disabled state podczas operacji
- Conditional rendering według statusu

**Typy:**
- `ActionFooterProps`

**Propsy:**
```typescript
interface ActionFooterProps {
  reservationId: string;
  status: ReservationStatus;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onEdit: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}
```

## 5. Typy

### Nowe typy dla widoku szczegółów

```typescript
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
  type: 'created' | 'updated' | 'check_in' | 'check_out' | 'cancelled' | 'status_changed';
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
  paymentStatusColor: 'success' | 'warning';
  /** Forma płatności */
  paymentMethod: 'cash' | 'card' | 'transfer' | null;
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
  flightDirection: 'departure' | 'arrival' | null;
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
```

### Istniejące typy wykorzystywane przez widok

```typescript
// Z src/types.ts - już zdefiniowane
- ReservationDto
- ReservationStatus
- ReservationSource
- UpdateReservationCommand
```

## 6. Zarządzanie stanem

### Custom Hook: `useReservationDetails`

Dedykowany hook do zarządzania stanem widoku szczegółów rezerwacji.

**Odpowiedzialności:**
- Pobranie danych rezerwacji po ID
- Real-time subscriptions do zmian
- Transformacja danych do ViewModel
- Zarządzanie trybem edycji
- Dirty state tracking
- Auto-save notatek

**Interfejs hooka:**

```typescript
interface UseReservationDetailsParams {
  reservationId: string;
  enabled: boolean; // czy hook ma być aktywny
}

interface UseReservationDetailsResult {
  // Data
  reservation: ReservationDto | null;
  viewModel: ReservationDetailsViewModel | null;
  
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
  updateReservation: (data: UpdateReservationCommand) => Promise<void>;
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
}
```

**Implementacja wykorzystuje:**
- React Query dla cache i real-time updates
- React Hook Form dla formularzy edycji
- useDebounce dla auto-save notatek
- useBeforeUnload dla ostrzeżenia o niezapisanych zmianach

### Context: Opcjonalny `ReservationDetailsContext`

Dla złożonych scenariuszy można wykorzystać Context API do współdzielenia stanu między komponentami, ale w większości przypadków przekazywanie propsów będzie wystarczające.

## 7. Integracja API

### Endpoint do pobrania pojedynczej rezerwacji

**Request:**
```typescript
GET /api/reservations?id=eq.${reservationId}
```

**Query params:**
- `id=eq.<uuid>` - filtrowanie po ID

**Response Type:**
```typescript
ReservationDto[] // Supabase zawsze zwraca tablicę
```

**Obsługa w hooku:**
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['reservation', reservationId],
  queryFn: async () => {
    const response = await fetch(`/api/reservations?id=eq.${reservationId}`);
    if (!response.ok) throw new Error('Failed to fetch reservation');
    const data = await response.json();
    if (data.length === 0) throw new Error('Reservation not found');
    return data[0] as ReservationDto;
  },
  enabled: !!reservationId,
  staleTime: 30000, // 30s
});
```

### Endpoint do aktualizacji rezerwacji

**Request:**
```typescript
PATCH /api/reservations?id=${reservationId}
Content-Type: application/json

{
  // UpdateReservationCommand - partial update
  "phone": "123456789",
  "license_plate": "WX12345"
}
```

**Request Type:**
```typescript
UpdateReservationCommand
```

**Response Type:**
```typescript
ReservationDto
```

**Success Response:**
- **Code:** `200 OK`
- **Payload:** Zaktualizowany obiekt rezerwacji

**Error Responses:**
- `400 Bad Request` - błąd walidacji
- `404 Not Found` - rezerwacja nie istnieje
- `409 Conflict` - naruszenie reguł biznesowych

### Endpoint do aktualizacji notatek (ten sam co wyżej)

Używany przez auto-save mechanism w NotesSection.

**Request:**
```typescript
PATCH /api/reservations?id=${reservationId}
Content-Type: application/json

{
  "notes": "Zaktualizowane notatki..."
}
```

### Real-time Subscriptions (Supabase)

Dla synchronizacji zmian w czasie rzeczywistym:

```typescript
const channel = supabase
  .channel(`reservation:${reservationId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'reservations',
      filter: `id=eq.${reservationId}`
    },
    (payload) => {
      // Invalidate query i refetch
      queryClient.invalidateQueries(['reservation', reservationId]);
    }
  )
  .subscribe();
```

## 8. Interakcje użytkownika

### Otwarcie widoku szczegółów
**Trigger:** Kliknięcie w wiersz tabeli lub kartę rezerwacji  
**Akcja:**
1. Pobranie danych rezerwacji z API
2. Wyświetlenie loading skeleton
3. Transformacja do ViewModel
4. Render widoku z animacją slide-in (300ms)
5. Focus na przycisk zamknięcia (accessibility)

### Zamknięcie widoku
**Trigger:** Kliknięcie X, Esc, backdrop (desktop), back button (mobile)  
**Akcja:**
1. Sprawdzenie isDirty
2. Jeśli true: wyświetlenie confirmation dialog
3. Jeśli false lub confirmed: zamknięcie z animacją fade-out
4. Nawigacja do poprzedniego widoku

### Kliknięcie w email
**Trigger:** Kliknięcie w link email  
**Akcja:**
1. Otwarcie klienta pocztowego z mailto: link
2. Fallback: kopiowanie email do schowka + toast

### Kliknięcie w telefon
**Trigger:** Kliknięcie w link telefonu  
**Akcja:**
1. Inicjowanie połączenia przez tel: link
2. Na desktop: kopiowanie numeru do schowka + toast

### Kliknięcie w numer rejestracyjny
**Trigger:** Kliknięcie w nr rejestracyjny  
**Akcja:**
1. Kopiowanie numeru do schowka
2. Toast: "Numer rejestracyjny skopiowany"

### Edycja notatek
**Trigger:** Wpisywanie w textarea  
**Akcja:**
1. isDirty = true
2. Debounced auto-save (1000ms)
3. Wyświetlenie "Zapisywanie..." indicator
4. PATCH request z nowymi notatkami
5. Optimistic update
6. Success: "Zapisano" indicator (2s)
7. Error: rollback + toast error

### Kliknięcie "Edytuj"
**Trigger:** Kliknięcie przycisku "Edytuj"  
**Akcja:**
1. isEditMode = true
2. Przekształcenie display fields w editable inputs
3. Apply conditional edit rules według statusu
4. Lock niedozwolonych pól (disabled + tooltip)
5. Focus na pierwszy edytowalny input

### Zapisanie edycji
**Trigger:** Kliknięcie "Zapisz" w trybie edycji  
**Akcja:**
1. Walidacja formularza (client-side)
2. Jeśli invalid: wyświetlenie błędów inline
3. Jeśli valid: PATCH request
4. Optimistic update UI
5. Success: exit edit mode + toast
6. Error: rollback + display error

### Anulowanie edycji
**Trigger:** Kliknięcie "Anuluj" w trybie edycji  
**Akcja:**
1. Sprawdzenie isDirty
2. Jeśli true: confirmation dialog "Odrzucić zmiany?"
3. Jeśli confirmed: revert do oryginalnych wartości
4. isEditMode = false

### Kliknięcie "Check-in"
**Trigger:** Kliknięcie przycisku "Check-in"  
**Akcja:**
1. Otwarcie CheckInModal
2. Sprawdzenie kompletności danych
3. Jeśli niekompletna: formularz uzupełnienia
4. Jeśli kompletna: potwierdzenie + opcjonalna płatność
5. Po submit: PATCH request ze statusem 'in_progress'
6. Optimistic update
7. Zamknięcie modala + toast success

### Kliknięcie "Check-out"
**Trigger:** Kliknięcie przycisku "Check-out"  
**Akcja:**
1. Otwarcie CheckOutModal
2. Wyświetlenie podsumowania + koszt
3. Conditional: płatność required lub already paid
4. Po submit: PATCH request ze statusem 'completed'
5. Optimistic update
6. Zamknięcie modala + toast success

### Kliknięcie "Anuluj"
**Trigger:** Kliknięcie przycisku "Anuluj rezerwację"  
**Akcja:**
1. Otwarcie AlertDialog z potwierdzeniem
2. Optional: textarea z powodem anulacji
3. Po confirm: PATCH request ze statusem 'cancelled'
4. Append reason do notes
5. Optimistic update
6. Zamknięcie modala + toast

### Rozwinięcie/zwinięcie timeline
**Trigger:** Kliknięcie w toggle "Historia"  
**Akcja:**
1. Toggle isCollapsed state
2. Animacja expand/collapse (height transition)
3. Rotate arrow icon

## 9. Warunki i walidacja

### Warunki dostępności akcji według statusu

| Status | Check-in | Check-out | Edytuj | Anuluj |
|--------|----------|-----------|--------|--------|
| `confirmed` | ✅ Tak | ❌ Nie | ✅ Wszystkie pola | ✅ Tak |
| `in_progress` | ❌ Nie | ✅ Tak | ⚠️ Ograniczone* | ✅ Tak |
| `completed` | ❌ Nie | ❌ Nie | ⚠️ Tylko notatki | ❌ Nie |
| `cancelled` | ❌ Nie | ❌ Nie | ⚠️ Tylko notatki | ❌ Nie |
| `no_show` | ❌ Nie | ❌ Nie | ⚠️ Tylko notatki | ❌ Nie |

\* Ograniczone: Data przyjazdu locked, pozostałe pola edytowalne

### Reguły edycji warunkowej

**Status: `confirmed`**
```typescript
{
  canEditCheckIn: true,
  canEditCheckOut: true,
  canEditPersonalInfo: true,
  canEditVehicleInfo: true,
  canEditNotes: true
}
```

**Status: `in_progress`**
```typescript
{
  canEditCheckIn: false, // LOCKED - już wykonany check-in
  canEditCheckOut: true,
  canEditPersonalInfo: true,
  canEditVehicleInfo: true,
  canEditNotes: true
}
```

**Status: `completed` | `cancelled` | `no_show`**
```typescript
{
  canEditCheckIn: false,
  canEditCheckOut: false,
  canEditPersonalInfo: false,
  canEditVehicleInfo: false,
  canEditNotes: true // TYLKO NOTATKI
}
```

### Walidacja pól w trybie edycji

**Nazwisko (last_name):**
- Required: true
- Min length: 2
- Max length: 100
- Pattern: tylko litery, spacje, myślniki
- Transform: capitalize first letter

**Imię (first_name):**
- Required: false
- Min length: 2
- Max length: 100
- Pattern: tylko litery, spacje, myślniki
- Transform: capitalize first letter

**Email:**
- Required: false
- Pattern: valid email format
- Transform: lowercase

**Telefon (phone):**
- Required: false
- Pattern: 9 cyfr (PL format)
- Transform: remove spaces, format as "XXX XXX XXX"

**Numer rejestracyjny (license_plate):**
- Required: false
- Min length: 4
- Max length: 10
- Transform: uppercase, space after first 2-3 chars

**Data przyjazdu (planned_check_in):**
- Required: true
- Must be: <= planned_check_out
- Validation: nie w przeszłości (tylko dla nowych)
- Conditional: locked jeśli status = 'in_progress'

**Data wyjazdu (planned_check_out):**
- Required: true
- Must be: > planned_check_in
- Min duration: 1 dzień

**Kierunek lotu (flight_direction):**
- Required: false
- Enum: 'departure' | 'arrival'

**Notatki (notes):**
- Required: false
- Max length: 1000
- Character counter visible od 900 znaków

### Walidacja API-side

Backend endpoint `/api/reservations` (PATCH) wykonuje dodatkową walidację:
- UUID format dla ID
- Constraint checks (daty, statusy)
- Overbooking check przy zmianie dat
- Timestamp validation

Błędy API są obsługiwane i mapowane na user-friendly messages.

## 10. Obsługa błędów

### Błędy pobrania danych

**Scenariusz:** Rezerwacja nie istnieje (404)  
**Obsługa:**
1. Wyświetlenie ErrorState z ikoną i komunikatem
2. Message: "Nie znaleziono rezerwacji"
3. Przycisk "Wróć do listy"
4. Auto-redirect po 5s

**Scenariusz:** Błąd sieciowy (network error)  
**Obsługa:**
1. Wyświetlenie ErrorState
2. Message: "Błąd połączenia. Sprawdź internet."
3. Przycisk "Spróbuj ponownie"
4. Retry logic (3 attempts z exponential backoff)

**Scenariusz:** Timeout  
**Obsługa:**
1. Wyświetlenie ErrorState
2. Message: "Przekroczono czas oczekiwania"
3. Przycisk "Odśwież"

### Błędy aktualizacji

**Scenariusz:** Validation error (400)  
**Obsługa:**
1. Inline errors pod polami formularza
2. Scroll do pierwszego błędu
3. Focus na pole z błędem
4. No-close modal do poprawy

**Scenariusz:** Conflict (409) - overbooking  
**Obsługa:**
1. Modal z komunikatem o konflikcie
2. Sugestie alternatywnych dat
3. Opcja: kontynuuj (override) lub anuluj
4. Lock dates pokazując konflikt

**Scenariusz:** Not Found (404) - rezerwacja została usunięta  
**Obsługa:**
1. Toast error: "Rezerwacja nie istnieje"
2. Auto-redirect do listy rezerwacji
3. Invalidate cache

**Scenariusz:** Race condition - konflikt edycji  
**Obsługa:**
1. Detect przez timestamp comparison
2. Modal: "Rezerwacja została zmieniona przez innego użytkownika"
3. Opcje: Odśwież dane | Nadpisz zmiany
4. Pokazanie diff zmian

### Błędy operacji (Check-in, Check-out)

**Scenariusz:** Check-in failed (API error)  
**Obsługa:**
1. Rollback optimistic update
2. Toast error z opisem
3. Modal pozostaje otwarty
4. Przycisk "Spróbuj ponownie"

**Scenariusz:** Check-out bez płatności (validation)  
**Obsługa:**
1. Disabled button z tooltip
2. Message: "Potwierdź otrzymanie płatności"
3. Highlight checkbox

### Błędy auto-save notatek

**Scenariusz:** Auto-save failed  
**Obsługa:**
1. Indicator: "Błąd zapisu" (red)
2. Retry automatyczny (3 attempts)
3. Po wyczerpaniu: manual save button
4. Warning przed zamknięciem

### Obsługa offline mode

**Scenariusz:** Brak połączenia  
**Obsługa:**
1. Sticky banner: "Brak połączenia"
2. Wszystkie action buttons disabled
3. Read-only mode (cached data)
4. Tooltip: "Wymagane połączenie"
5. Auto-detect powrót online
6. Auto-retry pending actions

### Error boundaries

Implementacja React Error Boundary dla całego widoku:
- Catch unhandled errors
- Graceful fallback UI
- Error reporting (console/logging service)
- Przycisk "Reload" lub "Wróć"

## 11. Kroki implementacji

### Krok 1: Utworzenie struktury plików i podstawowych komponentów
**Czas: 2h**

**Zadania:**
1. Utworzenie katalogu `src/components/reservations/details/`
2. Utworzenie plików:
   - `ReservationDetailsView.tsx` (main container)
   - `DetailHeader.tsx`
   - `PersonalInfoCard.tsx`
   - `ReservationDetailsCard.tsx`
   - `FinancialSection.tsx`
   - `NotesSection.tsx`
   - `TimelineSection.tsx`
   - `ActionFooter.tsx`
   - `index.ts` (exports)
3. Utworzenie `src/types.ts` - dodanie nowych typów:
   - `ReservationDetailsViewProps`
   - `ReservationDetailsViewState`
   - `TimelineEvent`
   - `ReservationDetailsViewModel`
   - `FinancialInfoViewModel`
   - `ConditionalEditRules`
4. Utworzenie szkieletów komponentów z podstawowymi propsami
5. Setup basic styling z Tailwind

**Rezultat:** Podstawowa struktura komponentów gotowa do wypełnienia logiką

### Krok 2: Implementacja custom hooka `useReservationDetails`
**Czas: 3h**

**Zadania:**
1. Utworzenie `src/hooks/useReservationDetails.ts`
2. Implementacja fetch logic z React Query:
   ```typescript
   - queryKey: ['reservation', reservationId]
   - queryFn: fetch + error handling
   - enabled: !!reservationId
   - staleTime: 30s
   ```
3. Implementacja transformacji `ReservationDto` → `ReservationDetailsViewModel`
4. Utworzenie helper functions:
   - `buildFinancialViewModel()`
   - `buildTimelineEvents()`
   - `getEditRules()`
5. Implementacja mutation hooks:
   - `updateReservation`
   - `updateNotes` (debounced)
6. State management dla modali (check-in, check-out, cancel)
7. Implementacja dirty state tracking
8. Testy hooka z mock data

**Rezultat:** Centralny hook zarządzający całym stanem widoku

### Krok 3: Implementacja DetailHeader i PersonalInfoCard
**Czas: 2h**

**Zadania:**
1. `DetailHeader`:
   - Layout: flex z full name po lewej, status badge + close po prawej
   - Integracja StatusBadge z `src/components/ui/badge.tsx`
   - Tooltip na hover StatusBadge
   - Close button z ikoną X (Lucide)
   - Responsive: mobile stack vertically
2. `PersonalInfoCard`:
   - Card wrapper z tytułem "Dane osobowe"
   - Email link z ikoną Mail (click-to-email)
   - Phone link z ikoną Phone (click-to-call)
   - License plate z ikoną Car + copy-to-clipboard
   - Formatowanie telefonu: `formatPhoneNumber()`
   - Formatowanie nr rej.: `formatLicensePlate()`
   - Empty state dla null values: "Brak danych"
3. Implementacja copy-to-clipboard z toast feedback
4. Testy interakcji

**Rezultat:** Gotowy header i karta danych osobowych

### Krok 4: Implementacja ReservationDetailsCard i FinancialSection
**Czas: 2h**

**Zadania:**
1. `ReservationDetailsCard`:
   - Card wrapper z tytułem "Szczegóły rezerwacji"
   - Display dat przyjazdu/wyjazdu z ikoną Calendar
   - Obliczanie i display liczby dni
   - Badge kierunku lotu (conditional)
   - Ikony: ✈️ Wylot, 🛬 Przylot
   - Date formatting: `formatDate()` - "10 listopada 2026, 14:00"
2. `FinancialSection`:
   - Card wrapper z tytułem "Finanse"
   - Large, bold display kosztu: `formatCurrency()`
   - Payment status badge:
     - Opłacone (green) / Nieopłacone (orange)
   - Payment method (conditional display jeśli isPaid)
   - Source badge (Telefon/Walk-in/API)
   - Responsive grid layout
3. Utility functions:
   - `formatCurrency(amount)` → "210,00 zł"
   - `getPaymentStatusLabel()`
   - `getPaymentMethodLabel()`
   - `getSourceLabel()`

**Rezultat:** Karty ze szczegółami rezerwacji i finansami

### Krok 5: Implementacja NotesSection z auto-save
**Czas: 3h**

**Zadania:**
1. `NotesSection`:
   - Label "Notatki"
   - Textarea z auto-resize
   - Character counter (pokazywany od 900/1000)
   - Save indicator:
     - Idle: brak
     - Saving: spinner + "Zapisywanie..."
     - Saved: checkmark + "Zapisano" (2s fade out)
     - Error: alert icon + "Błąd zapisu"
2. Implementacja debounced auto-save:
   - `useDebounce` hook (1000ms)
   - Trigger PATCH request z nowymi notatkami
   - Optimistic update
3. Conditional editing:
   - Disabled state dla completed/cancelled
   - Tooltip: "Edycja dozwolona tylko dla notatek"
4. Keyboard shortcuts:
   - Ctrl+S: force save
5. Validation:
   - Max length 1000
   - Trim whitespace
6. Error handling:
   - Retry logic (3 attempts)
   - Manual save button w razie niepowodzenia
7. Testy auto-save mechanism

**Rezultat:** Działająca sekcja notatek z auto-save

### Krok 6: Implementacja TimelineSection
**Czas: 3h**

**Zadania:**
1. `TimelineSection`:
   - Collapsible container z toggle
   - Domyślnie expanded
   - Smooth height transition
   - Arrow icon rotation
2. `TimelineEvent` component:
   - Vertical line łącząca eventy
   - Color-coded dot według typu:
     - created: blue
     - updated: orange
     - check_in: green
     - check_out: gray
     - cancelled: red
   - Event title + timestamp
   - Performer name (jeśli dostępny)
   - Conditional details (dla 'updated')
3. Logika budowania timeline:
   - Extract z `created_at`, `updated_at`
   - Extract z `actual_check_in`, `actual_check_out`
   - Detect status changes
   - Sort chronologicznie
4. Formatowanie timestamp:
   - "8 stycznia 2026, 10:00"
   - Relative time option: "2 godziny temu"
5. Hover state:
   - Tooltip z pełnymi szczegółami zmian
6. Empty state:
   - "Brak historii zmian"

**Rezultat:** Działający timeline z historią zmian

### Krok 7: Implementacja ActionFooter z conditional rendering
**Czas: 2h**

**Zadania:**
1. `ActionFooter`:
   - Sticky footer (bottom of modal)
   - Flex layout z spacingiem
   - Border-top separator
2. Conditional buttons według statusu:
   - Implementacja logic z tabeli dostępności akcji
   - Button variants z Shadcn:
     - Check-in: default (blue)
     - Check-out: default (blue)
     - Edit: secondary (gray)
     - Cancel: destructive (red)
3. Disabled states:
   - Podczas isProcessing
   - Loading spinner w button
4. Callbacks:
   - onCheckIn → open CheckInModal
   - onCheckOut → open CheckOutModal
   - onEdit → toggle edit mode
   - onCancel → open CancelDialog
5. Keyboard navigation:
   - Tab order
   - Enter/Space activation
6. Tooltips dla disabled buttons

**Rezultat:** Footer z akcjami kontekstowymi

### Krok 8: Implementacja trybu edycji
**Czas: 4h**

**Zadania:**
1. Edit mode state toggle w `useReservationDetails`
2. Conditional rendering:
   - View mode: display components
   - Edit mode: form inputs
3. Implementacja editable fields:
   - `EditableTextField` wrapper component
   - `EditableDateField`
   - `EditableSelectField` (flight direction)
4. Apply conditional edit rules:
   - Lock fields według statusu
   - Disabled + tooltip dla locked fields
5. Form state management:
   - React Hook Form integration
   - Zod schema validation
6. Validation:
   - Inline errors
   - Submit validation
7. Actions:
   - Save button → PATCH request
   - Cancel button → revert changes
   - Dirty state warning
8. Optimistic updates
9. Error handling:
   - Display API errors
   - Rollback on failure
10. Live cost recalculation przy zmianie dat

**Rezultat:** Działający tryb edycji z walidacją

### Krok 9: Integracja modali akcji (CheckIn, CheckOut, Cancel)
**Czas: 3h**

**Zadania:**
1. Import istniejących modali:
   - `CheckInModal` z `src/components/reservations/`
   - `CheckOutModal`
   - `CancelDialog` (Alert Dialog)
2. Integracja z ActionFooter:
   - Przekazanie callbacks
   - State management w hooku
3. Props drilling:
   - Pass reservation data
   - Pass callbacks (onSuccess)
4. Callback handling po sukces:
   - Invalidate query
   - Refetch data
   - Toast notification
   - Update viewModel
5. Error handling:
   - Pass errors do parent
   - Display w modal lub toast
6. Optimistic updates
7. Testy flow:
   - Check-in complete flow
   - Check-out complete flow
   - Cancel flow

**Rezultat:** Pełna integracja akcji check-in/out/cancel

### Krok 10: Routing i nawigacja
**Czas: 2h**

**Zadania:**
1. Utworzenie strony Astro:
   - `src/pages/rezerwacje/[id].astro`
   - SSR z getStaticPaths dla pre-rendering (optional)
2. Extract reservationId z URL:
   ```typescript
   const { id } = Astro.params;
   ```
3. Przekazanie ID do React component
4. Desktop: Dialog overlay z zachowaniem URL
5. Mobile: Full-page navigation
6. Implementacja:
   - Back button handling
   - Browser back/forward
   - Direct URL access
7. URL state sync:
   - Edit mode w query param (optional)
8. Navigation guards:
   - Dirty state warning przed nawigacją
   - `useBeforeUnload` hook

**Rezultat:** Działający routing i nawigacja

### Krok 11: Styling i responsywność
**Czas: 3h**

**Zadania:**
1. Desktop layout:
   - Modal: 800px width, max-height 90vh
   - Scrollable content area
   - Sticky header i footer
   - Backdrop blur effect
2. Mobile layout:
   - Full-page view
   - Stack cards vertically
   - Touch-friendly buttons (min 44px)
   - Bottom sheet dla modali akcji
3. Animations:
   - Modal slide-in: 300ms ease-out
   - Toast animations
   - Timeline expand/collapse
   - Button hover/active states
4. Breakpoints:
   - Mobile: < 768px
   - Tablet: 768-1024px
   - Desktop: > 1024px
5. Dark mode support (future):
   - CSS variables
   - Tailwind dark: classes
6. Print styles (optional):
   - Hide buttons
   - Expand timeline
   - One-column layout
7. Accessibility:
   - Focus visible indicators
   - Keyboard navigation
   - ARIA labels
8. Performance:
   - Lazy load timeline
   - Virtual scrolling dla długich notatek (optional)

**Rezultat:** Responsywny i dostępny UI

### Krok 12: Real-time updates i synchronizacja
**Czas: 2h**

**Zadania:**
1. Supabase Realtime subscription setup:
   ```typescript
   channel: `reservation:${reservationId}`
   event: 'UPDATE'
   filter: `id=eq.${reservationId}`
   ```
2. Callback handling:
   - Invalidate React Query cache
   - Refetch data
   - Update UI z animacją
3. Conflict detection:
   - Compare timestamp
   - Show warning jeśli newer version
4. Optimistic locking:
   - Include version/timestamp w PATCH
   - Handle 409 conflicts
5. Toast notifications:
   - "Rezerwacja została zaktualizowana"
   - Przycisk "Odśwież"
6. Graceful degradation:
   - Fallback do polling jeśli WebSocket failed
7. Cleanup:
   - Unsubscribe on unmount

**Rezultat:** Real-time synchronizacja danych

### Krok 13: Error handling i edge cases
**Czas: 2h**

**Zadania:**
1. Implementacja Error Boundary:
   - Catch React errors
   - Fallback UI
   - Error logging
2. Network error handling:
   - Retry logic
   - Exponential backoff
   - Offline banner
3. 404 handling:
   - ErrorState component
   - Auto-redirect
4. Validation errors:
   - Inline displays
   - Scroll to first error
5. Race condition handling:
   - Version comparison
   - Conflict modal
6. Timeout handling:
   - Abort controller
   - Timeout after 10s
7. Empty states:
   - No data dla optional fields
   - Placeholder texts
8. Loading states:
   - Skeleton screens
   - Spinner dla operations
9. Testy edge cases

**Rezultat:** Robustna obsługa błędów

### Krok 14: Testy i optymalizacja
**Czas: 3h**

**Zadania:**
1. Manual testing:
   - Test wszystkich user flows
   - Test na różnych statusach rezerwacji
   - Test walidacji
   - Test akcji (check-in, check-out, cancel)
   - Test edit mode
   - Test auto-save
   - Test real-time updates
2. Responsywność:
   - Test na mobile
   - Test na tablet
   - Test na desktop
3. Accessibility:
   - Keyboard navigation test
   - Screen reader test (basic)
   - Focus management
4. Performance:
   - Measure initial load time
   - Optimize re-renders (React.memo)
   - Bundle size check
5. Edge cases:
   - Test z brakiem danych (null values)
   - Test z długimi tekstami
   - Test offline mode
6. Bug fixes
7. Code cleanup:
   - Remove console.logs
   - Format code
   - Add comments

**Rezultat:** Przetestowany i zoptymalizowany widok

### Krok 15: Dokumentacja i integracja
**Czas: 1h**

**Zadania:**
1. Dokumentacja komponentów:
   - JSDoc comments
   - Props documentation
   - Usage examples
2. Update README jeśli potrzebne
3. Integracja z listą rezerwacji:
   - Link z tabeli
   - Link z kart
4. Integracja z dashboard:
   - Link z kart przyjazdów/wyjazdów
5. Smoke testing całej aplikacji
6. Code review checklist
7. Merge do main branch

**Rezultat:** Gotowy widok zintegrowany z aplikacją

---

**Łączny szacowany czas implementacji: 37 godzin (około 5 dni roboczych)**

## Dodatkowe uwagi implementacyjne

### Priorytetyzacja funkcjonalności

**MVP (Must Have):**
- ✅ Wyświetlenie wszystkich danych rezerwacji
- ✅ Akcje podstawowe (Check-in, Check-out, Anuluj)
- ✅ Podstawowa edycja
- ✅ Timeline historii

**Nice to Have:**
- Auto-save notatek (można zastąpić manual save)
- Real-time updates (można polling)
- Conditional editing (można uproscić)

**Future Enhancements:**
- Print view
- Export do PDF
- Załączniki/zdjęcia
- Historia zmian z diff view
- Komentarze/notatki wielu użytkowników

### Potencjalne problemy i rozwiązania

**Problem:** Długi czas ładowania danych  
**Rozwiązanie:** Skeleton screen, prefetch podczas hover na liście

**Problem:** Konflikt edycji przez wielu użytkowników  
**Rozwiązanie:** Optimistic locking + conflict resolution UI

**Problem:** Duże rozmiary timeline dla starych rezerwacji  
**Rozwiązanie:** Pagination lub virtual scrolling

**Problem:** Mobile performance  
**Rozwiązanie:** Code splitting, lazy loading modali

### Zależności zewnętrzne

- Shadcn/ui components: Dialog, Card, Button, Badge, Textarea, Calendar
- Lucide React: ikony
- React Hook Form + Zod: formularze
- React Query: data fetching
- date-fns: formatowanie dat
- Supabase client: real-time

### Metryki sukcesu

- ✅ Czas ładowania < 1s
- ✅ Time to interactive < 2s
- ✅ Wszystkie akcje działają poprawnie
- ✅ Responsywny na wszystkich urządzeniach
- ✅ Accessible (keyboard navigation)
- ✅ Zero błędów w console
- ✅ Zgodność z designs (ui-plan.md)

