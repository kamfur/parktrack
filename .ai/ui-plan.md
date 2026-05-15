# Architektura UI dla ParkTrack MVP

## 1. Przegląd struktury UI

### 1.1 Cel aplikacji
ParkTrack MVP to responsywna aplikacja webowa (RWD) przeznaczona dla pracowników obsługi parkingu, umożliwiająca cyfryzację procesów zarządzania rezerwacjami, obsługi przyjazdów/wyjazdów oraz raportowania obłożenia.

### 1.2 Główne założenia projektowe
- **Szybkość operacji**: Tworzenie rezerwacji telefonicznej w <30 sekund
- **Czytelność**: Natychmiastowy dostęp do dzisiejszych przyjazdów i wyjazdów
- **Real-time**: Synchronizacja danych między sesjami pracowników
- **Prostota**: Intuicyjny interfejs bez zbędnej złożoności
- **Responsywność**: Pełna funkcjonalność na desktop, tablet i mobile

### 1.3 Tech Stack
- **Framework**: Astro 5 + React 19
- **Styling**: Tailwind CSS 4 + Shadcn/ui
- **Backend**: Supabase (PostgREST API + Realtime)
- **State Management**: React Query + Context API
- **Walidacja**: React Hook Form + Zod

### 1.4 Architektura aplikacji
```
┌─────────────────────────────────────────────────────────┐
│                    Header (Sticky)                      │
│  Breadcrumbs | 🅿️ Wolne miejsca: 7/25 | 🔔 | Avatar   │
└─────────────────────────────────────────────────────────┘
┌──────────┬──────────────────────────────────────────────┐
│          │                                              │
│ Sidebar  │           Main Content Area                  │
│          │                                              │
│ - Logo   │  [Dynamiczna zawartość zależna od route]    │
│          │                                              │
│ Menu:    │                                              │
│  Dashboard                                             │
│  Rezerwacje                                           │
│  Raporty │                                              │
│          │                                              │
│ + Nowa   │                                              │
│          │                                              │
│ User     │                                              │
└──────────┴──────────────────────────────────────────────┘
```

## 2. Lista widoków

### 2.1 Dashboard (`/`)

**Cel główny**: Szybki przegląd dzisiejszych operacji parkingowych i dostęp do najważniejszych akcji

**Kluczowe informacje**:
- Liczba wolnych miejsc dziś
- Całkowita liczba rezerwacji na dziś
- Liczba zaplanowanych przyjazdów
- Liczba zaplanowanych wyjazdów
- Lista dzisiejszych przyjazdów (chronologicznie)
- Lista dzisiejszych wyjazdów (chronologicznie)

**Kluczowe komponenty**:
- **MetricCard** (4 karty): Wyświetlanie kluczowych metryk z ikonami i color coding
- **TodayView**: Kontener dla dwóch kolumn
- **ArrivalsColumn**: Lista kart przyjazdów z przyciskami Check-in
- **DeparturesColumn**: Lista kart wyjazdów z przyciskami Check-out
- **ReservationCard**: Kompaktowa karta z nazwiskiem, telefonem, godziną, statusem i przyciskiem akcji

**Struktura layoutu**:
```
┌──────────────────────────────────────────────────────────┐
│  Metryki (4 karty obok siebie)                           │
│  [Wolne] [Rezerwacje] [Przyjazdy] [Wyjazdy]              │
└──────────────────────────────────────────────────────────┘
┌─────────────────────────┬────────────────────────────────┐
│  Przyjazdy (8)          │  Wyjazdy (5)                   │
├─────────────────────────┼────────────────────────────────┤
│  ┌─────────────────┐    │  ┌─────────────────┐          │
│  │ Kowalski Jan    │    │  │ Nowak Anna      │          │
│  │ 📞 123 456 789  │    │  │ 📞 987 654 321  │          │
│  │ 🚗 WX 12345     │    │  │ 🚗 WZ 54321     │          │
│  │ ⏰ 14:00        │    │  │ ⏰ 10:30        │          │
│  │ [Check-in]      │    │  │ [Check-out]     │          │
│  └─────────────────┘    │  └─────────────────┘          │
│  ...                    │  ...                           │
└─────────────────────────┴────────────────────────────────┘
```

**UX/Accessibility/Security**:
- Color coding dla border-left kart według statusu
- Hover state pokazuje dodatkowe info (email, notatki)
- Empty state z CTA "Zobacz wszystkie rezerwacje"
- Real-time updates przez Supabase subscriptions
- Loading skeletons podczas fetch
- Focus management dla keyboard navigation

**API Endpoints**:
- `POST /rpc/get_todays_arrivals`
- `POST /rpc/get_todays_departures`
- `GET /settings?key=eq.total_parking_spots`

---

### 2.2 Lista Rezerwacji (`/rezerwacje`)

**Cel główny**: Zarządzanie wszystkimi rezerwacjami - wyszukiwanie, filtrowanie, edycja, tworzenie nowych

**Kluczowe informacje**:
- Lista wszystkich rezerwacji z paginacją
- Wyniki wyszukiwania (po nazwisku)
- Rezerwacje przefiltrowane według kryteriów
- Liczba znalezionych wyników
- Aktywne filtry

**Kluczowe komponenty**:
- **SearchBar**: Input z debounce 300ms
- **FilterPanel**: Collapsible sidebar z opcjami filtrowania
- **ActiveFiltersBadges**: Removable badges nad tabelą
- **ReservationTable**: Responsywna tabela z sortowaniem
- **PaginationControls**: Nawigacja stron z page size selector
- **EmptyState**: Komunikat gdy brak wyników

