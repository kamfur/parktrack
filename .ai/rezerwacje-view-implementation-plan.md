# Plan implementacji widoku Lista Rezerwacji

## 1. Przegląd

Widok Lista Rezerwacji (`/rezerwacje`) to główny widok zarządzania wszystkimi rezerwacjami w systemie. Umożliwia pracownikom parkingu przeglądanie, wyszukiwanie, filtrowanie i zarządzanie rezerwacjami z zaawansowanymi opcjami sortowania i paginacji. Widok jest w pełni responsywny - na desktopie wyświetla tabelę, a na urządzeniach mobilnych przełącza się na widok kart.

**Główne funkcjonalności:**
- Wyszukiwanie rezerwacji po nazwisku (debounced 300ms)
- Zaawansowane filtrowanie (status, źródło, zakres dat)
- Sortowanie według kolumn tabeli
- Paginacja z opcjami rozmiaru strony (10/25/50/100)
- Persystencja stanu w URL query parameters
- Responsywny design (tabela desktop / karty mobile)
- Akcje na rezerwacjach (edytuj, anuluj, szczegóły)

## 2. Routing widoku

**Ścieżka:** `/rezerwacje`

**Plik implementacji:** `src/pages/rezerwacje.astro`

**Struktura routingu:**
- `/rezerwacje` - główny widok listy rezerwacji
- `/rezerwacje?search=kowalski&status=confirmed&page=1&limit=25` - widok z aktywnymi filtrami i paginacją

**Query Parameters (URL state):**
- `search` - wyszukiwana fraza (nazwisko)
- `status` - status rezerwacji (może być wiele: `status=confirmed&status=in_progress`)
- `source` - źródło rezerwacji (`phone`, `walk_in`, `api`)
- `date_from` - data początkowa zakresu (ISO format)
- `date_to` - data końcowa zakresu (ISO format)
- `sort_by` - kolumna sortowania (domyślnie: `created_at`)
- `sort_order` - kierunek sortowania (`asc` lub `desc`, domyślnie: `desc`)
- `page` - numer strony (domyślnie: `1`)
- `limit` - liczba wyników na stronę (domyślnie: `25`)

## 3. Struktura komponentów

```
ReservationsListPage (Astro)
└── ReservationsListContainer (React)
    ├── SearchBar
    ├── FilterPanel (Collapsible)
    │   ├── DateRangePicker
    │   ├── StatusFilter (Multi-select checkboxes)
    │   └── SourceFilter (Radio buttons)
    ├── ActiveFiltersBadges
    ├── ReservationTable (Desktop) / ReservationCards (Mobile)
    │   ├── TableHeader (z sortowaniem)
    │   ├── TableRow / ReservationCard
    │   └── ActionsDropdown
    ├── PaginationControls
    │   ├── PageSizeSelector
    │   └── PageNavigation
    └── EmptyState (gdy brak wyników)
```

## 4. Szczegóły komponentów

### ReservationsListContainer

**Lokalizacja:** `src/components/reservations/ReservationsListContainer.tsx`

**Opis komponentu:** Główny kontener React zarządzający całym widokiem listy rezerwacji. Koordynuje stan wyszukiwania, filtrowania, sortowania i paginacji. Wykorzystuje custom hook `useReservationsList` do zarządzania logiką biznesową i integracji z API.

**Główne elementy:**
- Layout z dwoma kolumnami (sidebar z filtrami + główna treść)
- Integracja z URL query parameters (odczyt i zapis)
- Zarządzanie stanem loading i error
- Koordynacja między komponentami potomnymi

**Obsługiwane interakcje:**
- Zmiana wartości wyszukiwania (debounced)
- Zmiana filtrów (status, źródło, daty)
- Zmiana sortowania (kolumna i kierunek)
- Zmiana paginacji (strona i limit)
- Usuwanie aktywnych filtrów
- Otwieranie szczegółów rezerwacji
- Otwieranie formularza edycji

