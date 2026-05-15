# API Endpoint Implementation Plan: POST /rpc/get_todays_arrivals

## 1. Przegląd punktu końcowego

Ten punkt końcowy jest odpowiedzialny za pobieranie listy wszystkich rezerwacji, dla których planowana data zameldowania (`planned_check_in`) przypada na bieżący dzień. Zwrócone dane będą posortowane chronologicznie według godziny zameldowania. Endpoint jest przeznaczony do użytku wewnętrznego w panelu administracyjnym.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/api/rpc/get_todays_arrivals`
- **Parametry**:
  - **Wymagane**: Brak
  - **Opcjonalne**: Brak
- **Request Body**: Puste

## 3. Wykorzystywane typy

- **Odpowiedź**: `ReservationDto[]`
  - Typ `ReservationDto` jest zdefiniowany w `src/types.ts` i odpowiada strukturze rekordu w tabeli `reservations`.

## 4. Szczegóły odpowiedzi

- **Odpowiedź sukcesu (200 OK)**:
  ```json
  [
    {
      "id": "uuid",
      "last_name": "Kowalski",
      "first_name": "Jan",
      "email": "jan.kowalski@example.com",
      "phone": "123456789",
      "license_plate": "WX12345",
      "planned_check_in": "2024-10-28T09:00:00.000Z",
      "planned_check_out": "2024-11-03T18:00:00.000Z",
      "status": "confirmed"
      // ...pozostałe pola
    }
  ]
  ```
- **Odpowiedź błędu**:
  ```json
  {
    "message": "Komunikat o błędzie"
  }
  ```

## 5. Przepływ danych

1.  Klient (przeglądarka) wysyła żądanie `POST` na adres `/api/rpc/get_todays_arrivals`.
2.  Middleware w Astro weryfikuje, czy użytkownik jest uwierzytelniony na podstawie sesji Supabase. Jeśli nie, zwraca błąd `401 Unauthorized`.
3.  Handler endpointu w `src/pages/api/rpc/get_todays_arrivals.ts` jest wywoływany.
4.  Handler wywołuje metodę `getTodaysArrivals` z serwisu `ReservationsService`, przekazując do niej instancję klienta Supabase (`Astro.locals.supabase`).
5.  Serwis `ReservationsService` wywołuje funkcję RPC `get_todays_arrivals` w bazie danych PostgreSQL poprzez klienta Supabase.
6.  Funkcja w bazie danych wykonuje zapytanie `SELECT` na tabeli `reservations`, filtrując wyniki, gdzie data `planned_check_in` jest równa bieżącej dacie. Wyniki są sortowane rosnąco po `planned_check_in`.
7.  Baza danych zwraca listę rezerwacji do serwisu.
8.  Serwis zwraca dane do handlera API.
9.  Handler API formatuje odpowiedź jako JSON i wysyła ją do klienta z kodem statusu `200 OK`.
10. W przypadku błędu na którymkolwiek etapie (np. błąd bazy danych), handler przechwytuje wyjątek, loguje go i zwraca odpowiedź z kodem `500 Internal Server Error`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Dostęp do endpointu musi być ograniczony wyłącznie do uwierzytelnionych użytkowników. Należy to zaimplementować w middleware Astro, sprawdzając aktywną sesję użytkownika Supabase.
- **Autoryzacja**: Na obecnym etapie (MVP), polityka RLS w Supabase zezwala na dostęp wszystkim uwierzytelnionym użytkownikom. W przyszłości należy rozważyć wprowadzenie ról (np. `staff`, `admin`) i zaostrzenie polityk RLS, aby tylko uprawniony personel miał dostęp do tych danych.
- **Walidacja**: Ponieważ endpoint nie przyjmuje żadnych danych wejściowych, walidacja po stronie serwera nie jest wymagana.

## 7. Rozważania dotyczące wydajności

- **Indeksowanie**: Kluczowe jest, aby kolumna `planned_check_in` w tabeli `reservations` była zaindeksowana. Zapewni to wysoką wydajność zapytań filtrujących po tej dacie.
- **Paginacja**: Dla MVP paginacja nie jest wymagana, ponieważ dzienna liczba przyjazdów powinna być relatywnie niewielka. Jeśli w przyszłości liczba ta znacząco wzrośnie, należy rozważyć dodanie paginacji do odpowiedzi.
- **Ilość danych**: Zapytanie powinno zwracać tylko te kolumny, które są niezbędne dla klienta, aby zminimalizować transfer danych.

## 8. Etapy wdrożenia

1.  **Baza danych**:
    - Utworzyć nową funkcję PostgreSQL `get_todays_arrivals()` w schemacie `public`.
    - Funkcja powinna zwracać zbiór rekordów z tabeli `reservations`.
    - Logika funkcji:
      ```sql
      CREATE OR REPLACE FUNCTION public.get_todays_arrivals()
      RETURNS SETOF reservations AS $$
      BEGIN
        RETURN QUERY
        SELECT *
        FROM public.reservations
        WHERE DATE(planned_check_in) = CURRENT_DATE
        ORDER BY planned_check_in ASC;
      END;
      $$ LANGUAGE plpgsql;
      ```

2.  **Serwis**:
    - Utworzyć plik `src/lib/services/reservations.service.ts`, jeśli jeszcze nie istnieje.
    - Dodać nową, asynchroniczną metodę `getTodaysArrivals(supabase: SupabaseClient)`.
    - Wewnątrz metody wywołać RPC do funkcji `get_todays_arrivals` używając `supabase.rpc('get_todays_arrivals')`.
    - Obsłużyć potencjalne błędy i rzucić wyjątek w przypadku niepowodzenia.
    - Metoda powinna zwracać `Promise<ReservationDto[]>`.

3.  **Endpoint API**:
    - Utworzyć plik `src/pages/api/rpc/get_todays_arrivals.ts`.
    - Dodać `export const prerender = false;`
    - Zaimplementować handler `POST({ locals }: APIContext)`.
    - Wewnątrz handlera:
      - Pobrać klienta Supabase z `locals.supabase`.
      - Wywołać `reservationsService.getTodaysArrivals(supabase)`.
      - Zwrócić dane w formacie `Response` z kodem `200 OK`.
      - Dodać blok `try...catch` do obsługi błędów i zwracania odpowiedzi z kodem `500 Internal Server Error`.

4.  **Middleware (weryfikacja)**:
    - Upewnić się, że middleware w `src/middleware/index.ts` poprawnie chroni ścieżki `/api/*` i przekierowuje niezalogowanych użytkowników lub zwraca błąd `401`.

5.  **Testowanie**:
    - Dodać testy jednostkowe dla serwisu `ReservationsService`, mockując klienta Supabase.
    - Dodać test integracyjny dla endpointu API, który weryfikuje poprawność odpowiedzi dla uwierzytelnionego użytkownika.
