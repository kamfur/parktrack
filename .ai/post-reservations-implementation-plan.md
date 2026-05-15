# API Endpoint Implementation Plan: POST /api/reservations

## 1. Przegląd punktu końcowego

Ten punkt końcowy umożliwia tworzenie nowych rezerwacji parkingowych w systemie. Jest przeznaczony do użytku wewnętrznego przez personel (np. przyjmowanie rezerwacji telefonicznych lub od klientów na miejscu). Endpoint ten jest kluczowym elementem operacyjnym, który bezpośrednio wpływa na zarządzanie obłożeniem parkingu.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/api/reservations`
- **Request Body**: Obiekt JSON z danymi nowej rezerwacji.

  ```json
  {
    "last_name": "Kowalski",
    "first_name": "Jan", // Opcjonalne
    "email": "jan.kowalski@example.com", // Opcjonalne
    "phone": "123456789", // Opcjonalne
    "planned_check_in": "2025-12-20T10:00:00Z",
    "planned_check_out": "2025-12-24T18:00:00Z",
    "source": "phone",
    "total_cost": 250.5,
    "license_plate": "WX12345", // Opcjonalne
    "notes": "Klient prosi o miejsce blisko wyjazdu." // Opcjonalne
  }
  ```

- **Parametry**:
  - **Wymagane**:
    - `last_name` (string)
    - `planned_check_in` (string, format ISO 8601)
    - `planned_check_out` (string, format ISO 8601)
    - `source` (enum: "phone", "walk_in", "api")
    - `total_cost` (number)
  - **Opcjonalne**:
    - `first_name` (string)
    - `email` (string, format email)
    - `phone` (string)
    - `license_plate` (string)
    - `notes` (string)
    - `flight_direction` (enum: "departure", "arrival")

## 3. Wykorzystywane typy

- **Command Model (wejściowy)**: `CreateReservationCommand` (z `src/types.ts`). Ten typ określa, które pola są akceptowane w żądaniu.
- **DTO (wyjściowy)**: `ReservationDto` (z `src/types.ts`). Ten typ, będący aliasem dla encji `Reservation`, będzie używany jako struktura danych w pomyślnej odpowiedzi.
- **Schemat walidacji Zod**: `CreateReservationSchema`. Nowy schemat do zdefiniowania, który zapewni walidację typów, formatu i wymaganych pól dla danych wejściowych, zgodnie z `CreateReservationCommand`.

## 4. Przepływ danych

1.  Klient (aplikacja front-endowa) wysyła żądanie `POST` na adres `/api/reservations` z obiektem rezerwacji w ciele żądania.
2.  Middleware Astro (`src/middleware/index.ts`) weryfikuje token JWT i uwierzytelnia użytkownika, udostępniając jego sesję w `Astro.locals`.
3.  Handler endpointu w `src/pages/api/reservations.ts` zostaje wywołany.
4.  Handler sprawdza, czy `Astro.locals.user` istnieje. Jeśli nie, zwraca `401 Unauthorized`.
5.  Handler weryfikuje, czy uwierzytelniony użytkownik ma odpowiednią rolę (np. `staff`). Jeśli nie, zwraca `403 Forbidden`.
6.  Dane z ciała żądania są walidowane przy użyciu schematu `CreateReservationSchema` (Zod). W przypadku błędu walidacji, zwracany jest `400 Bad Request` ze szczegółami błędów.
7.  Handler wywołuje metodę `createReservation` z nowo utworzonego `ReservationService` (`src/lib/services/reservation.service.ts`), przekazując zwalidowane dane oraz ID użytkownika z `Astro.locals.user.id`.
8.  `ReservationService` konstruuje obiekt `Insert` dla tabeli `reservations`, dodając pola `created_by` i `last_modified_by` z ID użytkownika.
9.  Serwis używa klienta Supabase (`Astro.locals.supabase`) do wykonania operacji `insert` na tabeli `reservations`.
10. Baza danych przetwarza żądanie. W przypadku konfliktu (np. logika overbooking), zwraca błąd.
11. `ReservationService` przechwytuje wynik operacji na bazie danych. W przypadku błędu rzuca wyjątek, który jest obsługiwany w handlerze.
12. Po pomyślnym utworzeniu rezerwacji, serwis zwraca pełny obiekt nowej rezerwacji.
13. Handler endpointu formatuje odpowiedź, ustawiając status `201 Created` i zwracając obiekt rezerwacji (jako `ReservationDto`) w ciele odpowiedzi.

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być chroniony i dostępny tylko dla zalogowanych użytkowników. Middleware Astro będzie odpowiedzialne za weryfikację sesji Supabase.
- **Autoryzacja**: Dostęp powinien być ograniczony do użytkowników z rolą personelu (np. `staff` lub `admin`). Należy zaimplementować sprawdzanie roli w handlerze API, ponieważ obecna polityka RLS pozwala na zapis każdememu zalogowanemu użytkownikowi.
- **Walidacja danych wejściowych**: Wszystkie dane wejściowe muszą być rygorystycznie walidowane za pomocą Zod, aby zapobiec niepoprawnym danym i potencjalnym atakom (np. XSS w polu `notes`).
- **Ochrona przed SQL Injection**: Użycie klienta `supabase-js` z `Astro.locals.supabase` zapewnia parametryzację zapytań, co skutecznie chroni przed atakami typu SQL Injection.
- **Zarządzanie uprawnieniami**: Operacje na bazie danych będą wykonywane w kontekście uwierzytelnionego użytkownika, co pozwala na audytowanie zmian (`created_by`, `last_modified_by`).

## 6. Obsługa błędów

| Kod statusu          | Sytuacja                                                                                                 | Ciało odpowiedzi (przykład)                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `400 Bad Request`    | Błąd walidacji danych wejściowych (brakujące pole, zły format daty, niepoprawny email itp.).             | `{ "error": "Validation failed", "details": "[...]" }`             |
| `401 Unauthorized`   | Użytkownik nie jest zalogowany (brak lub nieważny token JWT).                                            | `{ "error": "User is not authenticated" }`                         |
| `403 Forbidden`      | Użytkownik jest zalogowany, ale nie ma uprawnień do tworzenia rezerwacji (np. brak roli `staff`).        | `{ "error": "User is not authorized to perform this action" }`     |
| `409 Conflict`       | Naruszenie ograniczeń bazy danych, np. próba rezerwacji w pełni obłożonym terminie (logika overbooking). | `{ "error": "Overbooking conflict or data constraint violation" }` |
| `500 Internal Error` | Błąd serwera, problem z połączeniem do bazy danych lub inny nieoczekiwany wyjątek.                       | `{ "error": "An unexpected error occurred" }`                      |

## 7. Rozważania dotyczące wydajności

- Operacja `INSERT` na tabeli `reservations` jest z natury szybka.
- Potencjalnym wąskim gardłem w przyszłości może stać się logika sprawdzająca obłożenie (overbooking), która może wymagać złożonych zapytań do tabeli `daily_occupancy` lub `reservations`. Należy zapewnić, że odpowiednie kolumny (szczególnie `planned_check_in` i `planned_check_out`) są zindeksowane.
- Na obecnym etapie nie przewiduje się problemów z wydajnością.

## 8. Etapy wdrożenia

1.  **Definicja schematu walidacji**:
    - Utwórz nowy plik `src/lib/validation/reservationSchemas.ts`.
    - Zdefiniuj w nim `CreateReservationSchema` przy użyciu Zod, który będzie walidował obiekt zgodny z `CreateReservationCommand`. Uwzględnij sprawdzanie typów, wymaganych pól i warunku `planned_check_out > planned_check_in`.

2.  **Stworzenie serwisu**:
    - Utwórz nowy plik `src/lib/services/reservation.service.ts`.
    - Zaimplementuj klasę `ReservationService` z publiczną, statyczną metodą asynchroniczną `createReservation`.
    - Metoda powinna przyjmować dwa argumenty: `command: CreateReservationCommand` i `userId: string`.
    - Wewnątrz metody, użyj przekazanego klienta Supabase do wstawienia nowego rekordu do tabeli `reservations`, pamiętając o dodaniu `created_by: userId` i `last_modified_by: userId`.
    - Metoda powinna zwracać nowo utworzony obiekt rezerwacji lub rzucać błąd w przypadku niepowodzenia.

3.  **Implementacja endpointu API**:
    - Utwórz plik `src/pages/api/reservations.ts`.
    - Dodaj `export const prerender = false;`.
    - Zaimplementuj handler `POST` jako funkcję asynchroniczną `POST({ request, locals }: APIContext)`.
    - W handlerze, wykonaj kroki z sekcji "Przepływ danych":
      - Sprawdź uwierzytelnienie (`locals.user`).
      - Sprawdź autoryzację (rola użytkownika, jeśli jest dostępna).
      - Pobierz ciało żądania (`request.json()`).
      - Zwaliduj ciało przy użyciu `CreateReservationSchema.safeParse()`.
      - Wywołaj `ReservationService.createReservation()` z poprawnymi danymi.
      - Zaimplementuj bloki `try...catch` do obsługi błędów z serwisu i bazy danych, zwracając odpowiednie kody statusu HTTP.
      - W przypadku sukcesu, zwróć odpowiedź JSON z kodem `201` i utworzonym obiektem rezerwacji.

4.  **Testowanie**:
    - Dodaj testy jednostkowe dla `ReservationService`, mockując klienta Supabase.
    - Dodaj testy integracyjne dla endpointu API, symulując żądania HTTP i sprawdzając odpowiedzi dla różnych scenariuszy (sukces, błędy walidacji, brak autoryzacji).