**Obsługiwana walidacja:**
- Walidacja formatu dat (ISO 8601)
- Walidacja zakresu dat (date_to > date_from)
- Walidacja wartości statusu (enum: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`)
- Walidacja wartości źródła (enum: `phone`, `walk_in`, `api`)
- Walidacja wartości sort_by (dozwolone kolumny)
- Walidacja wartości sort_order (`asc` lub `desc`)
- Walidacja wartości page (liczba całkowita > 0)
- Walidacja wartości limit (10, 25, 50, 100)

**Typy:**
- `ReservationDto[]` - lista rezerwacji z API
- `ReservationsListState` - stan komponentu (filtry, sortowanie, paginacja)
- `ReservationsListFilters` - obiekt filtrów

**Props:**
- Brak (komponent główny, nie przyjmuje props)

---

### SearchBar

**Lokalizacja:** `src/components/shared/SearchBar.tsx`

**Opis komponentu:** Komponent inputu wyszukiwania z ikoną i funkcją debounce. Automatycznie aktualizuje URL query parameter `search` po 300ms od ostatniej zmiany wartości.

**Główne elementy:**
- Input text z ikoną wyszukiwania (lucide-react `Search`)
- Przycisk czyszczenia (X) widoczny gdy wartość nie jest pusta
- Loading spinner podczas wyszukiwania (opcjonalnie)
- Placeholder: "Szukaj po nazwisku..."

**Obsługiwane interakcje:**
- Wprowadzanie tekstu (debounced 300ms)
- Czyszczenie wartości (przycisk X)
- Submit przez Enter (opcjonalnie)

**Obsługiwana walidacja:**
- Minimalna długość: 2 znaki (opcjonalnie, może być puste)
- Maksymalna długość: 100 znaków

**Typy:**
- `string` - wartość wyszukiwania

**Props:**
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  debounceMs?: number; // domyślnie 300
}
```

---

### FilterPanel

**Lokalizacja:** `src/components/reservations/FilterPanel.tsx`

**Opis komponentu:** Collapsible sidebar z opcjami filtrowania. Zawiera sekcje dla dat, statusu i źródła. Może być zwijany/rozwijany przez użytkownika.

**Główne elementy:**
- Collapsible header z ikoną i tytułem "Filtry"
- DateRangePicker (Shadcn Calendar) dla zakresu dat
- StatusFilter - multi-select checkboxes dla statusów
- SourceFilter - radio buttons dla źródła
- Przycisk "Wyczyść filtry"

**Obsługiwane interakcje:**
- Rozwijanie/zwijanie panelu (toggle)
- Wybór zakresu dat
- Zaznaczanie/odznaczanie statusów (multi-select)
- Wybór źródła (single select, radio)
- Czyszczenie wszystkich filtrów

**Obsługiwana walidacja:**
- Data początkowa nie może być późniejsza niż data końcowa
- Data początkowa nie może być w przeszłości (opcjonalnie)
- Co najmniej jeden status musi być zaznaczony (jeśli filtry statusu są aktywne)

**Typy:**
- `ReservationStatus[]` - zaznaczone statusy
- `ReservationSource | null` - wybrane źródło
- `{ from: Date | null; to: Date | null }` - zakres dat

**Props:**
```typescript
interface FilterPanelProps {
  filters: ReservationsListFilters;
  onFiltersChange: (filters: ReservationsListFilters) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isLoading?: boolean;
}
```

---

### DateRangePicker

**Lokalizacja:** `src/components/shared/DateRangePicker.tsx` (lub użycie Shadcn Calendar)

**Opis komponentu:** Komponent wyboru zakresu dat wykorzystujący Shadcn/ui Calendar. Wyświetla kalendarz z możliwością wyboru daty początkowej i końcowej.

**Główne elementy:**
- Input field z ikoną kalendarza
- Popover z kalendarzem (Shadcn Calendar)
- Wybór daty początkowej i końcowej
- Wyświetlanie wybranego zakresu w formacie czytelnym

**Obsługiwane interakcje:**
- Otwieranie/zamykanie kalendarza
- Wybór daty początkowej
- Wybór daty końcowej
- Czyszczenie zakresu

**Obsługiwana walidacja:**
- Data końcowa musi być późniejsza niż data początkowa
- Daty nie mogą być w przeszłości (opcjonalnie, zależnie od wymagań biznesowych)

**Typy:**
- `{ from: Date | null; to: Date | null }` - zakres dat

**Props:**
```typescript
interface DateRangePickerProps {
  value: { from: Date | null; to: Date | null };
  onChange: (range: { from: Date | null; to: Date | null }) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

---

### StatusFilter

**Lokalizacja:** `src/components/reservations/StatusFilter.tsx`

**Opis komponentu:** Multi-select lista checkboxów dla statusów rezerwacji. Każdy status ma kolorową ikonę i etykietę.

**Główne elementy:**
- Lista checkboxów dla każdego statusu:
  - `pending` - Oczekująca (szary)
  - `confirmed` - Potwierdzona (niebieski)
  - `in_progress` - W realizacji (zielony)
  - `completed` - Zakończona (szary)
  - `cancelled` - Anulowana (czerwony)
  - `no_show` - Nie pojawił się (pomarańczowy)

**Obsługiwane interakcje:**
- Zaznaczanie/odznaczanie pojedynczego statusu
- Zaznaczanie wszystkich (opcjonalnie)
- Odznaczanie wszystkich

**Obsługiwana walidacja:**
- Co najmniej jeden status musi być zaznaczony (jeśli filtry są aktywne)

**Typy:**
- `ReservationStatus[]` - lista zaznaczonych statusów

**Props:**
```typescript
interface StatusFilterProps {
  selectedStatuses: ReservationStatus[];
  onChange: (statuses: ReservationStatus[]) => void;
  disabled?: boolean;
}
```

---

### SourceFilter

**Lokalizacja:** `src/components/reservations/SourceFilter.tsx`

**Opis komponentu:** Radio button group dla źródła rezerwacji. Umożliwia wybór jednego źródła lub opcji "Wszystkie".

**Główne elementy:**
- Radio button "Wszystkie" (domyślnie zaznaczone)
- Radio button "Telefon"
- Radio button "Na miejscu" (walk_in)
- Radio button "API"

**Obsługiwane interakcje:**
- Wybór źródła (single select)
- Wybór opcji "Wszystkie" (czyści filtr źródła)

**Obsługiwana walidacja:**
- Wartość musi być jedną z dozwolonych: `phone`, `walk_in`, `api` lub `null` (wszystkie)

**Typy:**
- `ReservationSource | null` - wybrane źródło lub null (wszystkie)

**Props:**
```typescript
interface SourceFilterProps {
  selectedSource: ReservationSource | null;
  onChange: (source: ReservationSource | null) => void;
  disabled?: boolean;
}
```

---

### ActiveFiltersBadges

**Lokalizacja:** `src/components/reservations/ActiveFiltersBadges.tsx`

**Opis komponentu:** Wyświetla aktywne filtry jako removable badges nad tabelą. Umożliwia szybkie usunięcie pojedynczego filtra.

**Główne elementy:**
- Badge dla każdego aktywnego filtra:
  - "Status: Potwierdzona" (z ikoną X)
  - "Status: W realizacji" (z ikoną X)
  - "Źródło: Telefon" (z ikoną X)
  - "Daty: 10.11 - 17.11" (z ikoną X)
  - "Szukaj: kowalski" (z ikoną X)
- Przycisk "Wyczyść wszystkie" (jeśli jest więcej niż jeden aktywny filtr)

**Obsługiwane interakcje:**
- Usuwanie pojedynczego filtra (kliknięcie X na badge)
- Usuwanie wszystkich filtrów (przycisk "Wyczyść wszystkie")

**Obsługiwana walidacja:**
- Brak (tylko wyświetlanie)

**Typy:**
- `ReservationsListFilters` - obiekt z aktywnymi filtrami

**Props:**
```typescript
interface ActiveFiltersBadgesProps {
  filters: ReservationsListFilters;
  onRemoveFilter: (filterKey: keyof ReservationsListFilters) => void;
  onClearAll: () => void;
}
```

---

### ReservationTable

**Lokalizacja:** `src/components/reservations/ReservationTable.tsx`

**Opis komponentu:** Responsywna tabela rezerwacji dla desktopu. Wyświetla kolumny: Nazwisko, Telefon, Daty, Status, Koszt, Akcje. Na mobile przełącza się na widok kart (ReservationCards).

**Główne elementy:**
- Table header z klikalnymi kolumnami (sortowanie)
- Table rows z danymi rezerwacji
- Status badge z kolorowym wskaźnikiem
- Actions dropdown (3 dots) z opcjami: Szczegóły, Edytuj, Anuluj
- Skeleton loaders podczas ładowania
- Empty state gdy brak wyników

**Kolumny tabeli:**
1. **Nazwisko** - `last_name` (sortowalne)
2. **Telefon** - `phone` (formatowany, np. "123 456 789")
3. **Daty** - `planned_check_in` → `planned_check_out` (format: "10.11 → 17.11")
4. **Status** - `status` (badge z kolorami)
5. **Koszt** - `total_cost` (formatowany: "210,00 zł")
6. **Akcje** - dropdown menu z opcjami

**Obsługiwane interakcje:**
- Sortowanie kolumn (kliknięcie w header)
- Kliknięcie w wiersz (otwiera szczegóły)
- Otwieranie dropdown menu akcji
- Wybór akcji z menu (szczegóły, edytuj, anuluj)

**Obsługiwana walidacja:**
- Brak (tylko wyświetlanie danych)

**Typy:**
- `ReservationDto[]` - lista rezerwacji
- `ReservationDto` - pojedyncza rezerwacja

**Props:**
```typescript
interface ReservationTableProps {
  reservations: ReservationDto[];
  isLoading: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  onRowClick?: (reservation: ReservationDto) => void;
  onAction?: (action: 'view' | 'edit' | 'cancel', reservation: ReservationDto) => void;
}
```

---

### ReservationCards

**Lokalizacja:** `src/components/reservations/ReservationCards.tsx`

**Opis komponentu:** Widok kart rezerwacji dla urządzeń mobilnych. Wyświetla te same dane co tabela, ale w formie kart.

**Główne elementy:**
- Karta dla każdej rezerwacji z:
  - Nagłówkiem (nazwisko + status badge)
  - Informacjami (telefon, daty, koszt)
  - Przyciskiem akcji (dropdown menu)
- Skeleton loaders podczas ładowania
- Empty state gdy brak wyników

**Obsługiwane interakcje:**
- Kliknięcie w kartę (otwiera szczegóły)
- Otwieranie dropdown menu akcji
- Wybór akcji z menu

**Obsługiwana walidacja:**
- Brak (tylko wyświetlanie danych)

**Typy:**
- `ReservationDto[]` - lista rezerwacji

**Props:**
```typescript
interface ReservationCardsProps {
  reservations: ReservationDto[];
  isLoading: boolean;
  onCardClick?: (reservation: ReservationDto) => void;
  onAction?: (action: 'view' | 'edit' | 'cancel', reservation: ReservationDto) => void;
}
```

---

### PaginationControls

**Lokalizacja:** `src/components/shared/PaginationControls.tsx`

**Opis komponentu:** Kontrolki paginacji z selektorem rozmiaru strony i nawigacją między stronami.

**Główne elementy:**
- Informacja o liczbie wyników: "Pokazano 1-25 z 234"
- Page size selector (dropdown): 10, 25, 50, 100
- Nawigacja stron:
  - Przycisk "Poprzednia" (disabled na pierwszej stronie)
  - Numery stron (z elipsami dla dużych zakresów)
  - Przycisk "Następna" (disabled na ostatniej stronie)
- Przycisk "Dzisiaj" (opcjonalnie, resetuje filtry dat)

**Obsługiwane interakcje:**
- Zmiana rozmiaru strony (page size)
- Przejście do poprzedniej strony
- Przejście do następnej strony
- Przejście do konkretnej strony (kliknięcie numeru)

**Obsługiwana walidacja:**
- Page size musi być jedną z dozwolonych wartości: 10, 25, 50, 100
- Numer strony musi być w zakresie 1..totalPages
- Numer strony musi być liczbą całkowitą > 0

**Typy:**
- `number` - numer strony (1-based)
- `number` - rozmiar strony (10, 25, 50, 100)
- `number` - całkowita liczba wyników

**Props:**
```typescript
interface PaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[]; // domyślnie [10, 25, 50, 100]
}
```

---

### EmptyState

**Lokalizacja:** `src/components/common/EmptyState.tsx` (już istnieje)

**Opis komponentu:** Komponent wyświetlający komunikat gdy brak wyników wyszukiwania/filtrowania.

**Główne elementy:**
- Ikona (lucide-react)
- Tytuł: "Brak rezerwacji"
- Opis: "Nie znaleziono rezerwacji spełniających wybrane kryteria."
- Przycisk CTA: "Wyczyść filtry" (jeśli są aktywne filtry)

**Obsługiwane interakcje:**
- Kliknięcie przycisku "Wyczyść filtry"

**Obsługiwana walidacja:**
- Brak

**Typy:**
- Brak (komponent już istnieje, użycie istniejącego interfejsu)

**Props:**
- Użycie istniejącego `EmptyStateProps` z `src/components/common/EmptyState.tsx`

---

## 5. Typy

### Typy podstawowe (z `src/types.ts`)

```typescript
// Entity - bezpośrednio z bazy danych
export type Reservation = Tables<"reservations">;

