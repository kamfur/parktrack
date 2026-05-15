# API Endpoint Implementation Plan: `POST /api/reservations/departures`

## 1. Przegląd punktu końcowego

Ten punkt końcowy jest odpowiedzialny za pobieranie listy wszystkich rezerwacji, dla których planowana data wymeldowania (`checkOutDate`) przypada na bieżący dzień. Jest przeznaczony do użytku wewnętrznego przez personel w celu monitorowania codziennych wymeldowań.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/api/reservations/departures`
- **Parametry**:
  - **Wymagane**: Brak
  - **Opcjonalne**: Brak
- **Request Body**: Brak (puste ciało żądania)

## 3. Wykorzystywane typy

- **DTO**: `Reservation[]`
  - Typ `Reservation` jest zdefiniowany w `src/types.ts` i będzie używany do strukturyzacji danych w odpowiedzi.

## 4. Szczegóły odpowiedzi

- **Odpowiedź sukcesu (Success Response)**:
  - **Kod**: `200 OK`
  - **Payload**: Tablica obiektów rezerwacji (`Reservation[]`). Jeśli żadne rezerwacje nie spełniają kryteriów, zwrócona zostanie pusta tablica.
  ```json
  [
    {
      "id": "uuid",
      "guestName": "string",
      "checkInDate": "date",
      "checkOutDate": "date",
      "vehiclePlate": "string",
      "parkingSpotId": "uuid",
      "status": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
  ```
- **Odpowiedzi błędu (Error Responses)**:
  - **Kod**: `401 Unauthorized` - gdy użytkownik nie jest uwierzytelniony.
  - **Kod**: `500 Internal Server Error` - w przypadku problemów z serwerem lub bazą danych.

## 5. Przepływ danych

1. Klient (np. aplikacja front-endowa) wysyła żądanie `POST` na adres `/api/reservations/departures`.
2. Middleware Astro weryfikuje sesję użytkownika. Jeśli jest nieprawidłowa, zwraca błąd `401`.
3. Handler w pliku `src/pages/api/reservations/departures.ts` odbiera żądanie.
4. Handler wywołuje metodę `getTodaysDepartures` z `ReservationService`, przekazując do niej instancję klienta Supabase (`Astro.locals.supabase`).
5. `ReservationService` wykonuje wywołanie RPC `get_todays_departures` do bazy danych Supabase.
6. Funkcja RPC w bazie danych filtruje rezerwacje, wybierając te, których `checkOutDate` jest równe dzisiejszej dacie, i sortuje je chronologicznie.
7. Baza danych zwraca listę pasujących rezerwacji do `ReservationService`.
8. Serwis zwraca dane do handlera API.
9. Handler API formatuje odpowiedź jako JSON i wysyła ją do klienta z kodem statusu `200 OK`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Dostęp do tego punktu końcowego musi być ograniczony tylko do uwierzytelnionych użytkowników. Middleware (`src/middleware/index.ts`) będzie odpowiedzialne za weryfikację tokenu sesji i w razie potrzeby odświeżenie go.
- **Autoryzacja**: Należy upewnić się, że tylko użytkownicy z odpowiednimi uprawnieniami (np. rola `admin` lub `staff`) mogą uzyskać dostęp do tych danych. Można to zaimplementować na poziomie polityk RLS (Row Level Security) w Supabase dla funkcji `get_todays_departures`.
- **Walidacja wejścia**: Ponieważ punkt końcowy nie przyjmuje żadnych parametrów, walidacja danych wejściowych nie jest wymagana.

## 7. Obsługa błędów

- **Brak uwierzytelnienia**: Jeśli middleware nie znajdzie prawidłowej sesji, żądanie zostanie przerwane, a do klienta zostanie wysłana odpowiedź z kodem `401 Unauthorized`.
- **Błędy bazy danych**: Wszelkie błędy zwrócone przez Supabase podczas wywołania RPC zostaną przechwycone w bloku `try...catch` w `ReservationService`. Błąd zostanie zalogowany na serwerze (`console.error`), a do klienta zostanie zwrócona odpowiedź z kodem `500 Internal Server Error` i ogólnym komunikatem o błędzie.

## 8. Rozważania dotyczące wydajności

- **Indeksowanie bazy danych**: Kolumna `checkOutDate` w tabeli `reservations` powinna być zindeksowana, aby zapewnić szybkie wyszukiwanie i filtrowanie danych, zwłaszcza przy dużej liczbie rezerwacji.
- **Paginacja**: W obecnej wersji punkt końcowy zwraca wszystkie pasujące rezerwacje. Jeśli liczba wymeldowań w ciągu jednego dnia może być bardzo duża, w przyszłości należy rozważyć implementację paginacji.

## 9. Etapy wdrożenia

1. **Baza danych**:
   - Utwórz nową funkcję RPC w PostgreSQL o nazwie `get_todays_departures()`, która zwraca `SETOF reservations`.
   - Funkcja powinna filtrować rezerwacje, gdzie `checkOutDate` jest równe `CURRENT_DATE`, i sortować wyniki.
   - Upewnij się, że na kolumnie `checkOutDate` w tabeli `reservations` istnieje indeks.
   - Zdefiniuj polityki RLS dla funkcji, aby ograniczyć dostęp tylko do autoryzowanych ról.
2. **Serwis (`ReservationService`)**:
   - W pliku `src/lib/services/reservation.service.ts` dodaj nową asynchroniczną metodę `getTodaysDepartures(supabase: SupabaseClient)`.
   - Wewnątrz metody wywołaj funkcję RPC `get_todays_departures` za pomocą `supabase.rpc()`.
   - Zaimplementuj obsługę błędów przy użyciu bloku `try...catch`.
3. **API Route**:
   - Utwórz nowy plik `src/pages/api/reservations/departures.ts`.
   - Dodaj `export const prerender = false;`.
   - Zaimplementuj handler `POST({ locals })`, który będzie korzystał z `Astro.locals.supabase`.
   - Wywołaj metodę `ReservationService.getTodaysDepartures()` i zwróć wynik jako odpowiedź JSON ze statusem `200 OK` lub odpowiedni błąd w przypadku niepowodzenia.
4. **Typy**:
   - Upewnij się, że typ `Reservation` w `src/types.ts` jest aktualny i odpowiada strukturze tabeli `reservations`.
5. **Testowanie**:
   - Utwórz testy jednostkowe dla `ReservationService`.
   - Przeprowadź testy integracyjne dla punktu końcowego API, sprawdzając scenariusze pomyślne oraz obsługę błędów (brak autoryzacji, błędy serwera).
