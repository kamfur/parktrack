# Plan implementacji widoku Dashboard

## 1. Przegląd

Dashboard jest głównym widokiem aplikacji ParkTrack, zaprojektowanym do obsługi codziennych operacji parkingowych. Widok zapewnia szybki przegląd kluczowych metryk dzisiejszego dnia oraz umożliwia obsługę procesów check-in i check-out dla rezerwacji. Głównym celem jest umożliwienie pracownikom parkingu sprawnej obsługi klientów poprzez intuicyjne listy przyjazdów i wyjazdów, posortowane chronologicznie.

Widok składa się z trzech głównych sekcji:
- **Metryki** - cztery karty z kluczowymi wskaźnikami (wolne miejsca, liczba rezerwacji, przyjazdy, wyjazdy)
- **Lista Przyjazdów** - rezerwacje z zaplanowanym check-in na dzisiaj
- **Lista Wyjazdów** - rezerwacje z zaplanowanym check-out na dzisiaj

## 2. Routing widoku

Widok Dashboard będzie dostępny pod główną ścieżką aplikacji:

```
/ (root path)
```

W strukturze projektu Astro będzie to plik: `src/pages/index.astro`

## 3. Struktura komponentów

Hierarchia komponentów dla widoku Dashboard:

```
Dashboard (index.astro)
├── MetricsSection (React)
│   ├── MetricCard (wolne miejsca)
│   ├── MetricCard (rezerwacje)
│   ├── MetricCard (przyjazdy)
│   └── MetricCard (wyjazdy)
└── TodayView (React)
    ├── ArrivalsColumn
    │   └── ReservationCard[] (z przyciskiem Check-in)
    └── DeparturesColumn
        └── ReservationCard[] (z przyciskiem Check-out)
```

**Uwagi dotyczące architektury:**
- Dashboard (index.astro) - strona Astro, która integruje komponenty React
- Wszystkie komponenty interaktywne będą w React z dyrektywą `client:load`
- Komponenty będą umieszczone w katalogu `src/components/dashboard/`
- Komponenty UI z Shadcn/ui będą wykorzystane dla przycisków, kart, itp.

## 4. Szczegóły komponentów

### 4.1 Dashboard (index.astro)

**Opis komponentu:**
Główny plik strony Astro, który służy jako kontener dla całego widoku Dashboard. Odpowiada za routing i integrację komponentów React. Jest punktem wejściowym dla aplikacji i koordynuje wszystkie sekcje dashboardu.

**Główne elementy:**
- Layout wrapper (BaseLayout lub DashboardLayout)
- Tytuł strony i meta tagi
- DashboardContainer (główny komponent React)

**Obsługiwane zdarzenia:**
Brak - jest to kontener Astro, logika znajduje się w komponentach React.

**Warunki walidacji:**
Brak - walidacja odbywa się na poziomie komponentów React.

**Typy:**
Brak specyficznych typów dla tego komponentu.

**Propsy:**
Brak - jest to strona główna.

---

### 4.2 DashboardContainer (React)

**Opis komponentu:**
Główny kontener React odpowiedzialny za zarządzanie stanem całego dashboardu, pobieranie danych z API oraz koordynację wszystkich podkomponentów. Wykorzystuje custom hook `useDashboard` do zarządzania logiką biznesową.

**Główne elementy:**
- `<div>` kontener z klasami Tailwind dla layoutu
- `<MetricsSection>` - sekcja z metrykami
- `<TodayView>` - sekcja z listami przyjazdów i wyjazdów
- Loading skeleton podczas ładowania danych
- Error state w przypadku błędów

**Obsługiwane zdarzenia:**
- Inicjalizacja: pobieranie danych przy montowaniu komponentu
- Refresh: automatyczne odświeżanie danych (opcjonalne)
- onCheckIn: callback obsługujący check-in rezerwacji
- onCheckOut: callback obsługujący check-out rezerwacji

**Warunki walidacji:**
Brak - komponent głównie koordynuje działanie innych komponentów.

**Typy:**
- `DashboardData` (ViewModel dla stanu dashboardu)
- `ReservationDto` (z types.ts)

**Propsy:**
Brak - jest to komponent główny.

---

### 4.3 MetricsSection (React)

**Opis komponentu:**
Sekcja wyświetlająca cztery karty z kluczowymi metrykami dzisiejszego dnia. Prezentuje dane w formie wizualnej z użyciem ikon i kolorystyki dla lepszej czytelności.

**Główne elementy:**
- `<div>` kontener grid (4 kolumny na desktopie, responsive dla mniejszych ekranów)
- 4x `<MetricCard>` z różnymi danymi i ikonami
  - Wolne miejsca (zielony akcent)
  - Wszystkie rezerwacje (niebieski akcent)
  - Przyjazdy (pomarańczowy akcent)
  - Wyjazdy (fioletowy akcent)

**Obsługiwane zdarzenia:**
Brak - komponent prezentacyjny.

**Warunki walidacji:**
Brak - wyświetla tylko dane przekazane przez props.

**Typy:**
- `DashboardMetrics` (interfejs dla metryk)

