# Plan implementacji widoku Formularza Nowej Rezerwacji (Modal)

## 1. Przegląd

Widok formularza nowej rezerwacji to modalny komponent dostępny z każdego miejsca w aplikacji, umożliwiający szybkie utworzenie rezerwacji parkingowej. Głównym celem jest umożliwienie pracownikom obsługi parkingu utworzenia rezerwacji telefonicznej w czasie poniżej 30 sekund przy użyciu minimalnego zestawu danych (nazwisko + daty). Komponent oferuje dwa tryby pracy: **Quick Mode** (domyślny) dla szybkich rezerwacji oraz **Full Mode** dla pełnej rejestracji z dodatkowymi danymi.

## 2. Routing widoku

Widok jest modalem, więc nie posiada dedykowanej ścieżki routingu. Jest dostępny globalnie poprzez:

- **Przycisk "+ Nowa rezerwacja"** w:
  - Headerze aplikacji (desktop)
  - Sidebarze (desktop)
  - Floating button (mobile)
  - Dashboard
  - Lista rezerwacji

- **Keyboard shortcut**: `Ctrl+N` (lub `Cmd+N` na macOS)

Stan modala może być opcjonalnie zarządzany przez URL query parameter: `?modal=new-reservation` dla możliwości deep-linkingu.

## 3. Struktura komponentów

Hierarchia komponentów widoku:

```
NewReservationModal (kontener główny)
├── Dialog (Shadcn UI)
│   ├── DialogOverlay (backdrop z blur)
│   ├── DialogContent (główna zawartość)
│   │   ├── DialogHeader
│   │   │   ├── DialogTitle ("Nowa rezerwacja")
│   │   │   └── DialogClose (przycisk X)
│   │   │
│   │   ├── ModeToggle (przełącznik trybu - opcjonalny)
│   │   │
│   │   ├── [Conditional: Quick Mode]
│   │   │   └── QuickReservationForm
│   │   │       ├── Form (React Hook Form wrapper)
│   │   │       ├── FormFields
│   │   │       │   ├── FormField (Nazwisko)
│   │   │       │   │   ├── FormLabel
│   │   │       │   │   ├── FormControl
│   │   │       │   │   │   └── Input
│   │   │       │   │   └── FormMessage (error)
│   │   │       │   ├── FormField (Data przyjazdu)
│   │   │       │   │   ├── FormLabel
│   │   │       │   │   ├── FormControl
│   │   │       │   │   │   └── DatePicker
│   │   │       │   │   └── FormMessage
│   │   │       │   └── FormField (Data wyjazdu)
│   │   │       │       ├── FormLabel
│   │   │       │       ├── FormControl
│   │   │       │       │   └── DatePicker
│   │   │       │       └── FormMessage
│   │   │       ├── CostPreview (komponent podglądu kosztu)
│   │   │       ├── AvailabilityIndicator (wskaźnik dostępności)
│   │   │       └── DialogFooter
│   │   │           ├── Button "Zapisz szybko"
│   │   │           └── Button "Zapisz i dodaj szczegóły"
│   │   │
│   │   └── [Conditional: Full Mode]
│   │       └── FullReservationForm
│   │           ├── Form (React Hook Form wrapper)
│   │           ├── FormSections
│   │           │   ├── PersonalInfoSection
│   │           │   │   ├── FormField (Imię)
│   │           │   │   ├── FormField (Nazwisko)
│   │           │   │   ├── FormField (Email)
│   │           │   │   └── FormField (Telefon)
│   │           │   ├── DatesSection
│   │           │   │   ├── FormField (Data przyjazdu)
│   │           │   │   └── FormField (Data wyjazdu)
│   │           │   ├── VehicleSection
│   │           │   │   └── FormField (Nr rejestracyjny)
│   │           │   ├── FlightSection
│   │           │   │   └── FormField (Kierunek lotu - Select)
│   │           │   └── NotesSection
│   │           │       └── FormField (Notatki - Textarea)
│   │           ├── CostPreview
│   │           ├── AvailabilityIndicator
│   │           └── DialogFooter
│   │               ├── Button "Wróć do trybu szybkiego" (secondary)
│   │               └── Button "Zapisz rezerwację" (primary)
```

## 4. Szczegóły komponentów

### 4.1 NewReservationModal

**Opis komponentu**: Główny kontener modala zarządzający stanem widoczności, trybem formularza oraz obsługą klawiszy.

**Główne elementy HTML i komponenty dzieci**:
- `Dialog` (Shadcn) - komponent modalny
- `DialogContent` - zawartość modala (max-width: 600px)
- Conditional rendering: `QuickReservationForm` lub `FullReservationForm`

**Obsługiwane zdarzenia**:
- `onOpenChange` - zamknięcie modala (Esc, klik backdrop, przycisk X)
- `onSuccess` - callback po pomyślnym utworzeniu rezerwacji
- Keyboard: `Escape` zamyka modal (jeśli brak unsaved changes)

**Warunki walidacji**:
- Nie dotyczy - komponent kontenerowy

**Typy**:
- Props: `NewReservationModalProps`
- State: `NewReservationModalState`

**Propsy**:
```typescript
interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reservation: ReservationDto) => void;
  defaultMode?: 'quick' | 'full';
}
```

---

### 4.2 QuickReservationForm

**Opis komponentu**: Formularz szybkiego tworzenia rezerwacji z trzema wymaganymi polami. Zoptymalizowany pod kątem szybkości wprowadzania danych (cel: <30 sekund).

**Główne elementy HTML i komponenty dzieci**:
- `Form` (React Hook Form + Zod)
- `FormField` x 3 (Nazwisko, Data przyjazdu, Data wyjazdu)
- `CostPreview` - podgląd obliczonego kosztu
- `AvailabilityIndicator` - wskaźnik wolnych miejsc
- `Button` x 2 - akcje submit

**Obsługiwane zdarzenia**:
- `onSubmit` - utworzenie rezerwacji (Quick Mode)
- `onSubmitAndExpand` - utworzenie rezerwacji i przejście do szczegółów
- `onChange` (data) - live cost calculation i availability check
- Auto-focus na pole "Nazwisko" przy otwarciu
- Enter submit na ostatnim polu

**Warunki walidacji**:
1. **Nazwisko** (required):
   - Min 2 znaki
   - Max 100 znaków
   - Pattern: tylko litery, spacje, myślniki
   - Error: "Nazwisko musi zawierać minimum 2 znaki"

2. **Data przyjazdu** (required):
   - Nie w przeszłości (>= dzisiaj 00:00)
   - Format: ISO 8601 timestamp
   - Error: "Data przyjazdu nie może być w przeszłości"

3. **Data wyjazdu** (required):
   - Nie w przeszłości
   - Musi być późniejsza niż data przyjazdu (min. 1 dzień różnicy)
   - Format: ISO 8601 timestamp
   - Error: "Data wyjazdu musi być późniejsza niż data przyjazdu"

