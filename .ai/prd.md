# Product Requirements Document (PRD) - MVP

## Decyzje Projektowe

1.  **Zakres MVP:** Aplikacja w pierwszej wersji będzie przeznaczona wyłącznie dla obsługi parkingu, bez modułu dla kierowców.
2.  **Model Biznesowy:** Aplikacja będzie darmowa w wersji MVP, z planem wprowadzenia płatnego modelu subskrypcyjnego w przyszłości.
3.  **Platforma:** Produkt zostanie wdrożony jako responsywna aplikacja webowa (RWD), zapewniając dostępność na różnych urządzeniach (komputer, tablet, telefon).
4.  **Zarządzanie Rezerwacjami:** Rezerwacje obejmują wyłącznie pełne doby. Płatności realizowane są tylko na miejscu. System musi uniemożliwiać rezerwację (overbooking), gdy parking jest pełny.
5.  **Obsługa Klienta:** Procesy przyjazdu i wyjazdu będą obsługiwane manualnie przez pracowników. Identyfikacja rezerwacji odbywa się poprzez dedykowane, sortowane listy przyjazdów i wyjazdów.
6.  **API:** Zostanie udostępniony punkt końcowy API wyłącznie do tworzenia rezerwacji z zewnętrznego źródła (strony WWW). API nie będzie udostępniać informacji o dostępności.
7.  **Raportowanie:** MVP będzie zawierać raport obłożenia w formie widoku kalendarza oraz podstawowe dane o liczbie przyjazdów i wyjazdów.
8.  **Powiadomienia:** System będzie automatycznie wysyłał e-mail z potwierdzeniem utworzenia rezerwacji.
9.  **Dane:** Minimalny zestaw danych do szybkiej rezerwacji to nazwisko oraz daty. Dane klientów będą przechowywane przez miesiąc po zakończeniu rezerwacji.
10. **Uprawnienia:** W MVP będzie istniał tylko jeden, pełny poziom dostępu dla wszystkich pracowników obsługi.

## Rekomendacje Zaakceptowane

1.  **Platforma RWD:** Zalecono stworzenie responsywnej aplikacji webowej jako najbardziej efektywnego kosztowo sposobu na zapewnienie dostępności na wielu urządzeniach, co zostało zaakceptowane.
2.  **Blokada Overbookingu:** Zalecono wdrożenie twardej blokady uniemożliwiającej rezerwację przy braku miejsc, co zostało potwierdzone jako kluczowe wymaganie.
3.  **Minimalizacja Danych:** Sugestia, aby zdefiniować minimalny zestaw pól wymaganych do szybkiego tworzenia rezerwacji telefonicznych, została zaakceptowana (nazwisko i daty).
4.  **Automatyczne Powiadomienia:** Rekomendacja wdrożenia automatycznego e-maila z potwierdzeniem rezerwacji została uznana za wystarczającą dla MVP.
5.  **Intuicyjne Raporty:** Zalecono użycie widoku kalendarza dla raportu obłożenia jako najbardziej intuicyjnej formy prezentacji danych, co zostało wybrane przez użytkownika.
6.  **Polityka Danych (RODO):** Zalecono wdrożenie polityki retencji danych, co zostało określone jako przechowywanie danych przez 1 miesiąc po wyjeździe klienta.
7.  **Priorytet na Prostotę:** Rekomendacja, aby w MVP skupić się na liczniku wolnych miejsc zamiast na złożonej, graficznej mapie parkingu, została zaakceptowana.
8.  **Plan na Przyszłość:** Sugestia, aby od początku zdefiniować przyszły model biznesowy (subskrypcja), została potwierdzona, co pozwala na tworzenie produktu z jasną wizją rozwoju.

## Podsumowanie Planowania PRD

### Główne Wymagania Funkcjonalne

#### Moduł Zarządzania Rezerwacjami
- Tworzenie nowej rezerwacji przez obsługę (szybka ścieżka: nazwisko, daty; pełna: Imię, nazwisko, nr rej., e-mail, telefon, kierunek lotu)
- Wyszukiwanie, edycja i anulowanie istniejących rezerwacji
- Możliwość oznaczenia rezerwacji jako "nie zrealizowana" (no-show)

#### Moduł Obsługi Parkingu
- Osobne widoki "Dzisiejsze Przyjazdy" i "Dzisiejsze Wyjazdy", sortowane chronologicznie
- Funkcja "Check-in": zmiana statusu rezerwacji na "W realizacji" i umieszczenie jej na liście stanu parkingu
- Funkcja "Check-out": zmiana statusu rezerwacji na "Zakończona" i przeniesienie jej do archiwum

#### Moduł Raportów
- Wizualny kalendarz obłożenia parkingu
- Podstawowe statystyki dobowe: liczba przyjazdów i wyjazdów

#### API
- Pojedynczy endpoint `POST /reservations` do przyjmowania nowych rezerwacji z systemów zewnętrznych

#### Powiadomienia
- Automatyczna wysyłka e-maila z potwierdzeniem po pomyślnym utworzeniu rezerwacji

### Kluczowe Historie Użytkownika

1. **Tworzenie rezerwacji telefonicznej**
   - Pracownik odbiera telefon
   - Otwiera formularz "Nowa rezerwacja"
   - Wprowadza nazwisko oraz datę przyjazdu i wyjazdu
   - Zapisuje rezerwację
   - Resztę danych uzupełnia przy przyjeździe klienta

2. **Obsługa przyjazdu klienta**
   - Pracownik otwiera widok "Dzisiejsze Przyjazdy"
   - Odnajduje rezerwację na liście (po godzinie lub nazwisku)
   - Klika "Przyjazd", co potwierdza zajęcie miejsca na parkingu

3. **Obsługa wyjazdu klienta**
   - Pracownik otwiera widok "Dzisiejsze Wyjazdy"
   - Odnajduje rezerwację
   - Przyjmuje płatność na miejscu
   - Klika "Wyjazd", co zwalnia miejsce i archiwizuje rezerwację

4. **Zarządzanie obłożeniem**
   - Menedżer parkingu otwiera widok kalendarza
   - Sprawdza prognozowane obłożenie w nadchodzącym tygodniu
   - Ocenia dostępność miejsc

### Kryteria Sukcesu

#### KPI 1 (Mierzalny)
- Osiągnięcie 60% rezerwacji pochodzących z kanałów online (API) w ciągu 6 miesięcy od wdrożenia
- Pomiar: `(Liczba rezerwacji z API / Łączna liczba rezerwacji) * 100%`

#### KPI 2 (Niemierzalny / Jakościowy)
- Pełna cyfryzacja i zastąpienie manualnych procesów centralnym systemem
- Pomiar: Obserwacja i feedback od pracowników parkingu po wdrożeniu

## Kwestie Wymagające Doprecyzowania

1. **Logika Cenowa**
   - Brak zdefiniowanego cennika
   - Brak logiki naliczania opłat za dobę
   - Brak zasad naliczania dopłat za przedłużenie pobytu

2. **Specyfikacja API**
   - Format danych (JSON?)
   - Kody odpowiedzi w przypadku sukcesu i błędu
   - Wymagania dotyczące autentykacji (np. klucz API)

3. **Definicja Doby Parkingowej**
   - Jak system ma interpretować rezerwacje obejmujące przełom dnia
   - Przykład: rezerwacja od 22:00 w poniedziałek do 05:00 we wtorek – jedna czy dwie doby?