// DTO - dla API responses
export type ReservationDto = Reservation;

// Status rezerwacji
export type ReservationStatus = 
  | "pending" 
  | "confirmed" 
  | "in_progress" 
  | "completed" 
  | "cancelled" 
  | "no_show";

// Źródło rezerwacji
export type ReservationSource = "phone" | "walk_in" | "api";
```

### Nowe typy dla widoku listy rezerwacji

**Lokalizacja:** `src/types.ts` (rozszerzenie istniejącego pliku)

```typescript
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
  order: 'asc' | 'desc';
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
  | 'created_at'
  | 'last_name'
  | 'planned_check_in'
  | 'planned_check_out'
  | 'status'
  | 'total_cost';
```

### ViewModel dla komponentów

```typescript
/**
 * ViewModel dla wiersza tabeli rezerwacji
 */
export interface ReservationTableRowViewModel {
  id: string;
  lastName: string;
  phone: string | null;
  formattedPhone: string; // "123 456 789" lub "—"
  dateRange: string; // "10.11 → 17.11"
  status: ReservationStatus;
  statusLabel: string; // "Potwierdzona"
  statusColor: string; // Tailwind color class
  totalCost: number;
  formattedCost: string; // "210,00 zł"
  source: ReservationSource;
  sourceLabel: string; // "Telefon"
}

