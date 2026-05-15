# Dashboard Components

Komponenty widoku Dashboard dla aplikacji ParkTrack - główny interfejs do obsługi codziennych operacji parkingowych.

## 📁 Struktura komponentów

```
src/components/dashboard/
├── DashboardContainer.tsx    # Główny kontener z logiką stanu
├── MetricsSection.tsx         # Sekcja z 4 kartami metryk
├── MetricCard.tsx            # Pojedyncza karta metryki
├── TodayView.tsx             # Kontener dla kolumn przyjazdów/wyjazdów
├── ArrivalsColumn.tsx        # Lista dzisiejszych przyjazdów
├── DeparturesColumn.tsx      # Lista dzisiejszych wyjazdów
└── ReservationCard.tsx       # Karta pojedynczej rezerwacji
```

## 🎯 Funkcjonalności

### DashboardContainer
- **Zarządzanie stanem:** Wykorzystuje custom hook `useDashboard()`
- **Pobieranie danych:** Automatyczne przy montowaniu komponentu
- **Obsługa akcji:** Check-in i Check-out z toast notifications
- **Stany UI:** Loading skeletons, error state, success state

### MetricsSection
Wyświetla 4 karty metryk:
- **Wolne miejsca** (zielony akcent)
- **Wszystkie rezerwacje** (niebieski akcent)
- **Przyjazdy** (pomarańczowy akcent)
- **Wyjazdy** (fioletowy akcent)

### TodayView
- **Responsive layout:** 2 kolumny na desktop, 1 na mobile
- **Równoległe wyświetlanie:** Przyjazdy i wyjazdy obok siebie

### ArrivalsColumn & DeparturesColumn
- **Scrollowalne listy** rezerwacji
- **Liczniki** z kolorowym oznaczeniem
- **Empty states** dla braku danych
- **Loading skeletons** podczas ładowania
- **Accessibility:** ARIA labels, role="list", aria-live

### ReservationCard
- **Informacje:** Nazwisko, telefon, numer rejestracyjny, godzina
- **Hover state:** Pokazuje email i notatki
- **Przycisk akcji:** Check-in lub Check-out z walidacją
- **Status colors:** Kolorowe obramowanie według statusu rezerwacji

## 🔌 Integracja API

### Endpointy wykorzystywane:
1. `POST /api/rpc/get_todays_arrivals` - pobiera dzisiejsze przyjazdy
2. `POST /api/reservations/departures` - pobiera dzisiejsze wyjazdy
3. `PATCH /api/reservations?id=eq.<uuid>` - aktualizuje rezerwację (check-in/check-out)

### Automatyczne odświeżanie:
- Po każdym check-in/check-out
- Dane są automatycznie pobierane ponownie

## 🎨 Stylowanie

### Tailwind CSS
- Responsive breakpoints (sm, md, lg)
- Custom scrollbar styling
- Smooth scrolling
- Focus states dla accessibility

### Shadcn/ui components
- Button
- Card (CardContent)
- Toaster (sonner)

### Kolory akcentów:
- Zielony: Wolne miejsca, status completed
- Niebieski: Rezerwacje, status in_progress
- Pomarańczowy: Przyjazdy, status confirmed
- Fioletowy: Wyjazdy
- Czerwony: Status cancelled
- Szary: Status no_show

## ♿ Accessibility

### Zaimplementowane funkcje:
- **ARIA labels** dla przycisków i liczników
- **ARIA live regions** dla dynamicznych list
- **Role attributes** (list, listitem, alert)
- **Focus visible states** dla keyboard navigation
- **Screen reader support** z odpowiednimi aria-hidden

### Keyboard navigation:
- Tab przez wszystkie interaktywne elementy
- Enter/Space aktywuje przyciski
- Scroll za pomocą klawiszy strzałek

## 📊 Zarządzanie stanem

### Custom Hook: useDashboard
Lokalizacja: `src/hooks/useDashboard.ts`

**Zwraca:**
```typescript
{
  data: DashboardData | null;
  isLoading: boolean;
  error: Error | null;
  isProcessing: boolean;
  refetch: () => Promise<void>;
  handleCheckIn: (reservationId: string) => Promise<void>;
  handleCheckOut: (reservationId: string) => Promise<void>;
}
```

**Funkcje:**
- `fetchDashboardData()` - pobiera dane z API
- `handleCheckIn(id)` - wykonuje check-in
- `handleCheckOut(id)` - wykonuje check-out
- `calculateMetrics()` - kalkuluje metryki dashboardu

## 🔧 Walidacja

### Przycisk Check-in
- Aktywny tylko dla statusu `confirmed`
- Disabled gdy `actual_check_in !== null`
- Disabled podczas przetwarzania

### Przycisk Check-out
- Aktywny tylko dla statusu `in_progress`
- Wymaga `actual_check_in !== null`
- Disabled gdy `actual_check_out !== null`
- Disabled podczas przetwarzania

## 🚨 Obsługa błędów

### Error states:
- **ErrorState component** - wyświetlany przy błędach API
- **Toast notifications** - sukces/błąd akcji
- **Network timeouts** - obsługiwane przez fetch

### Empty states:
- **EmptyState component** - brak rezerwacji
- **Ikony** - Calendar dla pustych list

## 🔄 User flows

### Flow 1: Ładowanie dashboardu
1. Użytkownik wchodzi na stronę
2. Wyświetlane są loading skeletons
3. Dashboard pobiera dane z API
4. Wyświetlane są metryki i listy

### Flow 2: Check-in rezerwacji
1. Pracownik klika "Check-in" na karcie
2. Przycisk zmienia się na loading
3. API aktualizuje rezerwację
4. Toast sukcesu
5. Dashboard odświeża dane
6. Rezerwacja znika/zmienia status

### Flow 3: Check-out rezerwacji
1. Pracownik klika "Check-out" na karcie
2. Przycisk zmienia się na loading
3. API aktualizuje rezerwację
4. Toast sukcesu
5. Dashboard odświeża dane
6. Rezerwacja znika z listy

## 📝 Typy

Wszystkie typy zdefiniowane w `src/types.ts`:
- `DashboardMetrics`
- `DashboardData`
- `DashboardState`
- `CheckInCommand`
- `CheckOutCommand`
- `MetricCardProps`
- `ReservationCardProps`

## 🚀 Użycie

### W Astro page:
```astro
---
import Layout from "../layouts/Layout.astro";
import { DashboardContainer } from "../components/dashboard/DashboardContainer";
---

<Layout title="Dashboard - ParkTrack">
  <main class="container mx-auto p-6">
    <DashboardContainer client:load />
  </main>
</Layout>
```

### Standalone (np. w innym komponencie React):
```tsx
import { DashboardContainer } from '@/components/dashboard/DashboardContainer';

function App() {
  return <DashboardContainer />;
}
```

## 🔮 Przyszłe usprawnienia

- [ ] Real-time updates (Supabase subscriptions)
- [ ] Wyszukiwanie rezerwacji
- [ ] Bulk actions (grupowe operacje)
- [ ] Notyfikacje dla opóźnionych check-in/check-out
- [ ] Eksport danych do CSV
- [ ] Drukowanie list
- [ ] Statystyki i wykresy

## 🐛 Znane problemy

Brak znanych problemów z komponentami. Jeśli znajdziesz bug, zgłoś go do zespołu deweloperskiego.

## 📚 Dodatkowe zasoby

- [Plan implementacji](.ai/dashboard-view-implementation-plan.md)
- [API Plan](.ai/api-plan.md)
- [Dokumentacja Shadcn/ui](https://ui.shadcn.com)
- [Dokumentacja Astro](https://docs.astro.build)


