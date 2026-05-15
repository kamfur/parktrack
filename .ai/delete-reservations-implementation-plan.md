# API Endpoint Implementation Plan: DELETE /reservations

## 1. Przegląd punktu końcowego

Ten punkt końcowy jest odpowiedzialny za trwałe usunięcie istniejącej rezerwacji z systemu. Operacja jest idempotentna. Dostęp do tego punktu końcowego jest ograniczony do uwierzytelnionych użytkowników systemu.

## 2. Szczegóły żądania

- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/api/reservations`
- **Parametry**:
  - **Wymagane**:
    - `id`: `string` (UUID) - Identyfikator rezerwacji do usunięcia. Przekazywany jako parametr zapytania (query parameter), np. `/api/reservations?id=eq.f81d4fae-7dec-11d0-a765-00a0c91e6bf6`.
  - **Opcjonalne**: Brak.
- **Request Body**: Brak.

## 3. Wykorzystywane typy

Do implementacji tego punktu końcowego nie są wymagane żadne nowe typy DTO ani Command Modele. Wykorzystany zostanie istniejący typ `Reservation` z `src/types.ts` w warstwie serwisowej.

## 4. Szczegóły odpowiedzi

- **Odpowiedź sukcesu**:
  - **Kod**: `204 No Content`
  - **Treść**: Brak treści odpowiedzi.
- **Odpowiedzi błędów**:
  - **Kod**: `400 Bad Request` - Jeśli parametr `id` jest nieprawidłowy lub go brakuje.
  - **Kod**: `401 Unauthorized` - Jeśli żądanie jest wykonywane przez nieuwierzytelnionego użytkownika.
  - **Kod**: `404 Not Found` - Jeśli rezerwacja o podanym `id` nie istnieje.
  - **Kod**: `500 Internal Server Error` - W przypadku wewnętrznego błędu serwera.

## 5. Przepływ danych

1.  Żądanie `DELETE` trafia do endpointu Astro pod adresem `src/pages/api/reservations.ts`.
2.  Middleware Astro (`src/middleware/index.ts`) przechwytuje żądanie, weryfikuje sesję użytkownika za pomocą Supabase i sprawdza, czy użytkownik jest uwierzytelniony. W przypadku braku uwierzytelnienia zwraca `401 Unauthorized`.
3.  Handler `DELETE` w `src/pages/api/reservations.ts` jest wywoływany.
4.  Handler waliduje parametr zapytania `id` przy użyciu schemy Zod, aby upewnić się, że jest to poprawny UUID. W przypadku błędu walidacji zwraca `400 Bad Request`.
5.  Handler wywołuje metodę `deleteReservation(id)` z serwisu `ReservationService` (`src/lib/services/reservation.service.ts`).
6.  `ReservationService` używa klienta Supabase (`supabaseClient`) do wykonania operacji `delete()` na tabeli `reservations`, filtrując po `id`.
7.  Supabase, zgodnie ze skonfigurowanymi politykami RLS, usuwa wiersz z bazy danych.
8.  Jeśli operacja usunięcia w Supabase nie znajdzie pasującego rekordu (np. `count` jest 0), `ReservationService` zwraca informację o niepowodzeniu (np. `null` lub rzuca błąd).
9.  Handler `DELETE` na podstawie odpowiedzi z serwisu:
    - Jeśli usunięcie się powiodło, zwraca odpowiedź `204 No Content`.
    - Jeśli rezerwacja nie została znaleziona, zwraca `404 Not Found`.
10. W przypadku jakiegokolwiek innego błędu (np. błąd połączenia z bazą danych), zwracany jest `500 Internal Server Error`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Dostęp do punktu końcowego musi być chroniony. Middleware Astro zweryfikuje, czy użytkownik jest zalogowany, sprawdzając jego sesję w Supabase. Żądania od nieuwierzytelnionych użytkowników zostaną odrzucone.
- **Autoryzacja**: Polityki Row Level Security (RLS) w Supabase zapewniają, że tylko uwierzytelnieni użytkownicy mogą wykonywać operacje `DELETE` na tabeli `reservations`. Dalsze, bardziej szczegółowe reguły autoryzacji (np. oparte na rolach) nie są wymagane w MVP.
- **Walidacja danych wejściowych**: Parametr `id` musi być rygorystycznie walidowany jako UUID, aby zapobiec błędom zapytań do bazy danych i potencjalnym atakom.

## 7. Obsługa błędów

Endpoint musi obsłużyć następujące scenariusze błędów i zwrócić odpowiednie kody statusu:

| Scenariusz Błędu                            | Kod Statusu HTTP | Odpowiedź                                                              |
| ------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Brak parametru `id` w zapytaniu             | `400`            | `{ "error": "Reservation ID is required" }`                            |
| Parametr `id` nie jest poprawnym UUID       | `400`            | `{ "error": "Invalid reservation ID format" }`                         |
| Użytkownik nie jest uwierzytelniony         | `401`            | `{ "error": "Unauthorized" }`                                          |
| Rezerwacja o podanym `id` nie istnieje      | `404`            | `{ "error": "Reservation not found" }`                                 |
| Wewnętrzny błąd serwera (np. błąd Supabase) | `500`            | `{ "error": "An unexpected error occurred. Please try again later." }` |

## 8. Rozważania dotyczące wydajności

- Operacja usuwania rekordu z bazy danych po kluczu głównym (`id`) jest bardzo wydajna, ponieważ wykorzystuje indeks.
- Nie przewiduje się problemów z wydajnością dla tego punktu końcowego przy oczekiwanym obciążeniu.

## 9. Etapy wdrożenia

1.  **Modyfikacja Serwisu**:
    - W pliku `src/lib/services/reservation.service.ts` utwórz nową, asynchroniczną metodę `deleteReservation(id: string)`.
    - Metoda powinna przyjmować `id` rezerwacji jako argument.
    - Wewnątrz metody użyj `supabaseClient.from('reservations').delete().eq('id', id)` do usunięcia rezerwacji.
    - Sprawdź wynik operacji. Jeśli `error`, zaloguj go i rzuć wyjątek. Jeśli `data` jest pusta lub `count` wynosi 0, zwróć informację wskazującą, że rezerwacja nie została znaleziona (np. `return { success: false, error: 'Not Found' }`).
    - W przypadku pomyślnego usunięcia, zwróć `{ success: true }`.

2.  **Implementacja Endpointu API**:
    - W katalogu `src/pages/api/` utwórz plik `reservations.ts` (lub zmodyfikuj istniejący).
    - Dodaj `export const prerender = false;` na początku pliku.
    - Zaimplementuj funkcję `export async function DELETE({ request, locals }: APIContext)`.
    - Pobierz `id` z parametrów zapytania (`request.url`).
    - Zdefiniuj schemę walidacji Zod dla `id` (musi być to poprawny UUID).
    - Zwaliduj `id`. W przypadku błędu zwróć odpowiedź `400 Bad Request` z odpowiednim komunikatem.
    - Wywołaj metodę `reservationService.deleteReservation(id)`.
    - Na podstawie wyniku zwróconego przez serwis:
      - W przypadku sukcesu, zwróć `new Response(null, { status: 204 })`.
      - Jeśli serwis zwrócił błąd "Not Found", zwróć `new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404 })`.
      - Obsłuż inne potencjalne błędy (w bloku `try...catch`), zwracając `500 Internal Server Error`.