4. **Real-time checks**:
   - Dostępność miejsc (debounced 500ms)
   - Jeśli brak miejsc: disable submit + inline alert
   - Auto-obliczanie kosztu przy zmianie dat

**Typy**:
- Form data: `QuickReservationFormData`
- Validation schema: `quickReservationSchema` (Zod)

**Propsy**:
```typescript
interface QuickReservationFormProps {
  onSubmit: (data: QuickReservationFormData) => Promise<void>;
  onSwitchToFull: () => void;
  isSubmitting: boolean;
}
```

---

### 4.3 FullReservationForm

**Opis komponentu**: Rozszerzony formularz z wszystkimi polami rezerwacji. Zawiera sekcje: dane osobowe, daty, pojazd, lot, notatki.

**Główne elementy HTML i komponenty dzieci**:
- `Form` (React Hook Form + Zod)
- Sekcje formularza:
  - `PersonalInfoSection` - 4 pola (Imię, Nazwisko, Email, Telefon)
  - `DatesSection` - 2 pola (Daty)
  - `VehicleSection` - 1 pole (Nr rejestracyjny)
  - `FlightSection` - 1 pole (Kierunek - Select)
  - `NotesSection` - 1 pole (Textarea)
- `CostPreview`
- `AvailabilityIndicator`
- `Button` x 2 - akcje

**Obsługiwane zdarzenia**:
- `onSubmit` - utworzenie rezerwacji (Full Mode)
- `onSwitchToQuick` - powrót do trybu szybkiego (z zachowaniem danych)
- `onChange` - walidacja i formatowanie pól
- Auto-formatowanie:
  - Telefon: dodawanie spacji (123 456 789)
  - Nr rejestracyjny: uppercase + space (WX 12345)
  - Nazwisko: capitalize first letter

**Warunki walidacji**:

Wszystkie warunki z QuickReservationForm plus:

5. **Imię** (optional):
   - Max 100 znaków
   - Pattern: tylko litery i spacje

6. **Email** (optional):
   - Format email (RFC 5322)
   - Max 255 znaków
   - Error: "Nieprawidłowy format email"

7. **Telefon** (optional):
   - 9 cyfr (Polski format)
   - Pattern: `^\d{9}$` (po usunięciu spacji)
   - Auto-formatowanie: `xxx xxx xxx`
   - Error: "Numer telefonu musi zawierać 9 cyfr"

8. **Nr rejestracyjny** (optional):
   - Pattern: `^[A-Z]{2}\s?\d{5}$` lub `^[A-Z]{2}\s?[A-Z0-9]{4,5}$`
   - Auto-uppercase + space
   - Error: "Nieprawidłowy format numeru rejestracyjnego"

9. **Kierunek lotu** (optional):
   - Enum: 'departure' | 'arrival'
   - Select dropdown

10. **Notatki** (optional):
    - Max 1000 znaków
    - Textarea z licznikiem znaków

**Typy**:
- Form data: `FullReservationFormData`
- Validation schema: `fullReservationSchema` (Zod)

**Propsy**:
```typescript
interface FullReservationFormProps {
  initialData?: Partial<FullReservationFormData>;
  onSubmit: (data: FullReservationFormData) => Promise<void>;
  onSwitchToQuick: () => void;
  isSubmitting: boolean;
}
```

---

### 4.4 CostPreview

**Opis komponentu**: Komponent wyświetlający auto-obliczony koszt rezerwacji na podstawie dat. Aktualizowany w czasie rzeczywistym przy zmianie dat.

**Główne elementy HTML**:
- `div` container
- `span` - label "Koszt:"
- `strong` - wartość kosztu (formatowana: "XX,XX zł")
- Opcjonalnie: `Skeleton` podczas ładowania

**Obsługiwane interakcje**:
- Brak (read-only component)

**Obsługiwana walidacja**:
- Nie dotyczy (read-only)

**Typy**:
```typescript
interface CostPreviewProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  isCalculating: boolean;
}
```

**Propsy**:
- `checkInDate` - data przyjazdu
- `checkOutDate` - data wyjazdu
- `isCalculating` - czy koszt jest w trakcie obliczania

---

### 4.5 AvailabilityIndicator

**Opis komponentu**: Wskaźnik dostępności miejsc parkingowych. Wyświetla liczbę wolnych miejsc lub alert o braku dostępności.

**Główne elementy HTML**:
- `div` container
- Conditional rendering:
  - **IF available**: `Alert` (info variant) - "ℹ️ Pozostało X wolnych miejsc"
  - **IF full**: `Alert` (warning variant) - "⚠️ Brak wolnych miejsc w wybranych datach"
  - **IF loading**: `Skeleton`

**Obsługiwane interakcje**:
- Brak (informacyjny component)

**Obsługiwana walidacja**:
- Nie dotyczy (informacyjny)
- Wpływa na stan submit button (disable jeśli full)

**Typy**:
```typescript
interface AvailabilityIndicatorProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  isChecking: boolean;
}
```

**Propsy**:
- `checkInDate` - data przyjazdu
- `checkOutDate` - data wyjazdu
- `isChecking` - czy sprawdzanie dostępności jest w trakcie

---

## 5. Typy

### 5.1 Nowe typy ViewModel

```typescript
/**
 * ViewModel dla formularza Quick Mode
 */
export interface QuickReservationFormData {
  lastName: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
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
  flightDirection: 'departure' | 'arrival' | null;
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
  defaultMode?: 'quick' | 'full';
}

/**
 * Stan wewnętrzny komponentu NewReservationModal
 */
export interface NewReservationModalState {
  /** Aktywny tryb formularza */
  mode: 'quick' | 'full';
  /** Czy formularz jest w trakcie wysyłania */
  isSubmitting: boolean;
}

/**
 * Props dla QuickReservationForm
 */
export interface QuickReservationFormProps {
  /** Callback submit formularza */
  onSubmit: (data: QuickReservationFormData) => Promise<void>;
  /** Callback przełączenia do trybu Full */
  onSwitchToFull: () => void;
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
```

### 5.2 Schematy walidacji Zod