**Propsy:**
```typescript
interface MetricsSectionProps {
  metrics: DashboardMetrics;
  isLoading?: boolean;
}
```

---

### 4.4 MetricCard (React)

**Opis komponentu:**
Pojedyncza karta metryki wyświetlająca wartość liczbową, etykietę oraz ikonę. Komponent wykorzystuje Card z Shadcn/ui i jest w pełni responsywny.

**Główne elementy:**
- `<Card>` z Shadcn/ui
- `<CardContent>` zawierający:
  - Ikonę (React Icon lub Lucide)
  - Wartość liczbową (duża czcionka, pogrubiona)
  - Etykietę opisową (mniejsza czcionka)
  - Border-left z kolorowym akcentem

**Obsługiwane zdarzenia:**
Brak - komponent prezentacyjny.

**Warunki walidacji:**
- Wartość (value) powinna być liczbą nieujemną
- Label nie może być pusty

**Typy:**
- `MetricCardProps` (interfejs dla props)

**Propsy:**
```typescript
interface MetricCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  accentColor: 'green' | 'blue' | 'orange' | 'purple';
  isLoading?: boolean;
}
```

---

### 4.5 TodayView (React)

**Opis komponentu:**
Kontener dla dwóch kolumn zawierających listy przyjazdów i wyjazdów. Odpowiada za layout i responsive design (na mobile kolumny układają się pionowo).

**Główne elementy:**
- `<div>` kontener grid (2 kolumny na desktopie, 1 kolumna na mobile)
- `<ArrivalsColumn>` - lewa kolumna
- `<DeparturesColumn>` - prawa kolumna

**Obsługiwane zdarzenia:**
- Propagacja zdarzeń check-in i check-out z kolumn do rodzica

**Warunki walidacji:**
Brak - komponent layoutowy.

**Typy:**
- `ReservationDto[]` (listy rezerwacji)

**Propsy:**
```typescript
interface TodayViewProps {
  arrivals: ReservationDto[];
  departures: ReservationDto[];
  onCheckIn: (reservationId: string) => Promise<void>;
  onCheckOut: (reservationId: string) => Promise<void>;
  isLoading?: boolean;
}
```

---

### 4.6 ArrivalsColumn (React)

**Opis komponentu:**
Kolumna wyświetlająca listę dzisiejszych przyjazdów, posortowaną chronologicznie według planned_check_in. Każda rezerwacja jest reprezentowana przez ReservationCard z przyciskiem "Check-in".

**Główne elementy:**
- Nagłówek sekcji z tytułem "Przyjazdy" i licznikiem
- Scrollowalna lista `<ReservationCard>` komponentów
- Empty state gdy brak przyjazdów
- Loading skeletons podczas ładowania

**Obsługiwane zdarzenia:**
- onCheckIn: obsługa kliknięcia przycisku Check-in

**Warunki walidacji:**
- Przycisk Check-in aktywny tylko dla rezerwacji ze statusem "confirmed"
- Rezerwacje z actual_check_in (już zameldowane) nie powinny mieć aktywnego przycisku

**Typy:**
- `ReservationDto[]`
- `CheckInCommand` (dla akcji check-in)

**Propsy:**
```typescript
interface ArrivalsColumnProps {
  arrivals: ReservationDto[];
  onCheckIn: (reservationId: string) => Promise<void>;
  isLoading?: boolean;
}
```

---

### 4.7 DeparturesColumn (React)

**Opis komponentu:**
Kolumna wyświetlająca listę dzisiejszych wyjazdów, posortowaną chronologicznie według planned_check_out. Każda rezerwacja jest reprezentowana przez ReservationCard z przyciskiem "Check-out".

**Główne elementy:**
- Nagłówek sekcji z tytułem "Wyjazdy" i licznikiem
- Scrollowalna lista `<ReservationCard>` komponentów
- Empty state gdy brak wyjazdów
- Loading skeletons podczas ładowania

**Obsługiwane zdarzenia:**
- onCheckOut: obsługa kliknięcia przycisku Check-out

**Warunki walidacji:**
- Przycisk Check-out aktywny tylko dla rezerwacji ze statusem "in_progress"
- Rezerwacje z actual_check_out (już wymelodowane) nie powinny być widoczne
- Rezerwacja musi mieć actual_check_in (klient musi być zameldowany)

**Typy:**
- `ReservationDto[]`
- `CheckOutCommand` (dla akcji check-out)

**Propsy:**
```typescript
interface DeparturesColumnProps {
  departures: ReservationDto[];
  onCheckOut: (reservationId: string) => Promise<void>;
  isLoading?: boolean;
}
```

---

### 4.8 ReservationCard (React)

**Opis komponentu:**
Kompaktowa karta wyświetlająca kluczowe informacje o rezerwacji. Stanowi główny element listy przyjazdów i wyjazdów. Karta zawiera dane klienta, status rezerwacji oraz przycisk akcji (Check-in lub Check-out w zależności od kontekstu).

**Główne elementy:**
- `<Card>` z Shadcn/ui z kolorowym border-left według statusu
- Nazwa klienta (imię i nazwisko)
- Ikona telefonu + numer telefonu
- Ikona samochodu + numer rejestracyjny (jeśli dostępny)
- Ikona zegara + godzina (check-in lub check-out)
- Przycisk akcji (Check-in lub Check-out)
- Hover state z dodatkowymi informacjami (email, notatki)