**Struktura layoutu**:
```
┌────────────────────────────────────────────────────────────┐
│  [🔍 Szukaj po nazwisku...]          [+ Nowa rezerwacja]  │
└────────────────────────────────────────────────────────────┘
┌──────────┬─────────────────────────────────────────────────┐
│ Filtry   │ Aktywne: [Status: Potwierdzona ×] [Telefon ×]  │
│ ▼        ├─────────────────────────────────────────────────┤
│ Daty     │ Tabela rezerwacji                               │
│ □□       │ ┌──────┬──────┬────────┬──────┬──────┬────────┐ │
│          │ │Nazwi.│Tel.  │Daty    │Status│Koszt │Akcje   │ │
│ Status   │ ├──────┼──────┼────────┼──────┼──────┼────────┤ │
│ ☑ Potwi. │ │Kowal.│123...|10→17.11│🔵    │210zł │⋮       │ │
│ ☐ W real │ │Nowak │987...|01→05.12│🟢    │120zł │⋮       │ │
│ ☐ Zakoń. │ └──────┴──────┴────────┴──────┴──────┴────────┘ │
│          │                                                  │
│ Źródło   │ Pokazano 1-25 z 234  [‹ 1 2 3 ... 10 ›]        │
│ ○ Wszys. │                                                  │
│ ○ Telefon│                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

**Funkcjonalności**:
- Wyszukiwanie debounced (300ms) z PostgREST `ilike`
- Multi-select filters dla statusu
- Date range picker dla dat rezerwacji
- Sortowanie według kolumn (default: `created_at desc`)
- Paginacja z opcjami: 10/25/50/100 (default 25)
- Persistence stanu w URL query params
- Responsive: Desktop = tabela, Mobile = karty

**UX/Accessibility/Security**:
- Skeleton loaders podczas ładowania
- Inline error messages przy błędach API
- Disabled state dla filtrów podczas fetch
- Keyboard navigation dla tabeli
- ARIA labels dla screen readers
- Debounced search redukuje API calls
- URL params pozwalają na share/bookmark filtrowanych widoków

**API Endpoints**:
- `GET /reservations?select=*&order=created_at.desc&offset=0&limit=25`
- Query params: `?status=eq.confirmed&source=eq.phone&last_name=ilike.*kowal*`

---

### 2.3 Formularz Nowej Rezerwacji (Modal)

**Trigger**: 
- Przycisk "+ Nowa rezerwacja" (header, dashboard, floating)
- Keyboard shortcut: Ctrl+N

**Cel główny**: Szybkie utworzenie rezerwacji telefonicznej lub walk-in z minimalną ilością danych

**Dwa warianty formularza**:

#### Wariant A: Quick Mode (domyślny)

**Kluczowe informacje**:
- Nazwisko (required)
- Data przyjazdu (required, default: dzisiaj)
- Data wyjazdu (required, default: jutro)
- Koszt (auto-obliczany, read-only)
- Dostępność miejsc (real-time check)

**Struktura**:
```
┌────────────────────────────────────────────┐
│  Nowa rezerwacja                       [×] │
├────────────────────────────────────────────┤
│  Nazwisko *                                │
│  [________________]                        │
│                                            │
│  Data przyjazdu *                          │
│  [📅 08.01.2026]                           │
│                                            │
│  Data wyjazdu *                            │
│  [📅 09.01.2026]                           │
│                                            │
│  Koszt: 30,00 zł                           │
│                                            │
│  ℹ️ Pozostało 7 wolnych miejsc             │
│                                            │
│  [Zapisz szybko]  [Zapisz i dodaj szczeg.]│
└────────────────────────────────────────────┘
```

**Walidacja**:
- Real-time: Data wyjazdu > Data przyjazdu
- Real-time: Daty nie w przeszłości
- Real-time check dostępności (debounced)
- Alert inline jeśli parking pełny
- Nazwisko min. 2 znaki

#### Wariant B: Full Mode (rozszerzony)

**Dodatkowe sekcje**:
- Dane osobowe: Imię, Email, Telefon
- Dane pojazdu: Nr rejestracyjny
- Szczegóły lotu: Kierunek (Wylot/Przylot)
- Notatki: Textarea

**Kluczowe komponenty**:
- **Form** (React Hook Form + Zod validation)
- **DatePicker** (Shadcn Calendar)
- **Input** z auto-formatowaniem
- **AlertInline** dla błędów dostępności
- **CostPreview** live update

**UX/Accessibility/Security**:
- Auto-focus na pole "Nazwisko"
- Tab order logiczny
- Enter submit na ostatnim polu
- Auto-capitalize nazwisko
- Auto-format: telefon (spacje), nr rej. (uppercase + space)
- Live cost calculation
- Optimistic update po save
- Toast notification z akcją "Dodaj szczegóły"
- Disable przycisku podczas save (loading spinner)
- Client-side validation (prevent) + Server-side (protect)

**API Endpoints**:
- `POST /reservations`
- Success: 201 Created
- Error 409: Modal z sugestiami alternatywnych dat
- Error 400: Inline errors pod polami

---

### 2.4 Szczegóły Rezerwacji (`/rezerwacje/[id]`)

**Trigger**: Kliknięcie w row tabeli, kartę lub link

**Cel główny**: Wyświetlenie pełnych informacji o rezerwacji z możliwością edycji i historią zmian

**Kluczowe informacje**:
- Wszystkie dane rezerwacji
- Status i źródło
- Informacje finansowe (koszt, płatność)
- Timeline historii (audit log)
- Dostępne akcje (zależne od statusu)

**Struktura layoutu**:
```
┌──────────────────────────────────────────────────┐
│  Kowalski Jan                [Potwierdzona] [×]  │
├──────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────┐   │
│  │ Dane osobowe     │  │ Szczegóły rez.     │   │
│  │ Email: ...       │  │ Przyjazd: 10.11    │   │
│  │ Tel: 123456789   │  │ Wyjazd: 17.11      │   │
│  │ Nr rej: WX 12345 │  │ Dni: 7             │   │
│  └──────────────────┘  │ Kierunek: Wylot    │   │
│                        └────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │ Finanse                                  │   │
│  │ Koszt: 210,00 zł                         │   │
│  │ Status: [Nieopłacone]  Źródło: Telefon   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Notatki                                         │
│  [Klient spóźni się o godzinę...]               │
│                                                  │
│  ▼ Historia                                      │
│  ○─ Utworzono rezerwację                        │
│  │  08.01.2026, 10:00 (Jan Kowalski)            │
│  ○─ Zaktualizowano dane                         │
│  │  08.01.2026, 10:15 (Jan Kowalski)            │
│  │  Zmieniono: telefon                          │
│                                                  │
│  [Check-in] [Edytuj] [Anuluj]                   │
└──────────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **DetailHeader**: Nazwisko + status badge
- **InfoGrid**: 2-kolumnowy layout danych
- **FinancialSection**: Koszt, płatność, źródło
- **NotesSection**: Editable textarea z auto-save
- **Timeline**: Pionowa linia z event entries
- **ActionButtons**: Conditional based on status

**Timeline events**:
- Utworzono (created_at)
- Zaktualizowano (updated_at + diff)
- Check-in (actual_check_in)
- Check-out (actual_check_out)
- Anulowano (status changed to cancelled)

**Edycja warunkowa**:
- Status `confirmed`: Wszystkie pola edytowalne
- Status `in_progress`: Daty przyjazdu locked, reszta edytowalna
- Status `completed`/`cancelled`: Tylko notatki

**UX/Accessibility/Security**:
- Modal (desktop) / Full-page (mobile)
- Smooth slide-in animation
- Backdrop blur
- Keyboard: Esc zamyka
- Dirty state tracking - warning przed nawigacją
- Optimistic updates
- Timeline z color-coded ikonami
- Click-to-call dla telefonu
- Click-to-email dla email

**API Endpoints**:
- `GET /reservations?id=eq.${id}`
- `PATCH /reservations?id=eq.${id}`

---

### 2.5 Operacja Check-in (Modal)

**Trigger**: Przycisk "Check-in" w karcie przyjazdu lub szczegółach

**Cel główny**: Potwierdzenie przyjazdu klienta z możliwością uzupełnienia brakujących danych oraz opcjonalnym przyjęciem płatności

**Flow**:
1. Sprawdzenie kompletności danych
2. Jeśli kompletna → natychmiastowy update (z opcjonalną płatnością)
3. Jeśli niekompletna → modal uzupełnienia (z opcjonalną płatnością)