```typescript
/**
 * Schemat walidacji dla Quick Mode
 */
export const quickReservationSchema = z.object({
  lastName: z
    .string()
    .min(2, 'Nazwisko musi zawierać minimum 2 znaki')
    .max(100, 'Nazwisko może zawierać maksymalnie 100 znaków')
    .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]+$/, 'Nazwisko może zawierać tylko litery, spacje i myślniki'),
  checkInDate: z.date({
    required_error: 'Data przyjazdu jest wymagana',
    invalid_type_error: 'Nieprawidłowy format daty',
  }),
  checkOutDate: z.date({
    required_error: 'Data wyjazdu jest wymagana',
    invalid_type_error: 'Nieprawidłowy format daty',
  }),
}).refine(
  (data) => {
    if (!data.checkInDate || !data.checkOutDate) return true;
    return data.checkOutDate > data.checkInDate;
  },
  {
    message: 'Data wyjazdu musi być późniejsza niż data przyjazdu',
    path: ['checkOutDate'],
  }
).refine(
  (data) => {
    if (!data.checkInDate) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return data.checkInDate >= today;
  },
  {
    message: 'Data przyjazdu nie może być w przeszłości',
    path: ['checkInDate'],
  }
);

/**
 * Schemat walidacji dla Full Mode
 */
export const fullReservationSchema = quickReservationSchema.extend({
  firstName: z
    .string()
    .max(100, 'Imię może zawierać maksymalnie 100 znaków')
    .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]*$/, 'Imię może zawierać tylko litery i spacje')
    .optional(),
  email: z
    .string()
    .email('Nieprawidłowy format email')
    .max(255, 'Email może zawierać maksymalnie 255 znaków')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\d{9}$/, 'Numer telefonu musi zawierać 9 cyfr')
    .optional()
    .or(z.literal('')),
  licensePlate: z
    .string()
    .regex(/^[A-Z]{2}\s?[A-Z0-9]{4,5}$/, 'Nieprawidłowy format numeru rejestracyjnego')
    .optional()
    .or(z.literal('')),
  flightDirection: z
    .enum(['departure', 'arrival'])
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(1000, 'Notatki mogą zawierać maksymalnie 1000 znaków')
    .optional(),
});
```

### 5.3 Istniejące typy (wykorzystywane)

Z pliku `src/types.ts`:
- `CreateReservationCommand` - DTO dla API (request body)
- `ReservationDto` - typ odpowiedzi z API (Reservation entity)
- `ReservationSource` - enum ('phone', 'walk_in', 'api')

## 6. Zarządzanie stanem

### 6.1 Stan lokalny komponentu (useState)

W `NewReservationModal`:
```typescript
const [mode, setMode] = useState<'quick' | 'full'>(defaultMode || 'quick');
const [formData, setFormData] = useState<Partial<FullReservationFormData>>({});
```

### 6.2 Custom Hooki

#### useNewReservationForm()

**Cel**: Zarządzanie stanem formularza i walidacją z React Hook Form.

**Parametry**:
- `mode: 'quick' | 'full'` - tryb formularza
- `defaultValues?: Partial<FullReservationFormData>` - domyślne wartości

**Zwraca**:
```typescript
{
  form: UseFormReturn<QuickReservationFormData | FullReservationFormData>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
}
```

**Implementacja**:
- React Hook Form `useForm()` z Zod resolver
- Submit handler z transformacją danych do `CreateReservationCommand`
- Error handling i display

---

#### useAvailabilityCheck(checkInDate, checkOutDate)

**Cel**: Debounced check dostępności miejsc parkingowych na wybrane daty.

**Parametry**:
- `checkInDate: Date | null`
- `checkOutDate: Date | null`

**Zwraca**: `UseAvailabilityCheckResult`

**Implementacja**:
```typescript
const useAvailabilityCheck = (
  checkInDate: Date | null,
  checkOutDate: Date | null
): UseAvailabilityCheckResult => {
  const debouncedCheckIn = useDebounce(checkInDate, 500);
  const debouncedCheckOut = useDebounce(checkOutDate, 500);

  const { data, isLoading, error } = useQuery({
    queryKey: ['availability', debouncedCheckIn, debouncedCheckOut],
    queryFn: () => fetchAvailability(debouncedCheckIn, debouncedCheckOut),
    enabled: !!(debouncedCheckIn && debouncedCheckOut),
    staleTime: 30000, // 30 sekund
  });

  return {
    availableSpots: data?.availableSpots ?? null,
    isAvailable: data?.available ?? false,
    isChecking: isLoading,
    error,
  };
};
```

---

#### useCostCalculation(checkInDate, checkOutDate)

**Cel**: Auto-obliczanie kosztu rezerwacji na podstawie dat.

**Parametry**:
- `checkInDate: Date | null`
- `checkOutDate: Date | null`

**Zwraca**: `UseCostCalculationResult`

**Implementacja**:
```typescript
const useCostCalculation = (
  checkInDate: Date | null,
  checkOutDate: Date | null
): UseCostCalculationResult => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cost-calculation', checkInDate, checkOutDate],
    queryFn: () => calculateCost(checkInDate, checkOutDate),
    enabled: !!(checkInDate && checkOutDate && checkOutDate > checkInDate),
    staleTime: 60000, // 60 sekund
  });

  return {
    estimatedCost: data?.totalCost ?? null,
    days: data?.days ?? 0,
    isCalculating: isLoading,
    error,
  };
};
```

---

#### useCreateReservation()

**Cel**: React Query mutation do tworzenia rezerwacji z optimistic update.

**Zwraca**:
```typescript
{
  createReservation: (data: CreateReservationCommand) => Promise<ReservationDto>;
  isCreating: boolean;
  error: Error | null;
}
```

**Implementacja**:
```typescript
const useCreateReservation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateReservationCommand) => 
      fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to create reservation');
        return res.json();
      }),
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      
      // Toast notification
      toast.success('Rezerwacja utworzona pomyślnie');
    },
    onError: (error) => {
      toast.error('Nie udało się utworzyć rezerwacji');
    },
  });

  return {
    createReservation: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
};
```

---

#### useDebounce(value, delay)

**Cel**: Debouncing wartości (dla availability check).

**Parametry**:
- `value: T` - wartość do debounce
- `delay: number` - opóźnienie w ms

**Zwraca**: `T` - debounced value

**Implementacja**: Standard React debounce hook z useEffect i setTimeout.

---

### 6.3 React Query Configuration