**Obsługiwane zdarzenia:**
- onClick na przycisku akcji: wywołanie odpowiedniego callbacku (onCheckIn lub onCheckOut)
- onHover: wyświetlenie dodatkowych informacji

**Warunki walidacji:**
- Przycisk Check-in:
  - Dostępny tylko dla statusu "confirmed"
  - Disabled gdy actual_check_in jest już ustawiony
- Przycisk Check-out:
  - Dostępny tylko dla statusu "in_progress"
  - Wymagane actual_check_in (klient musi być zameldowany)
  - Disabled gdy actual_check_out jest już ustawiony

**Typy:**
- `ReservationDto`
- `ReservationCardProps`

**Propsy:**
```typescript
interface ReservationCardProps {
  reservation: ReservationDto;
  actionType: 'check-in' | 'check-out';
  onAction: (reservationId: string) => Promise<void>;
  isLoading?: boolean;
}
```

---

## 5. Typy

### 5.1 Istniejące typy (z src/types.ts)

```typescript
// Główny typ reprezentujący rezerwację (już istnieje)
export type ReservationDto = Reservation;

// Interfejs dla obiektu Reservation (pochodzący z database.types)
export type Reservation = Tables<"reservations">;
// Zawiera pola:
// - id: string (UUID)
// - last_name: string
// - first_name: string | null
// - email: string | null
// - phone: string | null
// - license_plate: string | null
// - flight_direction: string | null
// - status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
// - source: 'phone' | 'walk_in' | 'api'
// - total_cost: number | null
// - is_paid: boolean
// - notes: string | null
// - planned_check_in: string (ISO timestamp)
// - planned_check_out: string (ISO timestamp)
// - actual_check_in: string | null (ISO timestamp)
// - actual_check_out: string | null (ISO timestamp)
// - created_at: string (ISO timestamp)
// - updated_at: string (ISO timestamp)
// - created_by: string | null (UUID)
// - last_modified_by: string | null (UUID)
```

### 5.2 Nowe typy dla widoku Dashboard

Typy należy zdefiniować w pliku `src/types.ts` lub w dedykowanym pliku `src/types/dashboard.types.ts`:

```typescript
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
}

/**
 * Command model dla operacji check-in.
 * Aktualizuje status rezerwacji na 'in_progress' i ustawia actual_check_in.
 */
export interface CheckInCommand {
  /** Nowy status rezerwacji */
  status: 'in_progress';
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
  status: 'completed';
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
  value: number;
  /** Etykieta opisowa */
  label: string;
  /** Kolor akcentu dla border-left */
  accentColor: 'green' | 'blue' | 'orange' | 'purple';
  /** Czy karta jest w stanie ładowania */
  isLoading?: boolean;
}

/**
 * Props dla komponentu ReservationCard
 */
export interface ReservationCardProps {
  /** Obiekt rezerwacji do wyświetlenia */
  reservation: ReservationDto;
  /** Typ akcji dostępnej na karcie */
  actionType: 'check-in' | 'check-out';
  /** Callback wywoływany po kliknięciu przycisku akcji */
  onAction: (reservationId: string) => Promise<void>;
  /** Czy akcja jest w trakcie wykonywania */
  isLoading?: boolean;
}
```

---

## 6. Zarządzanie stanem

### 6.1 Strategia zarządzania stanem

Zarządzanie stanem w widoku Dashboard będzie oparte na React hooks (useState, useEffect) oraz custom hook `useDashboard`, który enkapsuluje całą logikę biznesową. Nie jest wymagane użycie zewnętrznych bibliotek do zarządzania stanem (Redux, Zustand) ze względu na lokalny charakter stanu dashboardu.

### 6.2 Custom Hook: useDashboard

Hook będzie zlokalizowany w pliku `src/hooks/useDashboard.ts` i będzie odpowiedzialny za:
- Pobieranie danych z API (arrivals, departures, metrics)
- Zarządzanie stanami loading i error
- Obsługę akcji check-in i check-out
- Automatyczne odświeżanie listy po wykonaniu akcji
- Opcjonalnie: real-time updates przez Supabase subscriptions

**Struktura hooka:**