**Struktura (dla niekompletnej z płatnością)**:
```
┌────────────────────────────────────────────┐
│  Uzupełnij dane przed przyjazdem       [×] │
├────────────────────────────────────────────┤
│  Rezerwacja: Kowalski Jan                  │
│  Planowany przyjazd: 08.01.2026, 14:00    │
│  Koszt: 210,00 zł                          │
│                                            │
│  Brakujące informacje:                     │
│                                            │
│  Telefon                                   │
│  [___ ___ ___]                             │
│                                            │
│  Nr rejestracyjny *                        │
│  [__ _____]                                │
│                                            │
│  Email (opcjonalnie)                       │
│  [________________]                        │
│                                            │
│  ⚠️ Nr rejestracyjny jest wymagany         │
│                                            │
│  ─────────────────────────────────────     │
│  Płatność (opcjonalnie)                    │
│                                            │
│  ☐ Klient opłacił rezerwację              │
│                                            │
│  Forma płatności (jeśli zaznaczono)        │
│  ○ Gotówka  ○ Karta  ○ Przelew            │
│                                            │
│  [Check-in]  [Pomiń i przyjmij]           │
└────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **CompletionForm**: Formularz z tylko brakującymi polami
- **AlertWarning**: Informacja o wymaganych polach
- **PaymentSection**: Opcjonalna sekcja płatności (collapsible)
- **PaymentCheckbox**: Optional checkbox
- **PaymentMethodSelect**: Radio group (visible if checkbox checked)
- **SkipButton**: Opcja awaryjnego przyjęcia

**Scenariusze płatności**:
1. **Klient płaci przy przyjeździe**: Zaznacz checkbox + wybierz formę → `is_paid: true, payment_method: 'cash'`
2. **Klient zapłaci przy wyjeździe**: Zostaw checkbox niezaznaczony → `is_paid: false`
3. **Szybki check-in**: Pomiń sekcję płatności całkowicie

**UX/Accessibility/Security**:
- Auto-formatowanie: telefon, nr rejestracyjny
- Validation real-time
- Loading state na przycisku
- Optimistic update: usuń z listy przyjazdów natychmiast
- Success animation: checkmark + slide-out
- Toast: "Check-in wykonany" (jeśli płatność: "+ Płatność zarejestrowana")
- Error rollback + shake animation
- Opcja "Pomiń" tylko dla uprawnień admin (future)
- Payment section domyślnie collapsed (expand jeśli klient chce płacić)

**API Call**:
```
PATCH /reservations?id=eq.${id}
Body: {
  status: 'in_progress',
  actual_check_in: '2026-01-08T14:05:12Z',
  phone: '123456789',
  license_plate: 'WX12345',
  is_paid: true,              // jeśli checkbox zaznaczony
  payment_method: 'cash'      // jeśli płatność wykonana
}
```

---

### 2.6 Operacja Check-out (Modal)

**Trigger**: Przycisk "Check-out" w karcie wyjazdu lub szczegółach

**Cel główny**: Potwierdzenie wyjazdu klienta z weryfikacją płatności (jeśli jeszcze nie została wykonana)

**Flow warunkowy**:
- **IF** `is_paid = true` → Pokazać tylko informację o płatności
- **IF** `is_paid = false` → Pokazać checkbox z potwierdzeniem otrzymania płatności + wybór formy

**Struktura (dla is_paid = false - płatność przy wyjeździe)**:
```
┌────────────────────────────────────────────┐
│  Potwierdź wyjazd                      [×] │
├────────────────────────────────────────────┤
│  Kowalski Jan                              │
│  10.11.2026 → 17.11.2026                   │
│  Dni: 7                                    │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Koszt do zapłaty: 210,00 zł         │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ☐ Potwierdzam otrzymanie płatności *      │
│                                            │
│  Forma płatności                           │
│  ○ Gotówka  ○ Karta  ○ Przelew            │
│                                            │
│  [Potwierdź wyjazd]  [Anuluj]             │
└────────────────────────────────────────────┘
```

**Struktura (dla is_paid = true - płatność już wykonana)**:
```
┌────────────────────────────────────────────┐
│  Potwierdź wyjazd                      [×] │
├────────────────────────────────────────────┤
│  Kowalski Jan                              │
│  10.11.2026 → 17.11.2026                   │
│  Dni: 7                                    │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Koszt: 210,00 zł                    │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ✅ Płatność otrzymana                     │
│  Forma: Gotówka                            │
│  Data: 10.11.2026, 14:05                   │
│                                            │
│  [Potwierdź wyjazd]  [Anuluj]             │
└────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **SummaryCard**: Podsumowanie rezerwacji z wyróżnionym kosztem
- **PaymentCheckbox**: Required checkbox (tylko jeśli `is_paid = false`)
- **PaymentMethodSelect**: Radio group (tylko jeśli `is_paid = false`)
- **PaymentInfo**: Read-only info o płatności (tylko jeśli `is_paid = true`)
- **ConfirmButton**: Disabled until checkbox checked (jeśli płatność wymagana)

**Walidacja**:
- **IF** `is_paid = false`: Checkbox musi być zaznaczony (required), button disabled do potwierdzenia
- **IF** `is_paid = true`: Brak walidacji płatności, button zawsze enabled

**UX/Accessibility/Security**:
- Large, bold cost display
- Color accent dla kosztu
- Conditional rendering sekcji płatności
- Check icon (✅) dla już opłaconych rezerwacji (zielony, success color)
- Disabled button z tooltipem "Potwierdź otrzymanie płatności" (tylko jeśli `is_paid = false`)
- Success toast z opcją "Drukuj pokwitowanie"
- Optimistic update: usuń z listy wyjazdów
- Invalidate queries: ['todaysDepartures', 'occupancy']
- Modal nie zamyka się przy kliknięciu backdrop (force decision)
- Keyboard: Enter submit (jeśli brak walidacji lub checkbox checked)

**API Call**:
```
// Jeśli is_paid = false (płatność przy wyjeździe)
PATCH /reservations?id=eq.${id}
Body: {
  status: 'completed',
  actual_check_out: '2026-01-08T18:30:00Z',
  is_paid: true,
  payment_method: 'cash'
}

// Jeśli is_paid = true (płatność już była)
PATCH /reservations?id=eq.${id}
Body: {
  status: 'completed',
  actual_check_out: '2026-01-08T18:30:00Z'
  // is_paid i payment_method pozostają bez zmian
}
```

---

### 2.7 Operacja No-Show (Confirmation Dialog)

**Trigger**: Dropdown menu (3 dots) w karcie przyjazdu → "Oznacz jako No-show"

**Cel główny**: Oznaczenie rezerwacji jako nierealizowanej z możliwością cofnięcia

**Struktura**:
```
┌────────────────────────────────────────────┐
│  Oznacz jako nie pojawił się           [×] │
├────────────────────────────────────────────┤
│  Klient: Kowalski Jan                      │
│  Planowany przyjazd: 08.01.2026, 14:00    │
│                                            │
│  Rezerwacja zostanie oznaczona jako        │
│  nierealizowana i miejsce zostanie         │
│  zwolnione.                                │
│                                            │
│  [Cofnij]  [Potwierdź]                    │
└────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **AlertDialog**: Confirmation z opisem konsekwencji
- **ActionButtons**: Cancel (default focus) + Confirm (warning color)

**UX/Accessibility/Security**:
- Warning color dla przycisku "Potwierdź"
- Default focus na "Cofnij" (safe option)
- Optimistic update: usuń z listy przyjazdów
- Toast z przyciskiem "Cofnij" (30s)
- Rezerwacja widoczna w filtrze "No-show" z pomarańczowym badge
- Zwalnia miejsce w occupancy
- Business rule: Możliwe tylko w dniu `planned_check_in` lub dzień później

**Revert flow**:
- Toast action button "Cofnij" lub manual z detail view
- PATCH: `{ status: 'confirmed' }`
- Przywraca do listy przyjazdów

**API Calls**:
```
PATCH /reservations?id=eq.${id}
Body: { status: 'no_show', actual_check_in: null }