/**
 * ViewModel dla karty rezerwacji (mobile)
 */
export interface ReservationCardViewModel {
  id: string;
  lastName: string;
  firstName: string | null;
  fullName: string; // "Kowalski Jan" lub "Kowalski"
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
```

---

## 6. Zarządzanie stanem

### Strategia zarządzania stanem

Zarządzanie stanem w widoku Lista Rezerwacji będzie oparte na:
1. **URL Query Parameters** - jako źródło prawdy dla filtrów, sortowania i paginacji
2. **React hooks** (useState, useEffect, useMemo) - dla lokalnego stanu UI
3. **Custom hook `useReservationsList`** - enkapsuluje logikę biznesową i integrację z API
4. **React Query** (opcjonalnie, jeśli jest w projekcie) - dla cache'owania i automatycznego refetch

### Custom Hook: useReservationsList

**Lokalizacja:** `src/hooks/useReservationsList.ts`

**Odpowiedzialność:**
- Odczyt parametrów z URL query string
- Budowanie zapytania do API na podstawie filtrów, sortowania i paginacji
- Wykonanie zapytania do API (`GET /api/reservations`)
- Zarządzanie stanami loading i error
- Aktualizacja URL query parameters przy zmianie filtrów
- Debounce dla wyszukiwania (300ms)
- Formatowanie danych do ViewModel

**Struktura hooka:**

```typescript
export function useReservationsList() {
  // Stan
  const [state, setState] = useState<ReservationsListState>({
    reservations: [],
    isLoading: true,
    error: null,
    filters: {
      search: '',
      statuses: [],
      source: null,
      dateRange: { from: null, to: null }
    },
    sort: {
      column: 'created_at',
      order: 'desc'
    },
    pagination: {
      page: 1,
      limit: 25
    },
    total: 0
  });

  // Odczyt URL query params przy mount i zmianie
  useEffect(() => {
    // Parsowanie URL query params
    // Aktualizacja stanu na podstawie URL
  }, [window.location.search]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((search: string) => {
      // Aktualizacja filtra search i URL
    }, 300),
    []
  );

  // Funkcja pobierająca dane z API
  const fetchReservations = async (params: ReservationsQueryParams) => {
    // Budowanie query string dla PostgREST
    // Wykonanie zapytania do /api/reservations
    // Parsowanie odpowiedzi
    // Aktualizacja stanu
  };

  // Funkcje aktualizacji filtrów (z aktualizacją URL)
  const updateFilters = (filters: Partial<ReservationsListFilters>) => {
    // Aktualizacja stanu
    // Aktualizacja URL query params
    // Wywołanie fetchReservations
  };

  const updateSort = (column: string) => {
    // Toggle sort order jeśli ta sama kolumna
    // Aktualizacja URL i fetch
  };

  const updatePagination = (page: number, limit?: number) => {
    // Aktualizacja paginacji
    // Aktualizacja URL i fetch
  };

  return {
    ...state,
    updateFilters,
    updateSort,
    updatePagination,
    refetch: () => fetchReservations(state)
  };
}
```

### Synchronizacja z URL

**Strategia:**
- URL query parameters są **jedynym źródłem prawdy** dla stanu filtrów, sortowania i paginacji
- Przy mount komponentu: odczyt URL → aktualizacja stanu → fetch danych
- Przy zmianie filtrów: aktualizacja stanu → aktualizacja URL → fetch danych
- Użycie `window.history.pushState` lub React Router (jeśli dostępny) do aktualizacji URL bez przeładowania strony

**Format URL:**
```
/rezerwacje?search=kowalski&status=confirmed&status=in_progress&source=phone&date_from=2025-11-10&date_to=2025-11-17&sort_by=created_at&sort_order=desc&page=1&limit=25
```

---

## 7. Integracja API

### Endpoint: GET /api/reservations

**Lokalizacja:** `src/pages/api/reservations.ts` (wymaga rozszerzenia o GET handler)

**Opis:** Endpoint zwraca listę rezerwacji z obsługą filtrowania, sortowania i paginacji zgodnie z PostgREST API.

**Query Parameters (PostgREST style):**
- `select=*` - zwraca wszystkie kolumny
- `last_name=ilike.*<search>*` - wyszukiwanie po nazwisku (case-insensitive)
- `status=in.(confirmed,in_progress)` - filtry statusu (może być wiele)
- `source=eq.phone` - filtr źródła
- `planned_check_in=gte.<date>` - data przyjazdu >=
- `planned_check_out=lte.<date>` - data wyjazdu <=
- `order=<column>.<asc|desc>` - sortowanie
- `offset=<number>` - offset dla paginacji
- `limit=<number>` - limit wyników

**Request:**
```typescript
GET /api/reservations?select=*&last_name=ilike.*kowal*&status=in.(confirmed,in_progress)&source=eq.phone&planned_check_in=gte.2025-11-10&planned_check_out=lte.2025-11-17&order=created_at.desc&offset=0&limit=25
```

**Success Response (200 OK):**
```typescript
// Array of ReservationDto
ReservationDto[]
```

**Error Responses:**
- `400 Bad Request` - nieprawidłowe parametry zapytania
- `500 Internal Server Error` - błąd serwera

**Implementacja endpointu:**

```typescript
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Parsowanie query parameters
    const searchParams = url.searchParams;
    