```typescript
export function useDashboard() {
  // Stan
  const [state, setState] = useState<DashboardState>({
    data: null,
    isLoading: true,
    error: null,
    isProcessing: false,
  });

  // Funkcja pobierająca dane dashboardu
  const fetchDashboardData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Równoległe zapytania do API
      const [arrivalsRes, departuresRes, settingsRes] = await Promise.all([
        fetch('/api/rpc/get_todays_arrivals', { method: 'POST' }),
        fetch('/api/reservations/departures', { method: 'POST' }),
        // fetch('/api/settings?key=eq.total_parking_spots') // póki co hardcoded
      ]);

      const arrivals = await arrivalsRes.json();
      const departures = await departuresRes.json();
      
      // Kalkulacja metryk
      const metrics = calculateMetrics(arrivals, departures);
      
      setState({
        data: {
          todaysArrivals: arrivals,
          todaysDepartures: departures,
          metrics,
        },
        isLoading: false,
        error: null,
        isProcessing: false,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  };

  // Funkcja wykonująca check-in
  const handleCheckIn = async (reservationId: string) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      const command: CheckInCommand = {
        status: 'in_progress',
        actual_check_in: new Date().toISOString(),
      };

      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error('Failed to check-in');
      }

      // Odświeżenie danych po sukcesie
      await fetchDashboardData();
    } catch (error) {
      console.error('Check-in error:', error);
      // Obsługa błędu (toast notification)
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Funkcja wykonująca check-out
  const handleCheckOut = async (reservationId: string) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      const command: CheckOutCommand = {
        status: 'completed',
        actual_check_out: new Date().toISOString(),
      };

      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error('Failed to check-out');
      }

      // Odświeżenie danych po sukcesie
      await fetchDashboardData();
    } catch (error) {
      console.error('Check-out error:', error);
      // Obsługa błędu (toast notification)
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Inicjalizacja: pobierz dane przy montowaniu
  useEffect(() => {
    fetchDashboardData();
  }, []);

  return {
    ...state,
    refetch: fetchDashboardData,
    handleCheckIn,
    handleCheckOut,
  };
}
```

### 6.3 Funkcje pomocnicze

**calculateMetrics** - funkcja pomocnicza do kalkulacji metryk:

```typescript
function calculateMetrics(
  arrivals: ReservationDto[],
  departures: ReservationDto[]
): DashboardMetrics {
  // Stała liczba miejsc (póki co hardcoded, później z API)
  const TOTAL_SPOTS = 100;
  
  // Rezerwacje aktywne na dziś (in_progress + confirmed arrivals)
  const activeReservations = arrivals.filter(
    r => r.status === 'confirmed' || r.status === 'in_progress'
  ).length;
  
  return {
    availableSpots: TOTAL_SPOTS - activeReservations,
    totalReservations: arrivals.length + departures.length,
    plannedArrivals: arrivals.length,
    plannedDepartures: departures.length,
  };
}
```

---

## 7. Integracja API

### 7.1 Endpointy wykorzystywane przez widok

Dashboard wykorzystuje następujące endpointy API:

#### 7.1.1 POST `/api/rpc/get_todays_arrivals`

**Opis:** Pobiera wszystkie rezerwacje z zaplanowanym check-in na dzisiaj, posortowane chronologicznie.

**Request:**
- Metoda: POST
- Headers: `Content-Type: application/json`
- Body: (pusty)

**Response (sukces):**
- Status: 200 OK
- Content-Type: application/json
- Body: 
```typescript
ReservationDto[] // Tablica obiektów rezerwacji
```

**Response (błąd):**
- Status: 500 Internal Server Error
- Body:
```typescript
{
  error: string; // Komunikat błędu
}
```

#### 7.1.2 POST `/api/reservations/departures`

**Opis:** Pobiera wszystkie rezerwacje z zaplanowanym check-out na dzisiaj, posortowane chronologicznie.

**Request:**
- Metoda: POST
- Headers: `Content-Type: application/json`
- Body: (pusty)

**Response (sukces):**
- Status: 200 OK
- Content-Type: application/json
- Body:
```typescript
ReservationDto[] // Tablica obiektów rezerwacji
```

**Response (błąd):**
- Status: 500 Internal Server Error
- Body:
```typescript
{
  error: string; // Komunikat błędu
}
```

#### 7.1.3 PATCH `/api/reservations?id=eq.<uuid>`

**Opis:** Aktualizuje rezerwację (używane dla check-in i check-out).

**Request dla Check-in:**
- Metoda: PATCH
- Headers: `Content-Type: application/json`
- Body:
```typescript
CheckInCommand // { status: 'in_progress', actual_check_in: string, license_plate?: string }
```

**Request dla Check-out:**
- Metoda: PATCH
- Headers: `Content-Type: application/json`
- Body:
```typescript
CheckOutCommand // { status: 'completed', actual_check_out: string, is_paid?: boolean }
```

**Response (sukces):**
- Status: 200 OK
- Content-Type: application/json
- Body:
```typescript
ReservationDto // Zaktualizowany obiekt rezerwacji
```

**Response (błąd):**
- Status: 400 Bad Request (błędne dane)
- Status: 404 Not Found (rezerwacja nie istnieje)
- Body:
```typescript
{
  error: string; // Komunikat błędu
}
```

#### 7.1.4 GET `/api/settings?key=eq.total_parking_spots` (przyszłość)

**Opis:** Pobiera całkowitą liczbę miejsc parkingowych.

**Uwaga:** Na razie wartość będzie hardcoded w kodzie frontendu. Endpoint zostanie dodany później.

### 7.2 Przepływ danych

1. **Inicjalizacja dashboardu:**
   - `useDashboard` hook wywołuje `fetchDashboardData()` przy montowaniu
   - Równoległe zapytania do `/api/rpc/get_todays_arrivals` i `/api/reservations/departures`
   - Kalkulacja metryk na podstawie pobranych danych
   - Aktualizacja stanu z danymi