// Revert:
Body: { status: 'confirmed' }
```

---

### 2.8 Edycja Rezerwacji (Inline/Modal)

**Trigger**: "Edytuj" z dropdown menu lub szczegółów

**Cel główny**: Modyfikacja danych rezerwacji z warunkami zależnymi od statusu

**Conditional editing rules**:

| Status | Edytowalne pola |
|--------|----------------|
| `confirmed` | Wszystkie |
| `in_progress` | Data wyjazdu, dane osobowe/pojazdu (daty przyjazdu locked) |
| `completed` | Tylko notatki |
| `cancelled` | Tylko notatki |

**Struktura (dla status `confirmed`)**:
```
┌──────────────────────────────────────────────────┐
│  Edycja rezerwacji                           [×] │
├──────────────────────────────────────────────────┤
│  [Formularz analogiczny do Full Mode]            │
│                                                   │
│  Zmiana daty wyjazdu: 17.11 → 20.11              │
│  Nowy koszt: 210,00 zł → 270,00 zł               │
│                                                   │
│  ⚠️ Zmiana dat przelicza koszt automatycznie     │
│                                                   │
│  [Zapisz]  [Anuluj]                              │
└──────────────────────────────────────────────────┘
```

**Funkcjonalności**:
- Toggle między view (read-only) a edit mode
- Live cost recalculation przy zmianie dat
- Real-time check dostępności przy zmianie dat
- Warning jeśli zmiana skutkuje konfliktem
- Dirty state tracking
- Unsaved changes warning przy nawigacji

**UX/Accessibility/Security**:
- Locked fields z disabled state + tooltip
- Live preview zmian kosztów
- Alert inline dla konfliktów dostępności
- Optimistic update
- Rollback changes przy "Anuluj"
- useBeforeUnload hook dla unsaved changes
- Server-side validation jako final source of truth
- 409 response jeśli overbooking

**API Call**:
```
PATCH /reservations?id=eq.${id}
Body: { ...updatedFields }
```

---

### 2.9 Anulowanie Rezerwacji (AlertDialog)

**Trigger**: "Anuluj" z dropdown menu lub szczegółów

**Cel główny**: Zmiana statusu rezerwacji na "Anulowana" bez usuwania z bazy

**Struktura**:
```
┌────────────────────────────────────────────┐
│  Anulować rezerwację?                  [×] │
├────────────────────────────────────────────┤
│  Rezerwacja dla Kowalski Jan zostanie      │
│  anulowana. Ta operacja zmieni status      │
│  na 'Anulowana'.                           │
│                                            │
│  Powód anulacji (opcjonalnie)              │
│  [________________________________]         │
│                                            │
│  [Cofnij]  [Anuluj rezerwację]            │
└────────────────────────────────────────────┘
```

**Odróżnienie od "Usuń"**:
- **Anuluj**: Zmienia status, zachowuje rekord (audit trail)
- **Usuń**: DELETE request, usuwa z bazy (tylko błędne wpisy)

**Kluczowe komponenty**:
- **AlertDialog**: Destructive action confirmation
- **OptionalTextarea**: Powód anulacji (zapisywany w notes)
- **DestructiveButton**: Czerwony przycisk "Anuluj rezerwację"

**UX/Accessibility/Security**:
- Default focus na "Cofnij"
- Destructive styling (red) dla confirm button
- Optimistic update
- Toast: "Rezerwacja anulowana"
- Rezerwacja pozostaje w bazie z czerwonym badge
- Zwalnia miejsca w occupancy
- Możliwość filtrowania anulowanych rezerwacji

**API Call**:
```
PATCH /reservations?id=eq.${id}
Body: { 
  status: 'cancelled',
  notes: `${existingNotes}\nAnulowano: ${reason}`
}
```

---

### 2.10 Raporty - Kalendarz Tygodniowy (`/raporty`)

**Cel główny**: Przeglądanie obłożenia parkingu w perspektywie tygodniowej

**Kluczowe informacje**:
- Obłożenie dla każdego dnia tygodnia
- Liczba zajętych/wolnych miejsc
- Procent obłożenia
- Zakres dat tygodnia
- Opcjonalne: Statystyki tygodnia

**Struktura layoutu**:
```
┌──────────────────────────────────────────────────────────┐
│  6 - 12 stycznia 2026                                    │
│  [« Poprzedni tydzień]  [Dzisiaj]  [Następny tydzień »] │
├──────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │Pon     │ │Wto     │ │Śro     │ │Czw     │ │Pią     ││
│  │6 sty   │ │7 sty   │ │8 sty   │ │9 sty   │ │10 sty  ││
│  │        │ │        │ │        │ │        │ │        ││
│  │[████░] │ │[█████░]│ │[██░░░] │ │[████░] │ │[██████]││
│  │ 72%    │ │ 84%    │ │ 40%    │ │ 68%    │ │ 96%    ││
│  │        │ │        │ │        │ │        │ │        ││
│  │18/25   │ │21/25   │ │10/25   │ │17/25   │ │24/25   ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘│
│                                                          │
│  ┌────────┐ ┌────────┐                                  │
│  │Sob     │ │Nie     │                                  │
│  │11 sty  │ │12 sty  │                                  │
│  └────────┘ └────────┘                                  │
└──────────────────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **WeekHeader**: Zakres dat + nawigacja
- **WeekGrid**: Grid 7 kolumn (desktop) / responsive stack (mobile)
- **DayCard**: Karta dnia z obłożeniem
- **OccupancyIndicator**: Progress bar lub circular progress
- **NavigationButtons**: Poprzedni/Następny/Dzisiaj

**Color coding (gradient według obłożenia)**:
- Zielony: <60% (bezpieczne)
- Żółty: 60-85% (średnie)
- Czerwony: >85% (krytyczne)

**UX/Accessibility/Security**:
- Klikalna karta otwiera szczegóły dnia
- Hover effect: subtle shadow increase
- Keyboard navigation: Tab + Enter
- Responsive: Desktop 7 kolumn, Tablet 3-4, Mobile stack/carousel
- Touch gestures: Swipe dla prev/next tydzień (mobile)
- Loading skeleton dla całego tygodnia
- Cache strategy: stale-while-revalidate (10 min)

**API Endpoints**:
- `GET /daily_occupancy?date=gte.2026-01-06&date=lte.2026-01-12&order=date.asc`

---

### 2.11 Szczegóły Dnia (Side Panel)

**Trigger**: Kliknięcie w kartę dnia w kalendarzu

**Cel główny**: Wyświetlenie wszystkich przyjazdów i wyjazdów dla wybranego dnia z pogrupowaniem godzinowym

**Kluczowe informacje**:
- Data i dzień tygodnia
- Obłożenie (liczba i procent)
- Lista przyjazdów pogrupowana godzinowo
- Lista wyjazdów pogrupowana godzinowo (z kierunkiem lotu)

**Struktura layoutu**:
```
┌─────────────────────────────────────────────┐
│  Poniedziałek, 6 stycznia 2026          [×] │
│  [████████████░░] 18/25 miejsc (72%)        │
│  [« Poprzedni]              [Następny »]    │
├─────────────────────────────────────────────┤
│  Przyjazdy                                  │
│  ─────────────────────────────────────────  │
│  14:00                                      │
│    Kowalski Jan                             │
│    WX 12345  •  14:00                       │
│                                             │
│    Nowak Anna                               │
│    WZ 54321  •  14:30                       │
│                                             │
│  16:00                                      │
│    Smith John                               │
│    E 123XYZ  •  16:15                       │
│                                             │
│  Wyjazdy                                    │
│  ─────────────────────────────────────────  │
│  10:00                                      │
│    Kowalska Maria                           │
│    WW 99999  •  10:30  •  ✈️ Wylot         │
│                                             │
│  12:00                                      │
│    Wiśniewski Piotr                         │
│    GD 12345  •  12:00  •  🛬 Przylot        │
└─────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **DayHeader**: Data + obłożenie + nawigacja
- **SectionHeader**: "Przyjazdy" / "Wyjazdy" z separatorem
- **TimelineGroup**: Grupa dla jednej godziny
- **ReservationEntry**: Kompaktowa karta z info
- **FlightDirectionBadge**: Ikona + tekst kierunku (tylko wyjazdy)

**Grupowanie godzinowe**:
- Dla każdej godziny z rezerwacjami: Bold header (np. "14:00")
- Poniżej: karty rezerwacji dla tej godziny
- Godziny bez rezerwacji nie pokazywane

**Empty states**:
- "Brak przyjazdów na ten dzień"
- "Brak wyjazdów na ten dzień"

**UX/Accessibility/Security**:
- Side panel z prawej (desktop, ~500px) / Full modal (mobile)
- Smooth slide-in animation (300ms)
- Backdrop blur dla main content
- Keyboard: Esc zamyka, Arrow keys prev/next dzień
- Scrollable content
- Sticky header podczas scroll
- Color-coded flight icons (departure blue, arrival green)
- Clickable rezerwacja otwiera szczegóły

**API Endpoints**:
- `GET /reservations?planned_check_in=eq.2026-01-06&order=planned_check_in.asc`
- `GET /reservations?planned_check_out=eq.2026-01-06&order=planned_check_out.asc`

---

### 2.12 Login (`/login`)

**Cel główny**: Autentykacja pracowników parkingu

**Kluczowe informacje**:
- Logo i nazwa aplikacji
- Formularz logowania
- Error messages

**Struktura**:
```
┌────────────────────────────────────────────┐
│                                            │
│              🅿️ ParkTrack                  │
│          System zarządzania parkingiem     │
│                                            │
│  Email                                     │
│  [____________________]                    │
│                                            │
│  Hasło                                     │
│  [____________________] 👁️                 │
│                                            │
│  ☐ Zapamiętaj mnie                         │
│                                            │
│  [Zaloguj się]                             │
│                                            │
└────────────────────────────────────────────┘
```

**Kluczowe komponenty**:
- **LoginForm**: Form z email + password
- **PasswordToggle**: Show/hide password
- **RememberCheckbox**: Session persistence option
- **SubmitButton**: With loading state

**UX/Accessibility/Security**:
- Centered layout
- Auto-focus na email field
- Password visibility toggle
- Error messages inline
- Loading state podczas auth
- Redirect to Dashboard po sukcesie
- HTTPS only
- Session stored in localStorage (Supabase default)
- Rate limiting dla failed attempts

**API**:
- Supabase Auth: `supabase.auth.signInWithPassword()`

---

## 3. Mapa podróży użytkownika

### 3.1 Główne przepływy użytkownika

#### Flow 1: Szybkie utworzenie rezerwacji telefonicznej ⭐ (Most critical)

```
START: Telefon dzwoni z pytaniem o rezerwację
  │
  ├─→ Pracownik: Dashboard (już zalogowany)
  │
  ├─→ Klik: "+ Nowa rezerwacja" (header/floating)
  │
  ├─→ Modal: Quick Mode Form otwiera się
  │
  ├─→ Wprowadza: Nazwisko + Daty (3 pola)
  │   └─→ Live preview: Koszt obliczany automatycznie
  │   └─→ Real-time: Check dostępności
  │
  ├─→ Klik: "Zapisz szybko"
  │   └─→ Optimistic update: Rezerwacja dodana do listy
  │   └─→ Toast: "Rezerwacja utworzona" + action "Dodaj szczegóły"
  │
  └─→ Modal zamyka się
      │
      └─→ Pracownik kontynuuje rozmowę (opcjonalnie klik "Dodaj szczegóły")
      