    // Budowanie zapytania Supabase
    let query = locals.supabase.from('reservations').select('*', { count: 'exact' });
    
    // Filtrowanie po nazwisku (ilike)
    const search = searchParams.get('last_name');
    if (search && search.startsWith('ilike.*') && search.endsWith('*')) {
      const searchTerm = search.slice(7, -1); // Usuń 'ilike.*' i '*'
      query = query.ilike('last_name', `%${searchTerm}%`);
    }
    
    // Filtrowanie po statusie (in)
    const statusParam = searchParams.get('status');
    if (statusParam && statusParam.startsWith('in.(')) {
      const statuses = statusParam.slice(3, -1).split(',');
      query = query.in('status', statuses);
    }
    
    // Filtrowanie po źródle (eq)
    const source = searchParams.get('source');
    if (source && source.startsWith('eq.')) {
      query = query.eq('source', source.slice(3));
    }
    
    // Filtrowanie po datach (gte, lte)
    const checkInFrom = searchParams.get('planned_check_in');
    if (checkInFrom && checkInFrom.startsWith('gte.')) {
      query = query.gte('planned_check_in', checkInFrom.slice(4));
    }
    
    const checkOutTo = searchParams.get('planned_check_out');
    if (checkOutTo && checkOutTo.startsWith('lte.')) {
      query = query.lte('planned_check_out', checkOutTo.slice(4));
    }
    
    // Sortowanie (order)
    const orderParam = searchParams.get('order');
    if (orderParam) {
      const [column, order] = orderParam.split('.');
      query = query.order(column, { ascending: order === 'asc' });
    } else {
      // Domyślne sortowanie
      query = query.order('created_at', { ascending: false });
    }
    
    // Paginacja (offset, limit)
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    query = query.range(offset, offset + limit - 1);
    