2. **Check-in rezerwacji:**
   - Użytkownik klika przycisk "Check-in" na karcie rezerwacji
   - `handleCheckIn` tworzy `CheckInCommand` z aktualnym timestampem
   - Zapytanie PATCH do `/api/reservations?id=eq.<uuid>`
   - Po sukcesie: odświeżenie danych dashboardu (`fetchDashboardData`)
   - Wyświetlenie toast notification o sukcesie

3. **Check-out rezerwacji:**
   - Użytkownik klika przycisk "Check-out" na karcie rezerwacji
   - `handleCheckOut` tworzy `CheckOutCommand` z aktualnym timestampem
   - Zapytanie PATCH do `/api/reservations?id=eq.<uuid>`
   - Po sukcesie: odświeżenie danych dashboardu (`fetchDashboardData`)
   - Wyświetlenie toast notification o sukcesie

---

## 8. Interakcje użytkownika

### 8.1 Przeglądanie dashboardu

**Scenariusz:** Pracownik otwiera aplikację i widzi dashboard.

**Kroki:**
1. Użytkownik wchodzi na stronę główną (/)
2. Dashboard automatycznie pobiera dane z API
3. Wyświetlane są loading skeletons podczas ładowania
4. Po załadowaniu danych wyświetlają się:
   - 4 karty metryk z aktualnymi wartościami
   - Lista przyjazdów w lewej kolumnie
   - Lista wyjazdów w prawej kolumnie
5. Użytkownik może przewijać listy, jeśli są długie

**Obsługiwane interakcje:**
- Scroll w kolumnach (jeśli lista jest długa)
- Hover na karcie rezerwacji (pokazuje dodatkowe informacje)

### 8.2 Check-in rezerwacji (przyjazd klienta)

**Scenariusz:** Klient przyjeżdża na parking, pracownik wykonuje check-in.

**Kroki:**
1. Pracownik otwiera dashboard i przegląda kolumnę "Przyjazdy"
2. Znajduje rezerwację klienta (po nazwisku lub godzinie)
3. Klika przycisk "Check-in" na karcie rezerwacji
4. Przycisk zmienia stan na "loading" (spinner)
5. System wysyła zapytanie PATCH do API
6. Po sukcesie:
   - Wyświetlany jest toast z komunikatem sukcesu
   - Lista przyjazdów i wyjazdów jest automatycznie odświeżana
   - Rezerwacja znika z listy przyjazdów lub zmienia status
   - Metryki są aktualizowane
7. W przypadku błędu:
   - Wyświetlany jest toast z komunikatem błędu
   - Przycisk wraca do stanu aktywnego

**Walidacja:**
- Przycisk "Check-in" jest aktywny tylko dla rezerwacji ze statusem "confirmed"
- Przycisk jest disabled, jeśli actual_check_in jest już ustawiony

### 8.3 Check-out rezerwacji (wyjazd klienta)

**Scenariusz:** Klient wyjeżdża z parkingu, pracownik wykonuje check-out.

**Kroki:**
1. Pracownik otwiera dashboard i przegląda kolumnę "Wyjazdy"
2. Znajduje rezerwację klienta (po nazwisku lub godzinie)
3. Przyjmuje płatność na miejscu (jeśli niezbędne)
4. Klika przycisk "Check-out" na karcie rezerwacji
5. Przycisk zmienia stan na "loading" (spinner)
6. System wysyła zapytanie PATCH do API
7. Po sukcesie:
   - Wyświetlany jest toast z komunikatem sukcesu
   - Lista wyjazdów jest automatycznie odświeżana
   - Rezerwacja znika z listy wyjazdów
   - Metryki są aktualizowane (wolne miejsca zwiększają się)
8. W przypadku błędu:
   - Wyświetlany jest toast z komunikatem błędu
   - Przycisk wraca do stanu aktywnego

**Walidacja:**
- Przycisk "Check-out" jest aktywny tylko dla rezerwacji ze statusem "in_progress"
- Rezerwacja musi mieć actual_check_in (klient musi być zameldowany)
- Przycisk jest disabled, jeśli actual_check_out jest już ustawiony

### 8.4 Odświeżanie danych

**Scenariusz:** Dane dashboardu wymagają odświeżenia.

**Implementacja:**
- Automatyczne odświeżanie po każdej akcji (check-in, check-out)
- Opcjonalnie: przycisk "Odśwież" w nagłówku dashboardu
- Opcjonalnie: real-time updates przez Supabase subscriptions (przyszłość)

---

## 9. Warunki i walidacja

### 9.1 Walidacja na poziomie UI

#### MetricCard
- **Warunek:** `value >= 0`
- **Komponent:** MetricCard
- **Wpływ:** Jeśli wartość jest ujemna lub nieprawidłowa, wyświetl "N/A" lub "0"

#### ReservationCard - Przycisk Check-in
- **Warunek 1:** `reservation.status === 'confirmed'`
  - **Komponent:** ReservationCard w ArrivalsColumn
  - **Wpływ:** Przycisk jest widoczny i aktywny tylko dla statusu "confirmed"
  