END: ⏱️ Target time: <30 sekund
```

#### Flow 2: Obsługa przyjazdu klienta

```
START: Klient przyjeżdża na parking
  │
  ├─→ Pracownik: Dashboard
  │
  ├─→ Widok: "Przyjazdy" (lewa kolumna)
  │   └─→ Sortowane chronologicznie po godzinie
  │
  ├─→ Znajduje: Rezerwację na liście (po nazwisku/godzinie)
  │
  ├─→ Klik: "Check-in" na karcie rezerwacji
  │
  ├─→ System sprawdza kompletność danych
  │
  ├─→ IF niekompletna:
  │   ├─→ Modal: "Uzupełnij dane przed przyjazdem"
  │   ├─→ Pokazuje: Tylko brakujące pola (telefon, nr rej.)
  │   ├─→ Pracownik: Uzupełnia dane od klienta
  │   │
  │   ├─→ IF klient chce zapłacić teraz:
  │   │   ├─→ Expand: Sekcja "Płatność"
  │   │   ├─→ Zaznacza: Checkbox "Klient opłacił rezerwację"
  │   │   └─→ Wybiera: Forma płatności (Gotówka/Karta/Przelew)
  │   │
  │   └─→ Klik: "Check-in"
  │
  ├─→ ELSE (kompletna):
  │   ├─→ IF klient chce zapłacić teraz:
  │   │   └─→ Quick modal z opcją płatności
  │   └─→ ELSE: Natychmiastowy update
  │
  ├─→ Optimistic update: Karta znika z listy przyjazdów
  │   └─→ Success animation: Checkmark + slide-out
  │
  ├─→ Toast: "Check-in wykonany" (+ "Płatność zarejestrowana" jeśli płatność)
  │
  └─→ Miejsce zmniejsza licznik wolnych
      
END: Klient parkuje, pracownik wydaje kluczyki/kartkę
```

#### Flow 3: Obsługa wyjazdu klienta

```
START: Klient wraca po samochód
  │
  ├─→ Pracownik: Dashboard
  │
  ├─→ Widok: "Wyjazdy" (prawa kolumna)
  │
  ├─→ Znajduje: Rezerwację na liście
  │
  ├─→ Klik: "Check-out" na karcie
  │
  ├─→ Modal: "Potwierdź wyjazd"
  │   └─→ Pokazuje: Podsumowanie + Koszt (large, bold)
  │
  ├─→ System sprawdza status płatności (is_paid)
  │
  ├─→ IF płatność już wykonana (is_paid = true):
  │   ├─→ Pokazuje: ✅ "Płatność otrzymana" (green badge)
  │   ├─→ Info: Forma płatności + data
  │   └─→ Button "Potwierdź wyjazd": Enabled (brak dodatkowej walidacji)
  │
  ├─→ ELSE (is_paid = false - płatność przy wyjeździe):
  │   ├─→ Pokazuje: Required checkbox "Potwierdzam otrzymanie płatności"
  │   ├─→ Pokazuje: Radio group "Forma płatności"
  │   ├─→ Button "Potwierdź wyjazd": Disabled
  │   │
  │   ├─→ Pracownik: Pobiera płatność od klienta
  │   │
  │   ├─→ Zaznacza: Checkbox potwierdzenia
  │   │   └─→ Button "Potwierdź wyjazd" staje się enabled
  │   │
  │   └─→ Wybiera: Forma płatności (Gotówka/Karta/Przelew)
  │
  ├─→ Klik: "Potwierdź wyjazd"
  │
  ├─→ Optimistic update: Karta znika z listy wyjazdów
  │
  ├─→ Toast: "Wyjazd potwierdzony. Miejsce zwolnione."
  │   └─→ Optional action: "Drukuj pokwitowanie"
  │
  └─→ Miejsce zwiększa licznik wolnych
      
END: Klient wyjeżdża
```

#### Flow 4: Wyszukiwanie i edycja rezerwacji

```
START: Klient dzwoni z pytaniem o swoją rezerwację
  │
  ├─→ Pracownik: Nawigacja → "Rezerwacje"
  │
  ├─→ Widok: Lista wszystkich rezerwacji
  │
  ├─→ Wprowadza: Nazwisko w search bar
  │   └─→ Debounced search (300ms)
  │   └─→ Loading spinner
  │
  ├─→ Wyniki: Filtrowane rezerwacje
  │
  ├─→ Klik: Row w tabeli
  │
  ├─→ Modal: Szczegóły rezerwacji otwiera się
  │   └─→ Pokazuje: Wszystkie dane + Historia
  │
  ├─→ IF potrzebna zmiana:
  │   ├─→ Klik: "Edytuj"
  │   ├─→ Form: Pola stają się edytowalne (conditional based on status)
  │   ├─→ Wprowadza: Zmiany (np. przedłużenie daty wyjazdu)
  │   ├─→ Live preview: Nowy koszt
  │   └─→ Klik: "Zapisz"
  │       └─→ Toast: "Rezerwacja zaktualizowana"
  │
  └─→ Modal zamyka się
      
END: Pracownik informuje klienta o zmianach
```

#### Flow 5: Sprawdzanie obłożenia na dany tydzień

```
START: Menedżer chce sprawdzić obłożenie
  │
  ├─→ Nawigacja → "Raporty"
  │
  ├─→ Widok: Kalendarz tygodniowy
  │   └─→ Domyślnie: Bieżący tydzień
  │
  ├─→ Przegląda: 7 kart dni z color coding
  │   └─→ Widzi: Obłożenie na pierwszy rzut oka (kolory)
  │
  ├─→ IF chce szczegóły konkretnego dnia:
  │   ├─→ Klik: Karta dnia (np. Środa)
  │   ├─→ Side panel: Szczegóły dnia otwiera się
  │   ├─→ Widzi: Timeline przyjazdów i wyjazdów
  │   │   └─→ Pogrupowane godzinowo
  │   └─→ Klik: [×] zamyka panel
  │
  ├─→ IF chce następny tydzień:
  │   ├─→ Klik: "Następny tydzień »"
  │   └─→ Kalendarz przeładowuje się
  │
  └─→ Ocenia: Dostępność miejsc
      
END: Decyzja o przyjmowaniu nowych rezerwacji
```

#### Flow 6: Obsługa No-Show

```
START: Minęła godzina przyjazdu, klient się nie pojawił
  │
  ├─→ Pracownik: Dashboard → "Przyjazdy"
  │
  ├─→ Znajduje: Rezerwację na liście
  │
  ├─→ Klik: Dropdown menu (3 dots) na karcie
  │
  ├─→ Wybiera: "Oznacz jako No-show"
  │
  ├─→ Dialog: "Oznacz jako nie pojawił się?"
  │   └─→ Pokazuje: Klient + Planowany przyjazd
  │
  ├─→ Klik: "Potwierdź"
  │
  ├─→ Optimistic update: Karta znika z listy przyjazdów
  │
  ├─→ Toast: "Rezerwacja oznaczona jako No-show" + action "Cofnij" (30s)
  │
  ├─→ Miejsce: Zwolnione w occupancy
  │
  └─→ IF pomyłka:
      ├─→ Klik: "Cofnij" w toast
      └─→ Rezerwacja wraca do listy przyjazdów
      