    // Wykonanie zapytania
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch reservations: ${error.message}`);
    }
    
    // Zwrócenie odpowiedzi z metadanymi paginacji
    return new Response(
      JSON.stringify({
        data: data || [],
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
```

**Uwaga:** Powyższa implementacja jest uproszczona. W rzeczywistości należy użyć biblioteki do parsowania PostgREST query parameters lub zaimplementować pełny parser zgodny z dokumentacją PostgREST.

---

## 8. Interakcje użytkownika

### 8.1 Wyszukiwanie

**Flow:**
1. Użytkownik wpisuje tekst w SearchBar
2. Po 300ms od ostatniej zmiany (debounce) wartość jest aktualizowana
3. URL query parameter `search` jest aktualizowany
4. Zapytanie do API jest wykonywane z filtrem `last_name=ilike.*<text>*`
5. Lista rezerwacji jest odświeżana
6. Paginacja resetuje się do strony 1

**Obsługa:**
- Debounce 300ms redukuje liczbę zapytań do API
- Loading spinner w SearchBar podczas wyszukiwania
- Czyszczenie wartości (X) resetuje filtr i odświeża listę

### 8.2 Filtrowanie

**Flow dla statusu:**
1. Użytkownik zaznacza/odznacza checkbox statusu w FilterPanel
2. Filtr statusu jest aktualizowany w stanie
3. URL query parameters są aktualizowane (`status=confirmed&status=in_progress`)
4. Zapytanie do API jest wykonywane z filtrem `status=in.(confirmed,in_progress)`
5. Lista rezerwacji jest odświeżana
6. ActiveFiltersBadges wyświetla nowe badge dla statusu

**Flow dla źródła:**
1. Użytkownik wybiera radio button źródła
2. Filtr źródła jest aktualizowany
3. URL query parameter `source` jest aktualizowany (`source=phone` lub usunięty jeśli "Wszystkie")
4. Zapytanie do API jest wykonywane
5. Lista rezerwacji jest odświeżana

**Flow dla dat:**
1. Użytkownik wybiera zakres dat w DateRangePicker
2. Filtr dat jest aktualizowany
3. URL query parameters `date_from` i `date_to` są aktualizowane (ISO format)
4. Zapytanie do API jest wykonywane z filtrami `planned_check_in=gte.<date_from>` i `planned_check_out=lte.<date_to>`
5. Lista rezerwacji jest odświeżana

### 8.3 Sortowanie

**Flow:**
1. Użytkownik klika w header kolumny tabeli
2. Jeśli kolumna jest już sortowana, kierunek sortowania jest zmieniany (asc ↔ desc)
3. Jeśli kolumna jest inna, sortowanie jest ustawiane na nową kolumnę z domyślnym kierunkiem `desc`
4. URL query parameters `sort_by` i `sort_order` są aktualizowane
5. Zapytanie do API jest wykonywane z parametrem `order=<column>.<asc|desc>`
6. Lista rezerwacji jest odświeżana
7. Wizualny wskaźnik sortowania (strzałka ↑↓) jest aktualizowany w headerze kolumny

### 8.4 Paginacja

**Flow dla zmiany strony:**
1. Użytkownik klika przycisk "Następna" / "Poprzednia" lub numer strony
2. Parametr `page` jest aktualizowany w stanie
3. URL query parameter `page` jest aktualizowany
4. Zapytanie do API jest wykonywane z nowym `offset` (obliczonym z `page` i `limit`)
5. Lista rezerwacji jest odświeżana
6. Scroll do góry tabeli (opcjonalnie)

**Flow dla zmiany rozmiaru strony:**
1. Użytkownik wybiera nowy rozmiar strony z dropdown (10, 25, 50, 100)
2. Parametr `limit` jest aktualizowany
3. URL query parameter `limit` jest aktualizowany
4. Strona resetuje się do 1
5. Zapytanie do API jest wykonywane z nowym `limit`
6. Lista rezerwacji jest odświeżana

### 8.5 Usuwanie filtrów

**Flow:**
1. Użytkownik klika X na badge w ActiveFiltersBadges
2. Odpowiedni filtr jest usuwany ze stanu
3. URL query parameter jest usuwany
4. Zapytanie do API jest wykonywane bez tego filtra
5. Lista rezerwacji jest odświeżana
6. Badge znika z ActiveFiltersBadges

**Flow dla "Wyczyść wszystkie":**
1. Użytkownik klika przycisk "Wyczyść wszystkie"
2. Wszystkie filtry są resetowane do wartości domyślnych
3. URL query parameters są czyszczone (zachowane tylko `page` i `limit` jeśli potrzebne)
4. Zapytanie do API jest wykonywane bez filtrów
5. Lista rezerwacji jest odświeżana

### 8.6 Otwieranie szczegółów rezerwacji

**Flow:**
1. Użytkownik klika w wiersz tabeli lub kartę (mobile)
2. Modal lub nowa strona ze szczegółami rezerwacji jest otwierana
3. URL zmienia się na `/rezerwacje/[id]` (lub modal overlay)
4. Szczegóły rezerwacji są ładowane z API (`GET /api/reservations?id=eq.<id>`)

### 8.7 Akcje na rezerwacji

**Flow dla "Edytuj":**
1. Użytkownik klika "Edytuj" w dropdown menu
2. Modal z formularzem edycji jest otwierany
3. Formularz jest wypełniony danymi rezerwacji
4. Po zapisaniu zmian, lista rezerwacji jest odświeżana (refetch)

**Flow dla "Anuluj":**
1. Użytkownik klika "Anuluj" w dropdown menu
2. Confirmation dialog jest wyświetlany
3. Po potwierdzeniu, zapytanie `PATCH /api/reservations?id=eq.<id>` jest wykonywane z `status: 'cancelled'`
4. Lista rezerwacji jest odświeżana
5. Toast notification: "Rezerwacja anulowana"

---

## 9. Warunki i walidacja

### 9.1 Walidacja po stronie frontendu

**Wyszukiwanie:**
- Maksymalna długość: 100 znaków
- Minimalna długość do wyszukiwania: 2 znaki (opcjonalnie, może być puste)
- Trim whitespace przed wysłaniem

**Filtry dat:**
- Data początkowa (`date_from`) nie może być późniejsza niż data końcowa (`date_to`)
- Daty muszą być w formacie ISO 8601
- Walidacja formatu przed wysłaniem do API

**Filtry statusu:**
- Wartości muszą być z enum: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`
- Co najmniej jeden status musi być zaznaczony (jeśli filtry statusu są aktywne)

**Filtr źródła:**
- Wartość musi być z enum: `phone`, `walk_in`, `api` lub `null` (wszystkie)

**Sortowanie:**
- Kolumna (`sort_by`) musi być jedną z dozwolonych: `created_at`, `last_name`, `planned_check_in`, `planned_check_out`, `status`, `total_cost`
- Kierunek (`sort_order`) musi być `asc` lub `desc`

**Paginacja:**
- Numer strony (`page`) musi być liczbą całkowitą > 0
- Rozmiar strony (`limit`) musi być jedną z dozwolonych wartości: 10, 25, 50, 100
- Numer strony nie może przekraczać `totalPages`

### 9.2 Walidacja po stronie API

API endpoint `GET /api/reservations` powinien walidować:
- Format dat (ISO 8601)
- Wartości enum (status, source)
- Zakres wartości (offset >= 0, limit > 0 i <= 100)
- Dozwolone kolumny sortowania

Błędy walidacji powinny zwracać `400 Bad Request` z opisowym komunikatem.

### 9.3 Wpływ walidacji na stan UI

**Podczas ładowania:**
- Wszystkie kontrolki (filtry, sortowanie, paginacja) są disabled
- Skeleton loaders są wyświetlane zamiast danych

**Po błędzie walidacji:**
- Inline error message jest wyświetlany pod odpowiednim polem
- Toast notification dla błędów API
- ErrorState komponent dla krytycznych błędów (500, network error)

**Podczas wyszukiwania (debounce):**
- Loading spinner w SearchBar
- Disabled state dla innych kontroli (opcjonalnie)

---

## 10. Obsługa błędów

### 10.1 Scenariusze błędów

**Błąd sieci (Network Error):**
- **Obsługa:** Wyświetlenie ErrorState z komunikatem "Brak połączenia z internetem" i przyciskiem "Spróbuj ponownie"
- **Komponent:** `ErrorState` z `onRetry` callback
- **Akcja użytkownika:** Przycisk "Spróbuj ponownie" wykonuje refetch

**Błąd 400 Bad Request (nieprawidłowe parametry):**
- **Obsługa:** Toast notification z komunikatem błędu
- **Akcja:** Automatyczne wyczyszczenie nieprawidłowych parametrów z URL i refetch z domyślnymi wartościami

**Błąd 500 Internal Server Error:**
- **Obsługa:** ErrorState z komunikatem "Wystąpił błąd serwera" i przyciskiem "Spróbuj ponownie"
- **Logowanie:** Błąd jest logowany do console.error dla debugowania

**Brak wyników (pusta lista):**
- **Obsługa:** EmptyState z komunikatem "Nie znaleziono rezerwacji spełniających wybrane kryteria" i przyciskiem "Wyczyść filtry"
- **Komponent:** `EmptyState` z ikoną i CTA

**Timeout zapytania:**
- **Obsługa:** Toast notification "Zapytanie trwa zbyt długo. Spróbuj ponownie."
- **Akcja:** Automatyczny retry po 3 sekundach (opcjonalnie)

### 10.2 Strategia retry

**Automatyczny retry:**
- Dla błędów sieci: 3 próby z exponential backoff (1s, 2s, 4s)
- Dla błędów 500: 2 próby z delay 2s
- Dla błędów 400: brak automatycznego retry (błąd użytkownika)

**Manual retry:**
- Przycisk "Spróbuj ponownie" w ErrorState
- Przycisk "Odśwież" w headerze (opcjonalnie)

### 10.3 Fallback states

**Podczas błędu:**
- Zachowanie ostatnio załadowanych danych (jeśli dostępne) z bannerem informującym o błędzie
- Disabled state dla wszystkich akcji (filtry, sortowanie, paginacja)
- Wyświetlenie ErrorState tylko jeśli nie ma żadnych danych w cache

---

## 11. Kroki implementacji

### Krok 1: Rozszerzenie endpointu API

1. **Dodaj handler GET do `src/pages/api/reservations.ts`**
   - Implementacja parsowania PostgREST query parameters
   - Budowanie zapytania Supabase z filtrami, sortowaniem i paginacją
   - Zwracanie odpowiedzi z metadanymi paginacji (total, page, limit, totalPages)
   - Obsługa błędów i walidacji

2. **Testowanie endpointu:**
   - Test z różnymi kombinacjami filtrów
   - Test sortowania i paginacji
   - Test błędów (nieprawidłowe parametry)

### Krok 2: Rozszerzenie typów

1. **Dodaj nowe typy do `src/types.ts`:**
   - `ReservationsListFilters`
   - `SortParams`
   - `PaginationParams`
   - `ReservationsQueryParams`
   - `ReservationsListResponse`
   - `ReservationsListState`
   - `SortableColumn`
   - `ReservationTableRowViewModel`
   - `ReservationCardViewModel`

### Krok 3: Implementacja custom hooka

1. **Utwórz `src/hooks/useReservationsList.ts`:**
   - Stan komponentu z filtrami, sortowaniem, paginacją
   - Funkcja parsowania URL query parameters
   - Funkcja budowania query string dla API
   - Funkcja fetchReservations z obsługą błędów
   - Funkcje updateFilters, updateSort, updatePagination
   - Debounce dla wyszukiwania (300ms)
   - Synchronizacja z URL (pushState)

2. **Testowanie hooka:**
   - Test odczytu URL query params
   - Test aktualizacji URL przy zmianie filtrów
   - Test debounce dla wyszukiwania

### Krok 4: Implementacja komponentów pomocniczych

1. **SearchBar (`src/components/shared/SearchBar.tsx`):**
   - Input z ikoną wyszukiwania
   - Przycisk czyszczenia (X)
   - Debounce onChange (300ms)
   - Loading state

2. **DateRangePicker (`src/components/shared/DateRangePicker.tsx`):**
   - Integracja z Shadcn Calendar
   - Wybór zakresu dat
   - Formatowanie wyświetlania

3. **StatusFilter (`src/components/reservations/StatusFilter.tsx`):**
   - Multi-select checkboxes dla statusów
   - Kolorowe ikony dla każdego statusu
   - Etykiety w języku polskim

4. **SourceFilter (`src/components/reservations/SourceFilter.tsx`):**
   - Radio button group
   - Opcja "Wszystkie"

5. **ActiveFiltersBadges (`src/components/reservations/ActiveFiltersBadges.tsx`):**
   - Wyświetlanie aktywnych filtrów jako badges
   - Przycisk X na każdym badge
   - Przycisk "Wyczyść wszystkie"

6. **PaginationControls (`src/components/shared/PaginationControls.tsx`):**
   - Informacja o liczbie wyników
   - Page size selector
   - Nawigacja stron z numerami

### Krok 5: Implementacja głównych komponentów

1. **FilterPanel (`src/components/reservations/FilterPanel.tsx`):**
   - Collapsible sidebar
   - Integracja DateRangePicker, StatusFilter, SourceFilter
   - Przycisk "Wyczyść filtry"

2. **ReservationTable (`src/components/reservations/ReservationTable.tsx`):**
   - Tabela z kolumnami (Nazwisko, Telefon, Daty, Status, Koszt, Akcje)
   - Sortowanie kolumn (klikalne headery)
   - Actions dropdown (3 dots)
   - Skeleton loaders
   - Formatowanie danych (telefon, daty, koszt)

3. **ReservationCards (`src/components/reservations/ReservationCards.tsx`):**
   - Widok kart dla mobile
   - Te same dane co tabela
   - Skeleton loaders

### Krok 6: Implementacja głównego kontenera

1. **ReservationsListContainer (`src/components/reservations/ReservationsListContainer.tsx`):**
   - Integracja useReservationsList hook
   - Layout z FilterPanel i główną treścią
   - Koordynacja między komponentami
   - Obsługa błędów (ErrorState)
   - Empty state
   - Responsywność (tabela desktop / karty mobile)

### Krok 7: Implementacja strony Astro

1. **Utwórz `src/pages/rezerwacje.astro`:**
   - Import ReservationsListContainer
   - Layout z Header i Sidebar (jeśli dostępne)
   - Client-side hydration dla React komponentu

### Krok 8: Formatowanie i utility functions

1. **Utwórz utility functions:**
   - `src/lib/utils/reservation.formatters.ts`:
     - `formatPhone(phone: string | null): string`
     - `formatDateRange(from: Date, to: Date): string`
     - `formatCost(cost: number): string`
     - `getStatusLabel(status: ReservationStatus): string`
     - `getStatusColor(status: ReservationStatus): string`
     - `getSourceLabel(source: ReservationSource): string`

2. **Utwórz helper functions:**
   - `src/lib/utils/url-params.ts`:
     - `parseQueryParams(url: string): ReservationsQueryParams`
     - `buildQueryString(params: ReservationsQueryParams): string`
     - `updateUrlParams(params: Partial<ReservationsQueryParams>): void`

### Krok 9: Testowanie i poprawki

1. **Testowanie funkcjonalności:**
   - Wyszukiwanie z różnymi frazami
   - Filtrowanie (status, źródło, daty)
   - Sortowanie wszystkich kolumn
   - Paginacja (zmiana strony i rozmiaru)
   - Usuwanie filtrów
   - Responsywność (desktop i mobile)
   - Obsługa błędów (network, 400, 500)
   - Empty state

2. **Testowanie wydajności:**
   - Debounce działa poprawnie (300ms)
   - Liczba zapytań do API jest zoptymalizowana
   - Skeleton loaders wyświetlają się podczas ładowania

3. **Testowanie dostępności:**
   - Keyboard navigation
   - ARIA labels
   - Screen reader compatibility

### Krok 10: Integracja z istniejącymi komponentami

1. **Integracja z nawigacją:**
   - Dodaj link do `/rezerwacje` w Sidebar
   - Active state dla linku

2. **Integracja z formularzem nowej rezerwacji:**
   - Po utworzeniu rezerwacji, przekierowanie do `/rezerwacje` z filtrem na nową rezerwację (opcjonalnie)

3. **Integracja ze szczegółami rezerwacji:**
   - Link z tabeli/karty do szczegółów
   - Powrót do listy z zachowaniem filtrów (back button)

### Krok 11: Dokumentacja i finalizacja

1. **Dokumentacja:**
   - Komentarze w kodzie
   - README dla komponentów (opcjonalnie)

2. **Finalizacja:**
   - Code review
   - Linting i formatowanie
   - Usunięcie console.log i debug code
   - Optymalizacja wydajności

---

**Koniec planu implementacji**