- **Warunek 2:** `reservation.actual_check_in === null`
  - **Komponent:** ReservationCard w ArrivalsColumn
  - **Wpływ:** Przycisk jest disabled, jeśli check-in już został wykonany

- **Warunek 3:** `!isProcessing`
  - **Komponent:** ReservationCard w ArrivalsColumn
  - **Wpływ:** Przycisk jest disabled podczas wykonywania operacji (loading state)

**Implementacja:**
```typescript
const isCheckInDisabled = 
  reservation.status !== 'confirmed' || 
  reservation.actual_check_in !== null || 
  isProcessing;
```

#### ReservationCard - Przycisk Check-out
- **Warunek 1:** `reservation.status === 'in_progress'`
  - **Komponent:** ReservationCard w DeparturesColumn
  - **Wpływ:** Przycisk jest widoczny i aktywny tylko dla statusu "in_progress"
  
- **Warunek 2:** `reservation.actual_check_in !== null`
  - **Komponent:** ReservationCard w DeparturesColumn
  - **Wpływ:** Rezerwacja jest widoczna tylko jeśli klient został już zameldowany

- **Warunek 3:** `reservation.actual_check_out === null`
  - **Komponent:** ReservationCard w DeparturesColumn
  - **Wpływ:** Przycisk jest disabled, jeśli check-out już został wykonany

- **Warunek 4:** `!isProcessing`
  - **Komponent:** ReservationCard w DeparturesColumn
  - **Wpływ:** Przycisk jest disabled podczas wykonywania operacji (loading state)

**Implementacja:**
```typescript
const isCheckOutDisabled = 
  reservation.status !== 'in_progress' || 
  reservation.actual_check_in === null ||
  reservation.actual_check_out !== null || 
  isProcessing;
```

### 9.2 Filtrowanie list

#### Lista Przyjazdów
- **Warunek:** Rezerwacje z `planned_check_in` w dzisiejszym dniu
- **Sortowanie:** Chronologicznie według `planned_check_in` (rosnąco)
- **Implementacja:** Filtrowanie odbywa się po stronie backendu (RPC function)

#### Lista Wyjazdów
- **Warunek:** Rezerwacje z `planned_check_out` w dzisiejszym dniu
- **Sortowanie:** Chronologicznie według `planned_check_out` (rosnąco)
- **Implementacja:** Filtrowanie odbywa się po stronie backendu (endpoint departures)

### 9.3 Walidacja danych wejściowych

Wszystkie dane wejściowe dla akcji check-in i check-out są generowane automatycznie przez system (timestamp), więc nie wymagają walidacji po stronie użytkownika. Walidacja odbywa się na poziomie API.

---

## 10. Obsługa błędów

### 10.1 Błędy pobierania danych

**Scenariusz:** Błąd podczas ładowania danych dashboardu (fetchDashboardData).

**Obsługa:**
1. Przechwytywanie błędu w bloku try-catch
2. Ustawienie `state.error` z komunikatem błędu
3. Wyświetlenie error state w UI:
   - Komunikat: "Nie udało się załadować danych dashboardu"
   - Przycisk "Spróbuj ponownie" wywołujący `refetch()`
   - Ikona błędu

**Implementacja w komponencie:**
```typescript
if (error) {
  return (
    <ErrorState 
      message="Nie udało się załadować danych dashboardu"
      onRetry={refetch}
    />
  );
}
```

### 10.2 Błędy check-in

**Scenariusz:** Błąd podczas wykonywania check-in.

**Możliwe przyczyny:**
- Brak połączenia z API
- Rezerwacja nie istnieje (404)
- Rezerwacja ma nieprawidłowy status
- Błąd walidacji danych

**Obsługa:**
1. Przechwytywanie błędu w `handleCheckIn`
2. Logowanie błędu w konsoli
3. Wyświetlenie toast notification z komunikatem błędu:
   - "Nie udało się wykonać check-in. Spróbuj ponownie."
4. Przywrócenie stanu przycisku (usunięcie loading state)
5. Nie odświeżanie danych (pozostawienie użytkownika w tym samym stanie)

**Implementacja:**
```typescript
try {
  // ... wykonanie check-in
} catch (error) {
  console.error('Check-in error:', error);
  toast.error('Nie udało się wykonać check-in. Spróbuj ponownie.');
  throw error; // Pozwala na dalszą obsługę w komponencie
} finally {
  setState(prev => ({ ...prev, isProcessing: false }));
}
```

### 10.3 Błędy check-out

**Scenariusz:** Błąd podczas wykonywania check-out.

**Możliwe przyczyny:**
- Brak połączenia z API
- Rezerwacja nie istnieje (404)
- Rezerwacja ma nieprawidłowy status
- Brak actual_check_in (klient nie został zameldowany)

**Obsługa:**
Analogiczna do obsługi błędów check-in:
1. Przechwytywanie błędu w `handleCheckOut`
2. Logowanie błędu w konsoli
3. Wyświetlenie toast notification:
   - "Nie udało się wykonać check-out. Spróbuj ponownie."
4. Przywrócenie stanu przycisku
5. Nie odświeżanie danych

### 10.4 Empty states

**Scenariusz:** Brak rezerwacji na dziś.