END: Miejsce dostępne dla innych
```

### 3.2 Scenariusze brzegowe

#### Edge Case 1: Parking pełny podczas tworzenia rezerwacji

```
Pracownik: Tworzy rezerwację (Quick Mode)
  │
  ├─→ Wprowadza: Nazwisko + Daty
  │
  ├─→ Real-time check: Brak wolnych miejsc
  │
  ├─→ Alert inline: "⚠️ Brak wolnych miejsc w wybranych datach"
  │
  ├─→ Button "Zapisz": Disabled
  │
  ├─→ Pracownik: Próbuje inne daty
  │   └─→ Real-time: Check na każdą zmianę (debounced)
  │
  └─→ IF nadal pełne:
      └─→ System pokazuje: Sugestie alternatywnych dat
```

#### Edge Case 2: Konflikt edycji (race condition)

```
Pracownik A i B: Otwierają tę samą rezerwację
  │
  ├─→ Pracownik A: Edytuje datę wyjazdu → Zapisuje
  │   └─→ Success: Rezerwacja zaktualizowana
  │
  ├─→ Pracownik B: (nie widzi zmian A) Edytuje telefon → Zapisuje
  │
  ├─→ Backend: Wykrywa conflict (optimistic locking lub timestamp)
  │
  ├─→ Response: 409 Conflict
  │
  ├─→ Toast error: "Rezerwacja została zaktualizowana przez innego użytkownika"
  │
  └─→ Modal: Przeładowuje się z aktualnymi danymi
      └─→ Informacja: "Dane zostały odświeżone. Wprowadź zmiany ponownie."
```

#### Edge Case 3: Offline mode

```
Pracownik: Traci połączenie z internetem
  │
  ├─→ System: Wykrywa offline (useOnlineStatus hook)
  │
  ├─→ Banner: "⚠️ Brak połączenia z internetem" (żółty, sticky top)
  │
  ├─→ Wszystkie action buttons: Disabled z tooltipem "Wymagane połączenie"
  │
  ├─→ Read-only mode: Cached data nadal wyświetlane
  │
  └─→ Pracownik: Odzyskuje połączenie
      ├─→ Banner: Znika automatycznie
      ├─→ System: Auto-retry pending requests
      └─→ Toast: "Połączenie przywrócone"
```

### 3.3 Navigation Map

```
┌─────────────────────────────────────────────────┐
│                    /login                       │
│              (Auth Gateway)                     │
└─────────────────┬───────────────────────────────┘
                  │ (authenticated)
                  ▼
┌─────────────────────────────────────────────────┐
│                      /                          │
│                  Dashboard                      │
│  ┌──────────────────┬─────────────────────┐    │
│  │ Przyjazdy        │ Wyjazdy             │    │
│  │ [Check-in] ───►  │ [Check-out] ───►    │    │
│  └──────────────────┴─────────────────────┘    │
└────────┬────────────────────────────────────────┘
         │
    ┌────┼─────────┬────────────┐
    │    │         │            │
    ▼    ▼         ▼            ▼
┌────┐ ┌────┐  ┌─────┐    ┌─────────┐
│Nowa│ │Rez.│  │Rapor│    │Szczegóły│
│Rez.│ │    │  │ty   │    │Rez.     │
│    │ │Lista│  │     │    │/rez/[id]│
│Modal Tabela│  │Kalen│    │Modal    │
│    │ │    │  │darz │    │         │
│    │ │    │  │     │    │ [Edytuj]│
│    │ │[+] │  │[Day]│    │ [Anuluj]│
│    │ │    │◄─┤Card │    │         │
└────┘ │    │  │     │    └─────────┘
       │    │  │ ▼   │
       │[Rez]│  │Day  │
       │    │  │Panel│
       │[🔍]│  │     │
       └────┘  └─────┘
```

**URL Structure**:
- `/` - Dashboard (default po login)
- `/rezerwacje` - Lista wszystkich rezerwacji
- `/rezerwacje/nowa` lub `?modal=new` - Formularz nowej rezerwacji
- `/rezerwacje/[id]` - Szczegóły/Edycja rezerwacji
- `/raporty` - Kalendarz tygodniowy
- `/raporty/dzien/[date]` lub `?day=YYYY-MM-DD` - Szczegóły dnia
- `/login` - Logowanie

## 4. Layout i struktura nawigacji

### 4.1 Główny Layout Aplikacji (AppLayout)

**Struktura komponentów**:
```
<AppLayout>
  <Header />
  <div class="flex">
    <Sidebar />
    <MainContent>
      {children}
    </MainContent>
  </div>
