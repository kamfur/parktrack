# API Endpoint Implementation Plan: Create External Reservation

## 1. Przegląd punktu końcowego

Ten dokument opisuje plan wdrożenia dla punktu końcowego `POST /api/reservations/external`. Jego celem jest umożliwienie tworzenia nowych rezerwacji parkingowych przez zewnętrzne systemy (np. publiczną stronę internetową) w sposób bezpieczny i kontrolowany. Punkt końcowy będzie odpowiedzialny za walidację danych, sprawdzanie dostępności miejsc, obliczanie kosztów i zapisywanie rezerwacji w systemie.

## 2. Szczegóły żądania

-   **Metoda HTTP:** `POST`
-   **Struktura URL:** `/api/reservations/external`
-   **Nagłówki:**
    -   `Content-Type: application/json` (wymagany)
    -   `X-API-Key: <secret_key>` (wymagany do autoryzacji)
-   **Request Body:**
    -   **Struktura:** Obiekt JSON zgodny z typem `CreateExternalReservationCommand`.
    -   **Przykład:**
        ```json
        {
          "lastName": "Smith",
          "firstName": "John",
          "email": "john.smith@web.com",
          "phone": "987654321",
          "licensePlate": "E123XYZ",
          "checkInDate": "2025-11-20T10:00:00Z",
          "checkOutDate": "2025-11-25T16:30:00Z"
        }
        ```

## 3. Wykorzystywane typy

-   **Command Model (wejście):** `CreateExternalReservationCommand` z `src/types.ts`
-   **DTO (wyjście):** `CreateExternalReservationResponseDto` z `src/types.ts`
-   **Schema walidacji:** Nowy schemat Zod oparty na `CreateExternalReservationCommand`.

## 4. Szczegóły odpowiedzi

-   **Odpowiedź sukcesu (201 Created):**
    -   **Struktura:** Obiekt JSON zgodny z typem `CreateExternalReservationResponseDto`.
    -   **Przykład:**
        ```json
        {
          "reservationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
          "message": "Reservation created successfully."
        }
        ```
-   **Odpowiedzi błędów:**
    -   **Struktura:**
        ```json
        {
          "error": {
            "message": "Szczegółowy opis błędu."
          }
        }
        ```
    -   **Kody statusu:** `400`, `403`, `409`, `500`.

## 5. Przepływ danych

1.  Żądanie `POST` trafia do endpointu Astro `src/pages/api/reservations/external.ts`.
2.  **Middleware (lub handler):** Sprawdza obecność i poprawność nagłówka `X-API-Key`. W przypadku błędu zwraca `403 Forbidden`.
3.  **Handler API:** Parsuje ciało żądania i waliduje je przy użyciu schemy Zod. W przypadku błędu walidacji zwraca `400 Bad Request`.
4.  **Handler API:** Wywołuje metodę `createExternalReservation` z nowo utworzonego `ReservationService`, przekazując zwalidowane dane.
5.  **`ReservationService`:**
    a. Wykonuje walidację biznesową (np. `checkOutDate` > `checkInDate`).
    b. Odpytuje tabelę `daily_occupancy` oraz `settings` (`total_parking_spots`), aby sprawdzić dostępność miejsc w zadanym okresie. W przypadku braku miejsc zwraca błąd, który handler przetłumaczy na `409 Conflict`.
    c. Wywołuje funkcję bazodanową `public.calculate_total_cost`, aby obliczyć `total_cost`.
    d. Mapuje dane z `CreateExternalReservationCommand` (camelCase) na strukturę tabeli `reservations` (snake_case). Ustawia `source` na `'api'`.
    e. Wywołuje `supabase.from('reservations').insert(...)`, aby zapisać nową rezerwację w jednej transakcji.
6.  **Handler API:**
    a. Po pomyślnym utworzeniu rezerwacji przez serwis, handler otrzymuje `reservationId`.
    b. (Opcjonalnie) Wywołuje `EmailService` w celu wysłania potwierdzenia.
    c. Zwraca odpowiedź `201 Created` z `reservationId` i komunikatem sukcesu.
    d. W przypadku jakiegokolwiek błędu z serwisu, łapie go i zwraca odpowiedni status HTTP (np. `500 Internal Server Error`), logując szczegóły na serwerze.

## 6. Względy bezpieczeństwa

-   **Uwierzytelnianie:** Dostęp do endpointu musi być chroniony przez statyczny klucz API przekazywany w nagłówku `X-API-Key`. Klucz powinien być przechowywany jako zmienna środowiskowa (`API_SECRET_KEY`) i porównywany w sposób bezpieczny (constant-time comparison), aby uniknąć ataków timing attacks.
-   **Autoryzacja:** Każdy, kto posiada ważny klucz API, jest autoryzowany do tworzenia rezerwacji.
-   **Walidacja danych:** Rygorystyczna walidacja za pomocą Zod na brzegu systemu jest kluczowa, aby zapobiec przetwarzaniu niepoprawnych danych i potencjalnym atakom (np. XSS, jeśli dane są gdzieś wyświetlane bez escapowania).
-   **Ochrona przed nadużyciami:** Należy zaimplementować mechanizm `rate limiting` (np. 10 żądań na minutę na adres IP), aby chronić endpoint przed atakami typu DoS. Można to osiągnąć za pomocą middleware w Astro.