**ArrivalsColumn:**
- Wyświetl empty state z komunikatem: "Brak zaplanowanych przyjazdów na dziś"
- Opcjonalnie: ikona ilustracyjna
- Opcjonalnie: link "Zobacz wszystkie rezerwacje"

**DeparturesColumn:**
- Wyświetl empty state z komunikatem: "Brak zaplanowanych wyjazdów na dziś"
- Opcjonalnie: ikona ilustracyjna
- Opcjonalnie: link "Zobacz wszystkie rezerwacje"

**Implementacja:**
```typescript
if (arrivals.length === 0) {
  return (
    <EmptyState 
      icon={<CalendarIcon />}
      message="Brak zaplanowanych przyjazdów na dziś"
      actionLabel="Zobacz wszystkie rezerwacje"
      actionHref="/reservations"
    />
  );
}
```

### 10.5 Network timeouts

**Scenariusz:** Timeout podczas zapytania do API.

**Obsługa:**
1. Ustawienie timeout dla fetch (np. 30 sekund)
2. W przypadku timeoutu:
   - Przerwanie zapytania
   - Wyświetlenie komunikatu: "Przekroczono czas oczekiwania. Sprawdź połączenie internetowe."
   - Możliwość ponowienia próby

**Implementacja pomocnicza:**
```typescript
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

---

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury katalogów i typów

1.1. Utwórz katalog dla komponentów dashboardu:
```
src/components/dashboard/
```

1.2. Dodaj nowe typy do `src/types.ts` lub utwórz `src/types/dashboard.types.ts`:
- `DashboardMetrics`
- `DashboardData`
- `DashboardState`
- `CheckInCommand`
- `CheckOutCommand`
- `MetricCardProps`
- `ReservationCardProps`

1.3. Zaimportuj i wyeksportuj nowe typy w `src/types.ts`:
```typescript
export * from './types/dashboard.types';
```

### Krok 2: Implementacja custom hooka useDashboard

2.1. Utwórz plik `src/hooks/useDashboard.ts`

2.2. Zaimplementuj hook z następującą funkcjonalnością:
- Stan: `DashboardState`
- `fetchDashboardData()` - pobieranie danych z API
- `handleCheckIn(reservationId)` - obsługa check-in
- `handleCheckOut(reservationId)` - obsługa check-out
- `calculateMetrics()` - kalkulacja metryk
- `useEffect` dla inicjalizacji

2.3. Dodaj obsługę błędów i loading states

2.4. Przetestuj hook w izolacji (opcjonalnie: unit tests)

### Krok 3: Implementacja komponentów prezentacyjnych

3.1. **MetricCard** (`src/components/dashboard/MetricCard.tsx`):
- Wykorzystaj Card z Shadcn/ui
- Dodaj props: icon, value, label, accentColor, isLoading
- Zaimplementuj loading skeleton
- Dodaj kolorowe obramowanie (border-left) według accentColor

3.2. **MetricsSection** (`src/components/dashboard/MetricsSection.tsx`):
- Grid layout (4 kolumny na desktop, 2 na tablet, 1 na mobile)
- Renderuj 4x MetricCard z odpowiednimi danymi
- Dodaj odpowiednie ikony (Lucide React):
  - Wolne miejsca: ParkingCircle (zielony)
  - Rezerwacje: Calendar (niebieski)
  - Przyjazdy: ArrowRight (pomarańczowy)
  - Wyjazdy: ArrowLeft (fioletowy)

3.3. **ReservationCard** (`src/components/dashboard/ReservationCard.tsx`):
- Wykorzystaj Card z Shadcn/ui
- Wyświetl: nazwisko, imię, telefon, numer rejestracyjny, godzinę
- Dodaj przycisk akcji (Button z Shadcn/ui)
- Zaimplementuj hover state z dodatkowymi informacjami
- Dodaj kolorowe obramowanie według statusu
- Obsłuż stan loading dla przycisku

### Krok 4: Implementacja kolumn list

4.1. **ArrivalsColumn** (`src/components/dashboard/ArrivalsColumn.tsx`):
- Nagłówek z tytułem "Przyjazdy" i licznikiem
- Scrollowalna lista ReservationCard
- Props: arrivals, onCheckIn, isLoading
- Zaimplementuj empty state
- Zaimplementuj loading skeletons

4.2. **DeparturesColumn** (`src/components/dashboard/DeparturesColumn.tsx`):
- Nagłówek z tytułem "Wyjazdy" i licznikiem
- Scrollowalna lista ReservationCard
- Props: departures, onCheckOut, isLoading
- Zaimplementuj empty state
- Zaimplementuj loading skeletons

### Krok 5: Implementacja kontenera TodayView

5.1. Utwórz `src/components/dashboard/TodayView.tsx`

5.2. Zaimplementuj grid layout (2 kolumny na desktop, 1 na mobile)

5.3. Renderuj ArrivalsColumn i DeparturesColumn

5.4. Propaguj callbacki (onCheckIn, onCheckOut) z props do kolumn

### Krok 6: Implementacja głównego kontenera DashboardContainer

6.1. Utwórz `src/components/dashboard/DashboardContainer.tsx`

6.2. Wykorzystaj hook `useDashboard()` do zarządzania stanem

6.3. Zaimplementuj logikę renderowania:
- Loading state → Loading skeletons
- Error state → ErrorState component
- Success state → MetricsSection + TodayView

6.4. Przekaż dane z hooka do podkomponentów

6.5. Przekaż callbacki (handleCheckIn, handleCheckOut) do TodayView

### Krok 7: Integracja z Astro

7.1. Utwórz lub edytuj `src/pages/index.astro`

7.2. Zaimportuj DashboardContainer:
```astro
---
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import Layout from '@/layouts/BaseLayout.astro';
---
```

7.3. Zintegruj DashboardContainer z dyrektywą client:
```astro
<Layout title="Dashboard - ParkTrack">
  <DashboardContainer client:load />
