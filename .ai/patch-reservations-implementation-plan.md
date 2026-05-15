# API Endpoint Implementation Plan: PATCH /api/reservations

## 1. Przegląd punktu końcowego

Ten punkt końcowy umożliwia aktualizację istniejącej rezerwacji parkingowej. Jest przeznaczony do obsługi operacji takich jak check-in, check-out, czy zmiana numeru rejestracyjnego pojazdu. Punkt końcowy wymaga identyfikatora rezerwacji jako parametru zapytania i przyjmuje częściowe dane rezerwacji w ciele żądania.

## 2. Szczegóły żądania

- **Metoda HTTP**: `PATCH`
- **Struktura URL**: `/api/reservations?id=eq.<uuid>`
- **Parametry**:
  - Wymagane: `id` (string, format UUID) - identyfikator rezerwacji.
- **Request Body**: Obiekt JSON zawierający pola do zaktualizowania. Wszystkie pola są opcjonalne.
  ```json
  {
    "status": "in_progress",
    "actual_check_in": "2025-11-10T14:05:12Z",
    "license_plate": "WZ54321"
  }
  ```

## 3. Wykorzystywane typy

- **`UpdateReservationDto`**: Schema Zod do walidacji ciała żądania. Będzie to `partial` wersja istniejącej schemy `ReservationSchema`, aby umożliwić częściową aktualizację.
- **`Reservation`**: Typ reprezentujący obiekt rezerwacji, zgodny ze schemą bazy danych. Zostanie użyty w odpowiedzi na żądanie.

## 4. Szczegóły odpowiedzi

- **Sukces (Success)**:
  - **Kod**: `200 OK`
  - **Payload**: Pełny, zaktualizowany obiekt rezerwacji.
- **Błędy (Errors)**:
  - **Kod**: `400 Bad Request` - Nieprawidłowe dane wejściowe (np. błąd walidacji, nieprawidłowy format UUID).
  - **Kod**: `401 Unauthorized` - Brak uwierzytelnienia.
  - **Kod**: `404 Not Found` - Rezerwacja o podanym ID nie została znaleziona.
  - **Kod**: `500 Internal Server Error` - Wewnętrzny błąd serwera.

## 5. Przepływ danych

1.  Żądanie `PATCH` trafia do endpointu Astro `/api/reservations`.
2.  Middleware weryfikuje uwierzytelnienie i autoryzację użytkownika.
3.  Handler API odczytuje `id` z parametrów URL i waliduje jego format.
4.  Ciało żądania jest parsowane i walidowane przy użyciu schemy `UpdateReservationDto` (Zod).
5.  Jeśli walidacja się powiedzie, wywoływana jest metoda `ReservationService.updateReservation(id, validatedData)`.
6.  Serwis wykonuje operację `UPDATE` na tabeli `reservations` w bazie Supabase.
7.  Jeśli aktualizacja w bazie danych powiedzie się, serwis zwraca zaktualizowany obiekt rezerwacji.
8.  Handler API serializuje obiekt rezerwacji do formatu JSON i wysyła go w odpowiedzi ze statusem `200 OK`.
9.  W przypadku błędu na którymkolwiek etapie, odpowiedni kod statusu i komunikat błędu są zwracane do klienta.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie i Autoryzacja**: Dostęp do punktu końcowego musi być ograniczony do uwierzytelnionych użytkowników z odpowiednimi uprawnieniami (np. rola 'admin' lub 'staff'). Należy to zaimplementować w middleware Astro, sprawdzając sesję użytkownika z `context.locals.supabase`.
- **Walidacja danych**: Wszystkie dane wejściowe (parametry URL i ciało żądania) muszą być rygorystycznie walidowane przy użyciu Zod, aby zapobiec atakom typu Mass Assignment i zapewnić spójność danych.
- **Dostęp do zasobów**: Należy upewnić się, że operacje na bazie danych są wykonywane w kontekście zasad bezpieczeństwa Supabase (Row Level Security), jeśli są zdefiniowane.

## 7. Rozważania dotyczące wydajności

- **Indeksowanie bazy danych**: Kolumna `id` w tabeli `reservations` powinna być kluczem głównym, co zapewnia szybkie wyszukiwanie.
- **Rozmiar payloadu**: Zarówno żądanie, jak i odpowiedź mają niewielki rozmiar, więc nie przewiduje się problemów z wydajnością sieci.
- **Liczba zapytań do bazy danych**: Implementacja powinna dążyć do wykonania pojedynczego zapytania `UPDATE` do bazy danych na jedno żądanie API.

## 8. Etapy wdrożenia

1.  **Aktualizacja schemy walidacji**: W pliku `src/lib/schemas/reservation.schema.ts`, zdefiniować nową schemę `UpdateReservationSchema` używając `ReservationSchema.partial()`.
2.  **Rozszerzenie serwisu**: W `src/lib/services/reservation.service.ts`, dodać nową metodę `updateReservation`, która przyjmuje `id` i dane do aktualizacji, a następnie wykonuje zapytanie do Supabase.
3.  **Implementacja endpointu API**: Utworzyć plik `src/pages/api/reservations/index.ts` (lub zmodyfikować istniejący) i zaimplementować w nim handler dla metody `PATCH`.
4.  **Integracja walidacji**: W handlerze `PATCH`, zintegrować walidację parametru `id` oraz ciała żądania przy użyciu zdefiniowanej schemy Zod.
5.  **Integracja z serwisem**: Wywołać metodę `reservationService.updateReservation` z poprawnymi danymi.
6.  **Obsługa odpowiedzi i błędów**: Zaimplementować logikę zwracania poprawnej odpowiedzi w przypadku sukcesu (obiekt rezerwacji, status 200) oraz odpowiednich kodów błędów i komunikatów w przypadku niepowodzenia.
7.  **Zabezpieczenie endpointu**: Upewnić się, że middleware Astro poprawnie zabezpiecza endpoint, sprawdzając sesję i uprawnienia użytkownika.
8.  **Testowanie**: Przygotować i przeprowadzić testy jednostkowe dla logiki serwisowej oraz testy integracyjne dla całego endpointu, uwzględniając przypadki sukcesu i błędów.