## 7. Obsługa błędów

| Kod statusu         | Warunek                                                                                              | Komunikat błędu (przykład)                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `400 Bad Request`   | Błąd walidacji Zod (brakujące pole, zły typ danych).                                                 | `Invalid input: 'email' is required and must be a valid email address.` |
| `400 Bad Request`   | Naruszenie reguły biznesowej (np. data wyjazdu przed datą przyjazdu).                                | `Check-out date must be after check-in date.`                          |
| `403 Forbidden`     | Brakujący lub nieprawidłowy klucz w nagłówku `X-API-Key`.                                            | `Forbidden: Invalid or missing API key.`                               |
| `409 Conflict`      | Brak wolnych miejsc parkingowych w wybranym terminie.                                                | `No available parking spots for the selected dates.`                   |
| `500 Internal Server Error` | Błąd połączenia z bazą danych, nieoczekiwany wyjątek w logice serwisu, błąd wysyłki e-maila. | `An unexpected error occurred. Please try again later.`                |

Wszystkie błędy po stronie serwera (5xx) muszą być logowane z pełnym stosem wywołań w celu ułatwienia debugowania.

## 8. Rozważania dotyczące wydajności

-   **Zapytania do bazy danych:** Logika sprawdzania dostępności miejsc będzie wymagała zapytania do tabeli `daily_occupancy`. Należy upewnić się, że kolumna `date` jest zindeksowana.
-   **Transakcyjność:** Operacje sprawdzania dostępności i wstawiania rezerwacji powinny idealnie odbywać się w ramach jednej transakcji bazodanowej, aby zapewnić spójność danych. W tym przypadku, ze względu na oddzielne kroki, należy najpierw sprawdzić dostępność, a następnie wstawić rezerwację.
-   **Zimny start:** Jeśli endpoint jest hostowany w środowisku serverless (np. Vercel, Supabase Edge Functions), należy wziąć pod uwagę potencjalne opóźnienie przy pierwszym wywołaniu (cold start).

## 9. Etapy wdrożenia

1.  **Struktura plików:**
    -   Utwórz plik `src/pages/api/reservations/external.ts` dla handlera API.
    -   Utwórz plik `src/lib/services/reservation.service.ts` dla logiki biznesowej.
    -   Utwórz plik `src/lib/schemas/reservation.schema.ts` dla schemy walidacji Zod.

2.  **Schema Walidacji:**
    -   W `reservation.schema.ts`, zdefiniuj schemę Zod `createExternalReservationSchema`, która będzie walidować ciało żądania zgodnie z `CreateExternalReservationCommand`. Dodaj regułę `.refine()` sprawdzającą, czy `checkOutDate` jest późniejszy niż `checkInDate`.

3.  **Serwis:**
    -   W `reservation.service.ts`, zaimplementuj klasę `ReservationService` z metodą `createExternalReservation`.
    -   Zaimplementuj logikę sprawdzania dostępności miejsc (overbooking).
    -   Zaimplementuj logikę wywołania funkcji `calculate_total_cost` z Supabase.
    -   Zaimplementuj logikę zapisu nowej rezerwacji do bazy danych.

4.  **Handler API:**
    -   W `external.ts`, zaimplementuj handler dla metody `POST`.
    -   Dodaj logikę weryfikacji klucza API z nagłówka `X-API-Key` (wartość z `import.meta.env.API_SECRET_KEY`).
    -   Użyj `createExternalReservationSchema` do walidacji `Astro.request.json()`.
    -   Zainicjuj `ReservationService` i wywołaj metodę `createExternalReservation`.
    -   Zaimplementuj obsługę błędów `try...catch`, mapując błędy na odpowiednie odpowiedzi HTTP.
    -   Zwróć odpowiedź `201` w przypadku sukcesu.

5.  **Zmienne Środowiskowe:**
    -   Dodaj `API_SECRET_KEY` do pliku `.env` i `env.d.ts`.

6.  **Testowanie:**
    -   Napisz testy jednostkowe dla `ReservationService`, mockując klienta Supabase.
    -   Napisz testy integracyjne dla endpointu API, sprawdzając wszystkie ścieżki (sukces, błędy walidacji, błąd autoryzacji, overbooking).

7.  **Dokumentacja:**
    -   Upewnij się, że zmiany są odzwierciedlone w dokumentacji API (np. w pliku `.ai/api-plan.md` lub w systemie typu Swagger/OpenAPI, jeśli będzie używany w przyszłości).