</Layout>
```

### Krok 8: Stylowanie i UX

8.1. Dodaj style Tailwind dla wszystkich komponentów:
- Responsive breakpoints
- Color scheme zgodny z projektem
- Hover states
- Focus states (accessibility)

8.2. Zaimplementuj loading skeletons używając Skeleton z Shadcn/ui

8.3. Dodaj transitions i animations (opcjonalnie, subtelne)

8.4. Przetestuj responsywność na różnych rozdzielczościach

### Krok 9: Obsługa błędów i edge cases

9.1. Dodaj ErrorState component (`src/components/common/ErrorState.tsx`)

9.2. Dodaj EmptyState component (`src/components/common/EmptyState.tsx`)

9.3. Zaimplementuj toast notifications (używając Sonner lub React Hot Toast):
- Sukces check-in: "Klient zameldowany pomyślnie"
- Sukces check-out: "Klient wymeldowany pomyślnie"
- Błąd: "Operacja nie powiodła się. Spróbuj ponownie."

9.4. Dodaj timeout handling dla fetch requests

### Krok 10: Testy manualne i optymalizacja

10.1. Przetestuj wszystkie user flows:
- Ładowanie dashboardu
- Check-in rezerwacji
- Check-out rezerwacji
- Obsługa błędów
- Responsywność

10.2. Przetestuj edge cases:
- Brak rezerwacji (empty states)
- Błędy API
- Wolne połączenie (loading states)
- Bardzo długie listy (scrolling)

10.3. Optymalizacja performance:
- Sprawdź unnecessary re-renders
- Użyj React.memo dla komponentów prezentacyjnych (jeśli potrzebne)
- Zoptymalizuj obrazy i ikony

10.4. Accessibility:
- Przetestuj keyboard navigation
- Sprawdź screen reader support
- Sprawdź kontrast kolorów (WCAG AA)

### Krok 11: Dokumentacja i finalizacja

11.1. Dodaj komentarze JSDoc do wszystkich komponentów i funkcji

11.2. Zaktualizuj README projektu (jeśli istnieje)

11.3. Utwórz dokumentację komponentów (opcjonalnie: Storybook)

11.4. Code review i refactoring

11.5. Merge do głównej gałęzi i deployment

---

## 12. Notatki implementacyjne

### 12.1 Priorytetyzacja funkcjonalności

**Must-have (MVP):**
- Wyświetlanie metryk
- Lista przyjazdów i wyjazdów
- Funkcje check-in i check-out
- Podstawowa obsługa błędów

**Nice-to-have (post-MVP):**
- Real-time updates (Supabase subscriptions)
- Zaawansowane filtrowanie i sortowanie list
- Eksport danych do CSV
- Drukowanie list przyjazdów/wyjazdów
- Notyfikacje push

### 12.2 Potencjalne usprawnienia przyszłościowe

- **Real-time updates:** Użycie Supabase Realtime do automatycznego odświeżania list przy zmianach w bazie danych
- **Wyszukiwanie:** Dodanie pola wyszukiwania dla szybkiego odnalezienia rezerwacji
- **Bulk actions:** Możliwość zaznaczenia wielu rezerwacji i wykonania akcji grupowych
- **Powiadomienia:** Alerty dla opóźnionych check-in/check-out
- **Statystyki:** Rozszerzone statystyki i wykresy (wykres obłożenia, średni czas pobytu, itp.)

### 12.3 Zależności do instalacji

Sprawdź czy następujące pakiety są zainstalowane:
```bash
npm install @supabase/supabase-js
npm install lucide-react  # Dla ikon
npm install sonner        # Dla toast notifications
npm install date-fns      # Dla formatowania dat (opcjonalnie)
```

### 12.4 Konfiguracja Supabase

Upewnij się, że Supabase client jest poprawnie skonfigurowany w `src/db/`:
- Klient Supabase zainicjalizowany
- Zmienne środowiskowe ustawione (SUPABASE_URL, SUPABASE_ANON_KEY)
- RLS policies skonfigurowane (jeśli dotyczy)

---

## Koniec dokumentu

Ten plan implementacji zapewnia kompletny przewodnik dla programisty frontendowego do wdrożenia widoku Dashboard w aplikacji ParkTrack. Wszystkie kluczowe aspekty, od struktury komponentów po obsługę błędów, zostały szczegółowo opisane i gotowe do implementacji zgodnie z PRD i wymaganiami biznesowymi.