</AppLayout>
```

### 4.2 Header (Sticky, 64px height)

**Desktop Layout**:
```
┌────────────────────────────────────────────────────────┐
│ [☰] Breadcrumbs > Path    |  🅿️ 7/25  | 🔔 | 👤 Admin│
└────────────────────────────────────────────────────────┘
```

**Mobile Layout**:
```
┌────────────────────────────────────────────────────────┐
│ [☰] Page Title                    🅿️ 7/25 | 👤         │
└────────────────────────────────────────────────────────┘
```

**Komponenty**:
- **Hamburger** (mobile): Toggle sidebar
- **Breadcrumbs** (desktop): Dynamiczne ścieżki nawigacji
- **PageTitle** (mobile): Tytuł aktualnej strony
- **SpotCounter**: Licznik wolnych miejsc z color coding
  - Zielony: >30% wolnych
  - Żółty: 10-30% wolnych
  - Czerwony: <10% wolnych
- **NotificationBell**: Icon z badge (future)
- **UserDropdown**: Avatar + dropdown menu
  - Moje konto (future)
  - Wyloguj

**Behavior**:
- Fixed position (sticky top)
- Shadow przy scroll down
- Z-index: 50

### 4.3 Sidebar (240px collapsed to 64px)

**Desktop Layout (expanded)**:
```
┌──────────────┐
│ 🅿️ ParkTrack │
├──────────────┤
│ 🏠 Dashboard │
│ 📋 Rezerwacje│
│ 📊 Raporty   │
├──────────────┤
│              │
│ + Nowa       │
│   Rezerwacja │
│              │
├──────────────┤
│ 👤 Jan K.    │
│    Wyloguj   │
└──────────────┘
```

**Mobile**: 
- Hamburger menu (overlay)
- Bottom navigation (4 icons)

**Komponenty**:
- **Logo**: ParkTrack + ikona
- **NavMenu**: Lista głównych sekcji
  - Dashboard (🏠)
  - Rezerwacje (📋)
  - Raporty (📊)
- **QuickAction**: Wyróżniony przycisk "+ Nowa rezerwacja"
- **UserSection**: User info + logout

**Behavior**:
- Collapsible: 240px ⇄ 64px (tylko ikony)
- Active state: Bold + background color
- Hover state: Subtle background
- Keyboard: Tab navigation

### 4.4 Responsywność Nawigacji

**Breakpoints**:

| Device | Width | Sidebar | Header | Navigation |
|--------|-------|---------|--------|------------|
| Mobile | <768px | Hidden (hamburger) | Simplified | Bottom nav (4 icons) |
| Tablet | 768-1024px | Collapsible | Full breadcrumbs | Sidebar |
| Desktop | >1024px | Fixed expanded | Full | Sidebar |

**Mobile Bottom Navigation**:
```
┌────────────────────────────────────────────────┐
│  [🏠]      [📋]       [📊]       [+]           │
│ Dashboard Rezerwacje Raporty    Nowa           │
└────────────────────────────────────────────────┘
```

### 4.5 Breadcrumbs Examples

| Route | Breadcrumbs |
|-------|-------------|
| `/` | Dashboard |
| `/rezerwacje` | Rezerwacje |
| `/rezerwacje?search=kowalski` | Rezerwacje > Wyniki: "kowalski" |
| `/rezerwacje/[id]` | Rezerwacje > Kowalski Jan |
| `/raporty` | Raporty > Kalendarz |
| `/raporty?day=2026-01-08` | Raporty > 8 stycznia 2026 |

### 4.6 Główne Akcje i Skróty

**Global Actions** (dostępne zawsze):
- **"+ Nowa rezerwacja"**: 
  - Floating button (mobile)
  - Sidebar button (desktop)
  - Shortcut: Ctrl+N (future)
  
**Kontekstualne Actions**:
- Dashboard: Quick access do operacji dnia
- Lista rezerwacji: Bulk actions (future)
- Szczegóły: Edit, Cancel, Delete

## 5. Kluczowe komponenty

### 5.1 Komponenty UI (Shadcn/ui)

**Wykorzystywane komponenty**:
- **Button**: Wszystkie akcje (variants: default, secondary, destructive, ghost, link)
- **Card**: Kontenery dla treści (metryki, rezerwacje, dni)
- **Dialog/AlertDialog**: Modals i confirmation dialogs
- **Table**: Lista rezerwacji
- **Badge**: Statusy rezerwacji
- **Form/Input/Select**: Formularze
- **Calendar**: Date picker dla dat rezerwacji
- **Toast**: Notifications system
- **Separator**: Wizualne separatory sekcji
- **Dropdown Menu**: Actions menu (3 dots)
- **Checkbox/Radio**: Payment confirmation, filters
- **Textarea**: Notatki
- **Skeleton**: Loading states

### 5.2 Feature Components

#### ReservationCard
**Lokalizacja**: `src/components/features/reservations/ReservationCard.tsx`

**Props**:
```typescript
interface ReservationCardProps {
  reservation: Reservation;
  mode: 'arrival' | 'departure';
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
}
```

**Odpowiedzialność**:
- Wyświetla kompaktową kartę rezerwacji
- Border-left w kolorze statusu
- Conditional button (Check-in vs Check-out)
- Hover state z dodatkowymi info
- Click opens details

#### ReservationTable
**Lokalizacja**: `src/components/features/reservations/ReservationTable.tsx`

**Props**:
```typescript
interface ReservationTableProps {
  reservations: Reservation[];
  isLoading: boolean;
  onSort: (column: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

**Odpowiedzialność**:
- Responsywna tabela (desktop) / karty (mobile)
- Sortowanie kolumn
- Row actions (dropdown menu)
- Skeleton podczas loading
- Empty state

#### QuickReservationModal
**Lokalizacja**: `src/components/features/reservations/QuickReservationModal.tsx`

**Props**:
```typescript
interface QuickReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reservation: Reservation) => void;
}
```

**Odpowiedzialność**:
- Quick Mode form (3 pola)
- Real-time cost calculation
- Availability check
- Toggle do Full Mode
- Validation z React Hook Form + Zod

#### CheckInModal
**Lokalizacja**: `src/components/features/reservations/CheckInModal.tsx`

**Props**:
```typescript
interface CheckInModalProps {
  reservation: Reservation;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Odpowiedzialność**:
- Sprawdza kompletność danych
- Conditional: natychmiastowy update vs formularz uzupełnienia
- Validation brakujących pól
- **Optional payment section**: Collapsible sekcja z możliwością przyjęcia płatności przy check-in
  - Checkbox "Klient opłacił rezerwację"
  - Radio group: Forma płatności (visible if checkbox checked)
- Optimistic update

#### CheckOutModal
**Lokalizacja**: `src/components/features/reservations/CheckOutModal.tsx`

**Props**:
```typescript
interface CheckOutModalProps {
  reservation: Reservation;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Odpowiedzialność**:
- Podsumowanie + koszt (large, bold)
- **Conditional rendering** based on `reservation.is_paid`:
  - IF `is_paid = true`: Display payment info (✅ badge, method, date) - read-only
  - IF `is_paid = false`: Display payment confirmation checkbox + method select
- Validation: button disabled until checkbox (tylko jeśli płatność wymagana)
- Optimistic update

#### MetricCard
**Lokalizacja**: `src/components/features/dashboard/MetricCard.tsx`

**Props**:
```typescript
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'yellow' | 'red';
  subtitle?: string;
}
```

**Odpowiedzialność**:
- Wyświetla pojedynczą metrykę
- Color coding dla ikony i border
- Optional subtitle
- Loading skeleton

#### TodayView
**Lokalizacja**: `src/components/features/dashboard/TodayView.tsx`

**Odpowiedzialność**:
- Layout dla dwóch kolumn (Przyjazdy | Wyjazdy)
- Zarządza stanem modali (Check-in, Check-out)
- Real-time subscriptions
- Empty states

#### WeeklyCalendar
**Lokalizacja**: `src/components/features/reports/WeeklyCalendar.tsx`

**Props**:
```typescript
interface WeeklyCalendarProps {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
}
```

**Odpowiedzialność**:
- Grid 7 dni
- Navigation: prev/next/today
- DayCard components
- Loading state dla całego tygodnia

#### DayCard
**Lokalizacja**: `src/components/features/reports/DayCard.tsx`

**Props**:
```typescript
interface DayCardProps {
  date: Date;
  occupancy: number;
  totalSpots: number;
  onClick: () => void;
}
```

**Odpowiedzialność**:
- Wyświetla pojedynczy dzień
- Progress bar obłożenia
- Color coding według %
- Hover effect
- Click opens details panel

#### DayDetailsPanel
**Lokalizacja**: `src/components/features/reports/DayDetailsPanel.tsx`

**Props**:
```typescript
interface DayDetailsPanelProps {
  date: Date;
  isOpen: boolean;
  onClose: () => void;
  onDateChange: (date: Date) => void;
}
```

**Odpowiedzialność**:
- Side panel (desktop) / Modal (mobile)
- Timeline arrivals + departures
- Grupowanie godzinowe
- Navigation: prev/next dzień
- Slide-in animation

#### TimelineSection
**Lokalizacja**: `src/components/features/reports/TimelineSection.tsx`

**Props**:
```typescript
interface TimelineSectionProps {
  title: 'Przyjazdy' | 'Wyjazdy';
  reservations: Reservation[];
  showFlightDirection?: boolean;
}
```

**Odpowiedzialność**:
- Grupowanie rezerwacji po godzinie
- Render TimelineGroup dla każdej godziny
- Empty state
- Flight direction badges (dla wyjazdów)

### 5.3 Layout Components

#### AppLayout
**Lokalizacja**: `src/components/layout/AppLayout.tsx`

**Odpowiedzialność**:
- Główny wrapper aplikacji
- Conditional: Auth check + redirect
- Render: Header + Sidebar + MainContent
- Context Providers hierarchy

#### Header
**Lokalizacja**: `src/components/layout/Header.tsx`

**Odpowiedzialność**:
- Breadcrumbs dynamiczne
- SpotCounter z real-time updates
- UserDropdown
- Mobile: hamburger toggle

#### Sidebar
**Lokalizacja**: `src/components/layout/Sidebar.tsx`

**Odpowiedzialność**:
- NavMenu z active states
- QuickAction button
- Collapsible logic
- UserSection

#### Navigation
**Lokalizacja**: `src/components/layout/Navigation.tsx`

**Odpowiedzialność**:
- Desktop: Sidebar items
- Mobile: Bottom nav
- Active route highlighting

### 5.4 Shared Components

#### SearchBar
**Lokalizacja**: `src/components/shared/SearchBar.tsx`

**Props**:
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isLoading?: boolean;
}
```

**Odpowiedzialność**:
- Input z ikoną search
- Debounced onChange (300ms)
- Loading spinner w input
- Clear button

#### StatusBadge
**Lokalizacja**: `src/components/shared/StatusBadge.tsx`

**Props**:
```typescript
interface StatusBadgeProps {
  status: ReservationStatus;
  variant?: 'default' | 'outline';
}
```

**Odpowiedzialność**:
- Mapowanie statusu na kolor
- Icon + text
- Consistent styling

#### EmptyState
**Lokalizacja**: `src/components/shared/EmptyState.tsx`

**Props**:
```typescript
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Odpowiedzialność**:
- Ilustracja (scaled icon)
- Title + description
- Optional CTA button
- Centered layout

#### LoadingSpinner
**Lokalizacja**: `src/components/shared/LoadingSpinner.tsx`

**Props**:
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}
```

**Odpowiedzialność**:
- Animated spinner
- Optional text below
- Size variants
- Centered by default

### 5.5 Hooks i Serwisy

**Custom Hooks** (`src/lib/hooks/`):
- `useReservations(filters?)` - Query all reservations
- `useTodaysArrivals()` - Query today's arrivals
- `useTodaysDepartures()` - Query today's departures
- `useWeeklyOccupancy(weekStart)` - Query week data
- `useCreateReservation()` - Mutation create
- `useCheckIn()` - Mutation check-in with optimistic update
- `useCheckOut()` - Mutation check-out with optimistic update
- `useAuth()` - Auth context consumer
- `usePermissions()` - Permissions check (MVP: always true)
- `useOnlineStatus()` - Network status detection

**Services** (`src/lib/services/`):
- `reservation.service.ts` - All reservation CRUD + operations
- `occupancy.service.ts` - Occupancy queries
- `settings.service.ts` - Settings management

**Utilities** (`src/lib/utils/`):
- `date.ts` - Date formatting, calculations
- `currency.ts` - Currency formatting, cost calculation
- `validation.ts` - Polish phone, license plate validation
- `string.ts` - Capitalize, formatting
- `api.ts` - Error handling, parsing
- `status.ts` - Status colors, icons, labels

### 5.6 Design System Tokens

**Colors** (Tailwind config):
```javascript
colors: {
  primary: '#3B82F6', // Blue
  status: {
    confirmed: '#3B82F6',    // Blue
    in_progress: '#10B981',  // Green
    completed: '#6B7280',    // Gray
    cancelled: '#EF4444',    // Red
    no_show: '#F59E0B',      // Orange
  },
  occupancy: {
    safe: '#10B981',      // Green <60%
    medium: '#F59E0B',    // Yellow 60-85%
    critical: '#EF4444',  // Red >85%
  }
}
```

**Spacing Scale**:
- `space-y-6` (24px): Między sekcjami
- `space-y-4` (16px): Między elementami
- `p-6` (24px): Padding w kartach
- `px-3 py-2` (12px x 8px): Padding w inputs

**Typography**:
- h1: `text-3xl font-bold` (30px)
- h2: `text-2xl font-semibold` (24px)
- h3: `text-xl font-semibold` (20px)
- body: `text-base` (16px)
- small: `text-sm` (14px)
- tiny: `text-xs` (12px)

**Border Radius**:
- Default: `rounded-lg` (8px) - Shadcn default
- Buttons: `rounded-md` (6px)
- Inputs: `rounded-md` (6px)

**Animations**:
- Page transition: fade 150ms
- Modal: fade + scale 200ms
- Toast: slide-in 300ms
- Hover: transition-all 200ms
- Respect: `prefers-reduced-motion`

## 6. UX, Accessibility i Security - Podsumowanie

### 6.1 UX Principles

**Kluczowe zasady**:
1. **Szybkość**: Minimalizacja kroków dla częstych operacji
2. **Czytelność**: Hierarchia wizualna, konsystentne kolory
3. **Feedback**: Natychmiastowy feedback dla każdej akcji
4. **Forgiveness**: Możliwość cofnięcia akcji (undo), confirmation dialogs
5. **Consistency**: Spójne patterns dla podobnych operacji

**Optimistic Updates**:
- Check-in/Check-out: Natychmiastowa zmiana UI
- Rollback przy błędzie
- Loading states dla akcji >300ms

**Empty States**:
- Zawsze z ilustracją + CTA
- Helpful messages
- Sugestie następnych kroków

**Error Handling**:
- Inline errors dla formularzy
- Toast dla API errors
- Modals dla krytycznych błędów
- User-friendly messages (nie tech jargon)

### 6.2 Accessibility (a11y)

**Podstawowe standardy**:
- Semantic HTML
- WCAG AA contrast ratio (4.5:1)
- Focus visible indicators
- Keyboard navigation
- Screen reader support

**Keyboard Shortcuts** (future):
- Ctrl+N: Nowa rezerwacja
- Esc: Zamknij modal
- Tab: Nawigacja fokusem
- Enter: Submit/Confirm
- Arrow keys: Nawigacja w kalendarzu

**ARIA**:
- `aria-label` dla icon-only buttons
- `aria-live` dla toasts
- `aria-describedby` dla error messages
- `aria-expanded` dla collapsible
- `role` dla custom components

### 6.3 Security

**Autentykacja**:
- Supabase Auth (email + password)
- Session w localStorage
- Middleware guard dla protected routes
- Auto-redirect do /login przy 401

**Autoryzacja**:
- MVP: Single access level
- Infrastructure ready dla permissions
- RLS w Supabase DB

**Input Validation**:
- Client-side: React Hook Form + Zod (prevent)
- Server-side: DB constraints (protect)
- Auto-sanitization przez Supabase

**API Security**:
- External endpoint: API key auth
- Rate limiting
- CORS configured
- HTTPS only

**Data Protection**:
- RODO compliance: 1 miesiąc retention
- Sensitive data nie logowane
- Passwords hashed (Supabase bcrypt)

### 6.4 Performance

**Optimization strategies**:
- React Query caching (staleTime configured per query)
- Debounced search (300ms)
- Real-time subscriptions (tylko krytyczne dane)
- Skeleton loaders (perceived performance)
- Optimistic updates (instant feedback)

**Loading States**:
- Skeleton screens dla list
- Spinner dla single items
- Progress bar dla multi-step (future)
- Disabled states podczas operacji

**Error Recovery**:
- Retry logic dla failed requests
- Offline detection + banner
- Auto-retry przy powrocie online
- Fallback do cached data

---

## 7. Priorytetyzacja implementacji

### Phase 1: Core Foundation (Tydzień 1-2)
**Cel**: Setup projektu i podstawowy layout

- [ ] Setup Astro + React + Tailwind + Shadcn
- [ ] Supabase integration (client, types, auth)
- [ ] AppLayout, Header, Sidebar
- [ ] Routing i nawigacja
- [ ] AuthContext i login page
- [ ] Podstawowe komponenty UI

### Phase 2: Dashboard i Operacje Dzienne (Tydzień 3)
**Cel**: Najważniejsze funkcjonalności operacyjne

- [ ] Dashboard layout i metryki
- [ ] TodayView (Przyjazdy/Wyjazdy)
- [ ] ReservationCard
- [ ] Check-in flow z modalem
- [ ] Check-out flow z payment confirmation
- [ ] Real-time licznik miejsc

### Phase 3: Zarządzanie Rezerwacjami (Tydzień 4-5)
**Cel**: CRUD rezerwacji

- [ ] Lista rezerwacji z tabelą
- [ ] Wyszukiwanie i filtrowanie
- [ ] Paginacja
- [ ] Quick reservation form
- [ ] Full reservation form
- [ ] Szczegóły rezerwacji z timeline
- [ ] Edycja warunkowa
- [ ] Anulowanie i no-show

### Phase 4: Raporty (Tydzień 6)
**Cel**: Kalendarz i obłożenie

- [ ] Widok tygodniowy
- [ ] DayCard z color coding
- [ ] DayDetailsPanel
- [ ] Timeline z pogrupowaniem godzinowym
- [ ] Nawigacja między dniami/tygodniami

### Phase 5: Polish (Tydzień 7)
**Cel**: UX improvements

- [ ] Empty states
- [ ] Toast system
- [ ] Loading states i skeletons
- [ ] Animacje
- [ ] Offline handling
- [ ] Error handling
- [ ] Responsywność - testy

### Phase 6: Testing i Deployment (Tydzień 8)
**Cel**: Production ready

- [ ] Manual testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Deployment
- [ ] Training materials

---

**Koniec dokumentu architektury UI**

*Wersja: 1.0*  
*Data: 8 stycznia 2026*  
*Autor: AI Architect*