```typescript
// W pliku konfiguracyjnym React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 sekund
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

## 7. Integracja API

### 7.1 Endpoint: Sprawdzanie dostępności

**Opis**: Sprawdza liczbę wolnych miejsc w zadanym zakresie dat.

**Metoda i URL**: `GET /api/availability`

**Query Parameters**:
- `check_in` (required) - data przyjazdu (ISO 8601)
- `check_out` (required) - data wyjazdu (ISO 8601)

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Response (200 OK)**:
```typescript
{
  available: boolean;
  availableSpots: number;
  totalSpots: number;
}
```

**Response Type**: `AvailabilityCheckResponse`

**Error Responses**:
- `400 Bad Request` - nieprawidłowe parametry
- `401 Unauthorized` - brak autentykacji
- `500 Internal Server Error` - błąd serwera

**Wywołanie w komponencie**: Hook `useAvailabilityCheck()`

---

### 7.2 Endpoint: Obliczanie kosztu

**Opis**: Oblicza całkowity koszt rezerwacji na podstawie dat i cennika.

**Metoda i URL**: `GET /api/calculate-cost`

**Query Parameters**:
- `check_in` (required) - data przyjazdu (ISO 8601)
- `check_out` (required) - data wyjazdu (ISO 8601)

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Response (200 OK)**:
```typescript
{
  totalCost: number;
  days: number;
  costPerDay: number;
}
```

**Response Type**: `CostCalculationResponse`

**Error Responses**:
- `400 Bad Request` - nieprawidłowe parametry
- `401 Unauthorized` - brak autentykacji
- `500 Internal Server Error` - błąd serwera

**Wywołanie w komponencie**: Hook `useCostCalculation()`

---

### 7.3 Endpoint: Tworzenie rezerwacji

**Opis**: Tworzy nową rezerwację w systemie.

**Metoda i URL**: `POST /api/reservations`

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body Type**: `CreateReservationCommand`

**Request Body (Quick Mode)**:
```json
{
  "last_name": "Kowalski",
  "planned_check_in": "2025-12-01T08:00:00Z",
  "planned_check_out": "2025-12-05T18:00:00Z",
  "source": "phone",
  "total_cost": 120.0
}
```

**Request Body (Full Mode)**:
```json
{
  "last_name": "Kowalski",
  "first_name": "Jan",
  "email": "jan.kowalski@example.com",
  "phone": "123456789",
  "license_plate": "WX12345",
  "flight_direction": "departure",
  "notes": "Klient spóźni się o godzinę",
  "planned_check_in": "2025-12-01T08:00:00Z",
  "planned_check_out": "2025-12-05T18:00:00Z",
  "source": "phone",
  "total_cost": 120.0
}
```

**Response (201 Created)**:
```typescript
ReservationDto
```

**Response Type**: `ReservationDto`

**Error Responses**:
- `400 Bad Request` - walidacja nie powiodła się
  ```json
  {
    "error": "Validation failed",
    "details": { "last_name": ["Nazwisko jest wymagane"] }
  }
  ```
- `409 Conflict` - brak wolnych miejsc (overbooking)
  ```json
  {
    "error": "Overbooking conflict",
    "message": "Brak wolnych miejsc w wybranych datach",
    "availableDates": ["2025-12-02", "2025-12-03"]
  }
  ```
- `401 Unauthorized` - brak autentykacji
- `500 Internal Server Error` - błąd serwera

**Wywołanie w komponencie**: Hook `useCreateReservation()`

---

### 7.4 Transformacja danych Form → API

```typescript
const transformQuickFormToCommand = (
  formData: QuickReservationFormData
): CreateReservationCommand => ({
  last_name: formData.lastName.trim(),
  planned_check_in: formData.checkInDate!.toISOString(),
  planned_check_out: formData.checkOutDate!.toISOString(),
  source: 'phone', // stała dla rezerwacji telefonicznej
  total_cost: estimatedCost, // z useCostCalculation
});

const transformFullFormToCommand = (
  formData: FullReservationFormData
): CreateReservationCommand => ({
  ...transformQuickFormToCommand(formData),
  first_name: formData.firstName?.trim() || undefined,
  email: formData.email?.trim() || undefined,
  phone: formData.phone?.replace(/\s/g, '') || undefined, // usunięcie spacji
  license_plate: formData.licensePlate?.toUpperCase().trim() || undefined,
  flight_direction: formData.flightDirection || undefined,
  notes: formData.notes?.trim() || undefined,
});
```

## 8. Interakcje użytkownika

### 8.1 Otwarcie modala

**Trigger**:
- Kliknięcie przycisku "+ Nowa rezerwacja"
- Skrót klawiaturowy `Ctrl+N` (lub `Cmd+N`)

**Akcja**:
1. Modal otwiera się z animacją fade-in (200ms)
2. Backdrop blur aplikowany na główną zawartość
3. Quick Mode jest domyślnie załadowany
4. Auto-focus ustawiony na pole "Nazwisko"

**Stan po akcji**:
- `isOpen = true`
- Formularz w stanie początkowym (puste pola)
- Data przyjazdu defaultuje na dzisiaj
- Data wyjazdu defaultuje na jutro

---

### 8.2 Wprowadzanie nazwiska

**Trigger**: Wpisywanie w pole "Nazwisko"

**Akcja**:
1. Auto-capitalize pierwszej litery
2. Walidacja real-time po opuszczeniu pola (onBlur)
3. Error message pojawia się pod polem jeśli walidacja nie przeszła

**Walidacja**:
- Min 2 znaki
- Pattern: tylko litery, spacje, myślniki
- Error: inline pod polem

---

### 8.3 Wybór dat

**Trigger**: Kliknięcie w pole daty → otwarcie DatePicker

**Akcja**:
1. DatePicker (Shadcn Calendar) otwiera się jako popover
2. Użytkownik wybiera datę z kalendarza
3. Po wyborze daty:
   - DatePicker zamyka się
   - Wartość aktualizowana w formularzu
   - **Triggered**: `useCostCalculation()` - obliczanie kosztu
   - **Triggered**: `useAvailabilityCheck()` - sprawdzanie dostępności (debounced 500ms)

**Walidacja**:
- Data przyjazdu >= dzisiaj
- Data wyjazdu > data przyjazdu
- Errors: inline pod polami

**UX Features**:
- Daty w przeszłości są disabled w kalendarzu
- Default data przyjazdu: dzisiaj
- Default data wyjazdu: jutro

---

### 8.4 Obserwacja live updates

**Trigger**: Zmiana dat w formularzu

**Akcja (automatyczna)**:
1. **CostPreview**:
   - Hook `useCostCalculation()` wykonuje API call
   - Loading spinner pojawia się w CostPreview
   - Po otrzymaniu odpowiedzi: koszt aktualizowany (np. "120,00 zł")

2. **AvailabilityIndicator**:
   - Hook `useAvailabilityCheck()` wykonuje debounced API call (500ms)
   - Loading spinner w AvailabilityIndicator
   - Po otrzymaniu odpowiedzi:
     - **IF available**: `Alert` info - "ℹ️ Pozostało 7 wolnych miejsc"
     - **IF full**: `Alert` warning - "⚠️ Brak wolnych miejsc w wybranych datach"

**Stan komponentu**:
- `isCalculating` i `isChecking` zarządzają loading states
- Submit button disabled jeśli `!isAvailable`

---

### 8.5 Submit Quick Mode - "Zapisz szybko"

**Trigger**: Kliknięcie przycisku "Zapisz szybko"

**Warunki**:
- Formularz zwalidowany (wszystkie required fields)
- Miejsca dostępne (`isAvailable = true`)

**Akcja**:
1. Walidacja formularza (Zod schema)
2. Jeśli walidacja OK:
   - Button zmienia stan na loading (spinner + disabled)
   - Transformacja danych: `QuickReservationFormData` → `CreateReservationCommand`
   - API call: `POST /api/reservations`
3. Po sukcesie (201):
   - **Optimistic update**: Rezerwacja dodana do cache (React Query)
   - Modal zamyka się z animacją
   - Toast notification: "Rezerwacja utworzona pomyślnie" (z akcją "Dodaj szczegóły")
   - Callback `onSuccess(reservation)` wywołany
4. Po błędzie:
   - **IF 409 Conflict**: Modal z komunikatem + sugestie alternatywnych dat
   - **IF 400**: Inline errors pod polami
   - **IF 500**: Toast error: "Wystąpił błąd. Spróbuj ponownie."
   - Button wraca do stanu normalnego

**Stan po akcji**:
- Modal zamknięty
- Lista rezerwacji zaktualizowana (React Query invalidation)
- Dashboard metrics zaktualizowane

---

### 8.6 Submit Quick Mode - "Zapisz i dodaj szczegóły"

**Trigger**: Kliknięcie przycisku "Zapisz i dodaj szczegóły"

**Warunki**: Jak w 8.5

**Akcja**:
1. Walidacja formularza Quick Mode
2. Jeśli OK:
   - **Option A** (preferowany): Submit rezerwacji + przekierowanie do widoku szczegółów
   - **Option B**: Przełączenie na Full Mode z zachowaniem danych Quick Mode
3. W implementacji **Option B**:
   - Zapisanie danych Quick Mode w state
   - Przełączenie `mode = 'full'`
   - Pre-fill pól Full Mode danymi z Quick Mode
   - Focus na pierwsze nowe pole (Imię)

**Stan po akcji** (Option B):
- Modal pozostaje otwarty
- Full Mode załadowany z danymi z Quick Mode
- User może uzupełnić dodatkowe pola

---

### 8.7 Przełączenie do Full Mode

**Trigger**: Kliknięcie "Zapisz i dodaj szczegóły" (bez submit)

**Akcja**:
1. Dane z Quick Mode zapisywane w state
2. Animacja przejścia (fade-out Quick, fade-in Full)
3. Full Mode renderowany z pre-filled danymi
4. Sekcje formularza rozłożone wizualnie
5. Focus na pierwsze nowe pole

---

### 8.8 Auto-formatowanie pól (Full Mode)

**Trigger**: Wpisywanie w pola: Telefon, Nr rejestracyjny

**Akcja**:
1. **Telefon**:
   - onChange handler dodaje spacje: `xxx xxx xxx`
   - Tylko cyfry dozwolone
   - Max 9 cyfr (bez spacji)

2. **Nr rejestracyjny**:
   - onChange handler:
     - Konwersja na uppercase
     - Dodanie spacji po dwóch pierwszych literach: `XX 12345`
   - Pattern enforcement

**UX**: Smooth, non-disruptive formatting during typing

---

### 8.9 Submit Full Mode

**Trigger**: Kliknięcie "Zapisz rezerwację"

**Warunki**:
- Wszystkie required fields zwalidowane
- Optional fields: walidacja jeśli wypełnione
- Miejsca dostępne

**Akcja**:
1. Walidacja formularza Full Mode (Zod schema - fullReservationSchema)
2. Jeśli OK:
   - Button loading state
   - Transformacja: `FullReservationFormData` → `CreateReservationCommand`
   - API call: `POST /api/reservations`
3. Handling odpowiedzi: jak w 8.5

**Stan po akcji**: Jak w 8.5

---

### 8.10 Powrót do Quick Mode

**Trigger**: Kliknięcie "Wróć do trybu szybkiego" (w Full Mode)

**Akcja**:
1. Potwierdzenie jeśli są unsaved changes w polach Full Mode
2. Jeśli user potwierdzi:
   - Przełączenie `mode = 'quick'`
   - Zachowanie danych common fields (nazwisko, daty)
   - Usunięcie danych specific dla Full Mode
   - Animacja przejścia

---

### 8.11 Zamknięcie modala

**Trigger**:
- Kliknięcie przycisku X (DialogClose)
- Kliknięcie backdrop
- Klawisz `Escape`

**Warunki**:
- Jeśli są unsaved changes → warning dialog

**Akcja**:
1. Jeśli unsaved changes:
   - Alert dialog: "Niezapisane zmiany zostaną utracone. Czy na pewno chcesz zamknąć?"
   - Buttons: "Anuluj" | "Zamknij bez zapisywania"
2. Jeśli user potwierdzi lub brak changes:
   - Modal zamyka się z animacją fade-out
   - Formularz resetowany do stanu początkowego
   - Callback `onClose()` wywołany

**Stan po akcji**:
- `isOpen = false`
- Form state wyczyszczony

---

## 9. Warunki i walidacja

### 9.1 Walidacja po stronie klienta

#### Pole: Nazwisko

**Komponenty**: QuickReservationForm, FullReservationForm

**Warunki**:
1. **Required**: Pole nie może być puste
   - Trigger: onBlur, onSubmit
   - Error message: "Nazwisko jest wymagane"
   
2. **Min length**: Min 2 znaki
   - Trigger: onBlur, onSubmit
   - Error message: "Nazwisko musi zawierać minimum 2 znaki"
   
3. **Max length**: Max 100 znaków
   - Trigger: onChange (prevent), onSubmit
   - Error message: "Nazwisko może zawierać maksymalnie 100 znaków"
   
4. **Pattern**: Tylko litery (polskie znaki), spacje, myślniki
   - Trigger: onBlur, onSubmit
   - Error message: "Nazwisko może zawierać tylko litery, spacje i myślniki"

**Wpływ na UI**:
- Error message inline pod polem (czerwony tekst)
- Border pola zmienia kolor na czerwony
- Submit button disabled dopóki błąd nie zostanie naprawiony

---

#### Pole: Data przyjazdu

**Komponenty**: QuickReservationForm, FullReservationForm

**Warunki**:
1. **Required**: Data musi być wybrana
   - Trigger: onSubmit
   - Error message: "Data przyjazdu jest wymagana"
   
2. **Not in past**: Data >= dzisiaj (00:00)
   - Trigger: onChange, onSubmit
   - Error message: "Data przyjazdu nie może być w przeszłości"
   
3. **Before check-out**: Data < data wyjazdu
   - Trigger: onChange (cross-field validation), onSubmit
   - Error message: Pokazany przy polu "Data wyjazdu"

**Wpływ na UI**:
- DatePicker: daty w przeszłości są disabled
- Error message inline pod polem
- Submit button disabled jeśli błąd
- **Triggers**: `useCostCalculation()`, `useAvailabilityCheck()`

---

#### Pole: Data wyjazdu

**Komponenty**: QuickReservationForm, FullReservationForm

**Warunki**:
1. **Required**: Data musi być wybrana
   - Trigger: onSubmit
   - Error message: "Data wyjazdu jest wymagana"
   
2. **Not in past**: Data >= dzisiaj
   - Trigger: onChange, onSubmit
   - Error message: "Data wyjazdu nie może być w przeszłości"
   
3. **After check-in**: Data > data przyjazdu (min. 1 dzień różnicy)
   - Trigger: onChange (cross-field validation), onSubmit
   - Error message: "Data wyjazdu musi być późniejsza niż data przyjazdu"

**Wpływ na UI**:
- DatePicker: daty przed data przyjazdu są disabled
- Error message inline pod polem
- Submit button disabled jeśli błąd
- **Triggers**: `useCostCalculation()`, `useAvailabilityCheck()`

---

#### Dostępność miejsc (real-time check)

**Komponenty**: AvailabilityIndicator (używany w obu formularzach)

**Warunki**:
1. **Available spots > 0**: Są wolne miejsca
   - Display: `Alert` info - "ℹ️ Pozostało X wolnych miejsc"
   - Submit button: enabled
   
2. **Available spots = 0**: Brak wolnych miejsc
   - Display: `Alert` warning - "⚠️ Brak wolnych miejsc w wybranych datach"
   - Submit button: **disabled**
   - Sugestie: Alternatywne daty (future feature)

**Wpływ na UI**:
- **Krytyczny**: Submit button disabled jeśli brak miejsc
- AvailabilityIndicator widoczny zawsze
- Loading state podczas sprawdzania (debounced 500ms)

---

#### Pole: Email (Full Mode, optional)

**Komponenty**: FullReservationForm

**Warunki**:
1. **Format email**: Jeśli wypełniony, musi być poprawny format
   - Trigger: onBlur, onSubmit
   - Pattern: RFC 5322
   - Error message: "Nieprawidłowy format email"
   
2. **Max length**: Max 255 znaków
   - Trigger: onChange (prevent), onSubmit
   - Error message: "Email może zawierać maksymalnie 255 znaków"

**Wpływ na UI**:
- Error message inline pod polem
- Field nie blokuje submitu jeśli pusty (optional)

---

#### Pole: Telefon (Full Mode, optional)

**Komponenty**: FullReservationForm

**Warunki**:
1. **Format**: Jeśli wypełniony, 9 cyfr (Polski format)
   - Trigger: onBlur, onSubmit
   - Pattern: `^\d{9}$` (po usunięciu spacji)
   - Error message: "Numer telefonu musi zawierać 9 cyfr"
   
2. **Auto-formatowanie**: Dodawanie spacji podczas wpisywania
   - Format: `xxx xxx xxx`
   - Trigger: onChange

**Wpływ na UI**:
- Auto-formatowanie non-disruptive
- Error message inline pod polem
- Field nie blokuje submitu jeśli pusty

---

#### Pole: Nr rejestracyjny (Full Mode, optional)

**Komponenty**: FullReservationForm

**Warunki**:
1. **Format**: Jeśli wypełniony, Polski format tablic
   - Trigger: onBlur, onSubmit
   - Pattern: `^[A-Z]{2}\s?[A-Z0-9]{4,5}$`
   - Error message: "Nieprawidłowy format numeru rejestracyjnego"
   
2. **Auto-formatowanie**: Uppercase + space
   - Format: `XX 12345`
   - Trigger: onChange

**Wpływ na UI**:
- Auto-uppercase podczas wpisywania
- Auto-space po 2 literach
- Error message inline pod polem

---

#### Pole: Notatki (Full Mode, optional)

**Komponenty**: FullReservationForm

**Warunki**:
1. **Max length**: Max 1000 znaków
   - Trigger: onChange (prevent), onSubmit
   - Display: Licznik znaków pod textarea: "X/1000"
   - Error message: "Notatki mogą zawierać maksymalnie 1000 znaków"

**Wpływ na UI**:
- Licznik znaków zawsze widoczny
- Warning color jeśli > 900 znaków
- Error jeśli > 1000 (prevent input)

---

### 9.2 Warunki blokujące submit

Submit button jest **disabled** jeśli:

1. **Walidacja formularza nie przeszła**:
   - Jakiekolwiek required field jest puste
   - Jakiekolwiek pole ma error validation
   
2. **Brak wolnych miejsc**:
   - `isAvailable = false` (z `useAvailabilityCheck()`)
   
3. **Loading state**:
   - `isSubmitting = true` (submit w trakcie)
   - `isChecking = true` (sprawdzanie dostępności w trakcie)
   - `isCalculating = true` (obliczanie kosztu w trakcie)

**Tooltip na disabled button**:
- Jeśli brak miejsc: "Brak wolnych miejsc w wybranych datach"
- Jeśli loading: "Sprawdzanie dostępności..."
- Jeśli validation errors: "Popraw błędy formularza"

---

### 9.3 Server-side validation

API endpoint `POST /api/reservations` wykonuje dodatkową walidację:

1. **Constraint validation**: Database constraints (NOT NULL, CHECK)
2. **Overbooking prevention**: Trigger sprawdzający dostępność
3. **Business rules**: Dodatkowe reguły biznesowe

**Handling błędów server-side**:
- **400 Bad Request**: Mapowanie błędów na pola formularza (inline errors)
- **409 Conflict**: Modal z komunikatem o braku miejsc + sugestie dat
- **500 Internal Server Error**: Toast error z możliwością retry

## 10. Obsługa błędów

### 10.1 Validation Errors (400 Bad Request)

**Scenariusz**: API zwraca błędy walidacji dla pól formularza.

**Response example**:
```json
{
  "error": "Validation failed",
  "details": {
    "last_name": ["Nazwisko jest wymagane"],
    "planned_check_in": ["Data przyjazdu nie może być w przeszłości"]
  }
}
```

**Obsługa**:
1. Parse błędów z response
2. Mapowanie błędów na pola formularza (React Hook Form `setError`)
3. Inline error messages pojawiają się pod odpowiednimi polami
4. Focus na pierwsze pole z błędem
5. Submit button wraca do stanu normalnego (nie loading)

**UX**:
- Red border na polach z błędami
- Error messages inline (czerwony tekst)
- Scroll do pierwszego błędu jeśli poza viewport

---

### 10.2 Overbooking Conflict (409 Conflict)

**Scenariusz**: Brak wolnych miejsc w wybranych datach (pomimo client-side check - race condition).

**Response example**:
```json
{
  "error": "Overbooking conflict",
  "message": "Brak wolnych miejsc w wybranych datach",
  "availableDates": ["2025-12-02", "2025-12-03", "2025-12-06"]
}
```

**Obsługa**:
1. Modal główny pozostaje otwarty
2. **Alert Dialog** pojawia się na wierzchu:
   - Title: "Brak wolnych miejsc"
   - Message: "Niestety nie ma wolnych miejsc w wybranych datach."
   - Sugestie: "Dostępne daty: 2 grudnia, 3 grudnia, 6 grudnia"
   - Actions:
     - Button "Zmień daty" (primary) - zamyka alert, user może edytować formularz
     - Button "Anuluj" (secondary) - zamyka cały modal
3. User może wrócić do formularza i zmienić daty

**UX**:
- Non-destructive: Dane formularza zachowane
- Helpful: Sugestie alternatywnych dat
- Clear actions

---

### 10.3 Network Errors (500 Internal Server Error)

**Scenariusz**: Błąd serwera lub problem z siecią.

**Obsługa**:
1. Catch error w mutation
2. Toast notification (error variant):
   - Message: "Wystąpił błąd podczas tworzenia rezerwacji. Spróbuj ponownie."
   - Action button: "Spróbuj ponownie" (retry mutation)
   - Duration: 5000ms (lub manual dismiss)
3. Form pozostaje otwarty z danymi
4. Submit button wraca do stanu normalnego

**UX**:
- Non-disruptive: User nie traci danych
- Actionable: Możliwość retry
- Informative: Jasny komunikat

---

### 10.4 Offline Mode

**Scenariusz**: Użytkownik traci połączenie z internetem.

**Obsługa**:
1. Hook `useOnlineStatus()` wykrywa brak połączenia
2. Banner pojawia się na górze aplikacji (sticky):
   - Message: "⚠️ Brak połączenia z internetem"
   - Color: żółty (warning)
3. Modal pozostaje otwarty, ale:
   - Submit button **disabled** z tooltipem "Wymagane połączenie z internetem"
   - API calls (availability, cost) wstrzymane
   - Cached data wyświetlane jeśli dostępne
4. Po powrocie online:
   - Banner znika automatycznie
   - Submit button enabled
   - API calls retry automatycznie (React Query)

**UX**:
- Clear communication
- Preserved data
- Auto-recovery po powrocie online

---

### 10.5 Date Validation Errors

**Scenariusz**: User wybiera nieprawidłowe daty (mimo client-side validation - edge cases).

**Obsługa**:
1. Real-time validation podczas wyboru dat
2. DatePicker preventuje wybór:
   - Dat w przeszłości (disabled w kalendarzu)
   - Daty wyjazdu przed datą przyjazdu (disabled jeśli data przyjazdu wybrana)
3. Jeśli mimo to błąd wystąpi (np. timezone issue):
   - Inline error pod polem
   - Submit button disabled
   - Clear error message

**Walidacja triggered**:
- `onBlur` każdego pola daty
- `onChange` z cross-field validation (check-out vs check-in)
- `onSubmit`

---

### 10.6 Cost Calculation Errors

**Scenariusz**: Błąd podczas obliczania kosztu (API error).

**Obsługa**:
1. Hook `useCostCalculation()` zwraca error state
2. W `CostPreview`:
   - Display: "Koszt: --" (placeholder)
   - Tooltip: "Nie udało się obliczyć kosztu"
   - **Nie blokuje** submitu (koszt może być obliczony server-side)
3. Toast notification (warning):
   - Message: "Nie udało się obliczyć kosztu. Zostanie obliczony automatycznie."

**UX**:
- Non-blocking: User może kontynuować
- Informative: Jasny komunikat
- Fallback: Server-side calculation

---

### 10.7 Availability Check Errors

**Scenariusz**: Błąd podczas sprawdzania dostępności (API error).

**Obsługa**:
1. Hook `useAvailabilityCheck()` zwraca error state
2. W `AvailabilityIndicator`:
   - Display: `Alert` warning - "⚠️ Nie udało się sprawdzić dostępności"
   - **Nie blokuje** submitu (check zostanie wykonany server-side)
3. Tooltip na submit button: "Dostępność zostanie sprawdzona podczas zapisu"

**UX**:
- Non-blocking z warning
- Clear communication
- Server-side safety net

---

### 10.8 Unsaved Changes Warning

**Scenariusz**: User próbuje zamknąć modal z niezapisanymi zmianami.

**Obsługa**:
1. Detect unsaved changes:
   - React Hook Form `formState.isDirty`
   - Sprawdzenie czy którekolwiek pole zostało zmienione
2. Jeśli `isDirty = true`:
   - **Alert Dialog** przy próbie zamknięcia:
     - Title: "Niezapisane zmiany"
     - Message: "Masz niezapisane zmiany. Czy na pewno chcesz zamknąć bez zapisywania?"
     - Actions:
       - Button "Anuluj" (primary) - pozostaje w modalu
       - Button "Zamknij bez zapisywania" (destructive) - zamyka modal
3. Jeśli user wybierze "Zamknij":
   - Modal zamyka się
   - Form resetowany

**UX**:
- Safety net dla przypadkowego zamknięcia
- Clear choice dla usera
- Non-destructive default action

---

## 11. Kroki implementacji

### Krok 1: Setup struktury plików i typów

**Pliki do utworzenia**:
```
src/
├── components/
│   └── reservations/
│       ├── NewReservationModal.tsx
│       ├── QuickReservationForm.tsx
│       ├── FullReservationForm.tsx
│       ├── CostPreview.tsx
│       └── AvailabilityIndicator.tsx
├── hooks/
│   ├── useNewReservationForm.ts
│   ├── useAvailabilityCheck.ts
│   ├── useCostCalculation.ts
│   ├── useCreateReservation.ts
│   └── useDebounce.ts
├── lib/
│   └── schemas/
│       └── reservation.schema.ts (dodać quick i full schemas)
└── types.ts (dodać nowe typy ViewModel)
```

**Akcje**:
1. Utworzyć strukturę folderów
2. Dodać nowe typy do `src/types.ts` (z sekcji 5.1)
3. Dodać schematy walidacji Zod do `reservation.schema.ts` (z sekcji 5.2)
4. Utworzyć puste pliki komponentów i hooków

**Czas**: 30 minut

---

### Krok 2: Implementacja custom hooków

**Kolejność**:
1. `useDebounce.ts` - podstawowy hook utility
2. `useAvailabilityCheck.ts` - sprawdzanie dostępności
3. `useCostCalculation.ts` - obliczanie kosztu
4. `useCreateReservation.ts` - mutacja tworzenia rezerwacji
5. `useNewReservationForm.ts` - zarządzanie formularzem

**Szczegóły implementacji**:
- React Query dla API calls
- Debouncing dla availability check
- Error handling w każdym hooku
- TypeScript strict mode

**Testowanie**:
- Unit testy dla każdego hooka (optional dla MVP)
- Manual testing w komponencie testowym

**Czas**: 3-4 godziny

---

### Krok 3: Implementacja CostPreview i AvailabilityIndicator

**Komponenty utility** (bez logiki biznesowej):

**CostPreview**:
- Przyjmuje daty jako props
- Używa `useCostCalculation()` hook
- Wyświetla koszt lub loading state
- Format: "XX,XX zł"

**AvailabilityIndicator**:
- Przyjmuje daty jako props
- Używa `useAvailabilityCheck()` hook
- Conditional rendering: Alert info/warning
- Loading skeleton podczas check

**Testowanie**:
- Render w izolacji z mock data
- Loading states
- Error states

**Czas**: 1-2 godziny

---

### Krok 4: Implementacja QuickReservationForm

**Główny komponent**:
1. Setup React Hook Form z Zod resolver
2. Implementacja 3 pól formularza:
   - Input (Nazwisko) z auto-focus i capitalize
   - DatePicker (Data przyjazdu) z default today
   - DatePicker (Data wyjazdu) z default tomorrow
3. Integracja `CostPreview` i `AvailabilityIndicator`
4. Buttons:
   - "Zapisz szybko" - submit quick
   - "Zapisz i dodaj szczegóły" - switch to full mode
5. Walidacja real-time
6. Error handling

**UX Features**:
- Auto-focus na nazwisko
- Tab order logiczny
- Enter submit na ostatnim polu
- Loading states na button

**Testowanie**:
- Manual testing wszystkich interakcji
- Walidacja wszystkich pól
- API integration

**Czas**: 4-5 godzin

---

### Krok 5: Implementacja FullReservationForm

**Rozszerzony komponent**:
1. Setup React Hook Form z Zod resolver (full schema)
2. Implementacja wszystkich sekcji:
   - **PersonalInfoSection**: Imię, Nazwisko, Email, Telefon
   - **DatesSection**: Daty (z QuickMode)
   - **VehicleSection**: Nr rejestracyjny
   - **FlightSection**: Kierunek (Select)
   - **NotesSection**: Textarea z licznikiem
3. Auto-formatowanie:
   - Telefon: spacje
   - Nr rejestracyjny: uppercase + space
4. Integracja `CostPreview` i `AvailabilityIndicator`
5. Buttons:
   - "Wróć do trybu szybkiego" - switch back
   - "Zapisz rezerwację" - submit full
6. Pre-fill z Quick Mode data

**Testowanie**:
- Wszystkie pola
- Auto-formatowanie
- Przełączanie między trybami z zachowaniem danych

**Czas**: 5-6 godzin

---

### Krok 6: Implementacja NewReservationModal (kontener)

**Główny komponent kontenerowy**:
1. Setup Dialog (Shadcn UI)
2. Stan modala: `isOpen`, `mode`
3. Conditional rendering:
   - Quick Mode → `QuickReservationForm`
   - Full Mode → `FullReservationForm`
4. Props handling:
   - `onClose` - zamknięcie modala
   - `onSuccess` - callback po utworzeniu rezerwacji
5. Keyboard handling:
   - Escape - zamknięcie (z warning jeśli unsaved)
6. Unsaved changes detection

**Integracja**:
- Dialog overlay z blur
- Animacje (fade-in/out)
- Focus management

**Testowanie**:
- Otwieranie/zamykanie
- Przełączanie trybów
- Unsaved changes warning

**Czas**: 2-3 godziny

---

### Krok 7: Integracja z aplikacją

**Punkty integracji**:
1. **Globalny state modala**:
   - Context lub Zustand store dla `isOpen` state
   - Możliwość otwarcia modala z dowolnego miejsca
2. **Przyciski "+ Nowa rezerwacja"**:
   - Header
   - Sidebar
   - Dashboard
   - Lista rezerwacji
   - Floating button (mobile)
3. **Keyboard shortcut**:
   - Global listener `Ctrl+N` / `Cmd+N`
   - Event handler otwierający modal
4. **URL query param** (opcjonalnie):
   - `?modal=new-reservation` otwiera modal
   - Deep linking support

**Testowanie**:
- Wszystkie punkty dostępu do modala
- Keyboard shortcut
- URL deep linking

**Czas**: 2-3 godziny

---

### Krok 8: Implementacja API endpoints

**Endpoints do dodania** (jeśli nie istnieją):

1. **GET `/api/availability`**:
   - Query params: `check_in`, `check_out`
   - Response: `AvailabilityCheckResponse`
   - Logika: sprawdzanie `daily_occupancy` vs `settings.total_spots`

2. **GET `/api/calculate-cost`**:
   - Query params: `check_in`, `check_out`
   - Response: `CostCalculationResponse`
   - Logika: użycie funkcji `calculate_total_cost` z bazy

3. **POST `/api/reservations`** (już istnieje):
   - Sprawdzenie czy obsługuje wszystkie pola z `CreateReservationCommand`

**Testowanie**:
- Postman/Insomnia testing
- Error cases (400, 409, 500)
- Edge cases (timezone, leap days)

**Czas**: 3-4 godziny

---

### Krok 9: Obsługa błędów i UX polish

**Implementacja error handling**:
1. **Validation errors (400)**:
   - Mapowanie na pola formularza
   - Inline errors
2. **Overbooking (409)**:
   - Alert Dialog z sugestiami
3. **Network errors (500)**:
   - Toast z retry
4. **Offline mode**:
   - Banner + disabled submit

**UX improvements**:
1. Loading states:
   - Skeletons
   - Spinners
   - Disabled buttons
2. Success feedback:
   - Toast notification
   - Optimistic updates
3. Animacje:
   - Modal transitions
   - Button states
4. Accessibility:
   - ARIA labels
   - Keyboard navigation
   - Focus management

**Testowanie**:
- Wszystkie scenariusze błędów
- Loading states
- Animacje smooth
- Accessibility audit

**Czas**: 3-4 godziny

---

### Krok 10: Testing i bug fixing

**Manual testing**:
1. **Happy path**:
   - Quick Mode: utworzenie rezerwacji w <30 sekund
   - Full Mode: utworzenie z wszystkimi danymi
2. **Edge cases**:
   - Daty graniczne (dzisiaj, przełom roku)
   - Overbooking
   - Network issues
3. **Validation**:
   - Wszystkie pola
   - Cross-field validation
4. **UX flow**:
   - Przełączanie między trybami
   - Unsaved changes
   - Zamykanie modala
5. **Responsive**:
   - Desktop (>1024px)
   - Tablet (768-1024px)
   - Mobile (<768px)

**Bug fixing**:
- Lista znalezionych bugów
- Priorytetyzacja (critical vs nice-to-have)
- Fixing i re-testing

**Czas**: 4-5 godzin

---

### Krok 11: Dokumentacja i code review

**Dokumentacja**:
1. JSDoc comments dla wszystkich komponentów i hooków
2. README z przykładami użycia
3. Storybook stories (opcjonalnie)

**Code review**:
1. Self-review checklist:
   - TypeScript strict mode compliance
   - Error handling completeness
   - Accessibility
   - Performance (React.memo, useMemo jeśli potrzebne)
2. Team review
3. Addressing feedback

**Czas**: 2-3 godziny

---

### Podsumowanie czasu implementacji

| Krok | Opis | Czas szacowany |
|------|------|----------------|
| 1 | Setup struktury i typów | 0.5h |
| 2 | Custom hooki | 3-4h |
| 3 | CostPreview i AvailabilityIndicator | 1-2h |
| 4 | QuickReservationForm | 4-5h |
| 5 | FullReservationForm | 5-6h |
| 6 | NewReservationModal | 2-3h |
| 7 | Integracja z aplikacją | 2-3h |
| 8 | API endpoints | 3-4h |
| 9 | Error handling i UX polish | 3-4h |
| 10 | Testing i bug fixing | 4-5h |
| 11 | Dokumentacja i code review | 2-3h |
| **TOTAL** | | **30-40 godzin** |

**Zalecenia**:
- Implementacja iteracyjna (krok po kroku)
- Częste testowanie po każdym kroku
- Code review po krokach 5, 8, 10
- Deploy na staging po kroku 10

**Priorytety dla MVP**:
- **Must have**: Kroki 1-7, 9 (podstawy), 10
- **Should have**: Krok 8 (pełne API), 9 (pełny error handling)
- **Nice to have**: Krok 11 (dokumentacja rozszerzona), Storybook

---

**Koniec planu implementacji**

