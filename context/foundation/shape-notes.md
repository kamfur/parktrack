---
project: garage-carport-slots
context_type: brownfield
created: 2026-09-18
updated: 2026-09-18
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed:
    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
  gray_areas_resolved:
    - topic: "change category"
      decision: "new module alongside existing — garage/carport spots added alongside regular parking spots"
    - topic: "allocator"
      decision: "system auto-assigns respecting 10h buffer; staff overrides/swaps"
    - topic: "must preserve"
      decision: "existing regular-spot reservation flow, dashboard, driver views, calendar unchanged"
    - topic: "auth model"
      decision: "no changes — staff and driver keep existing roles"
    - topic: "mvp scope"
      decision: "all 4 pieces in v1: configurator+auto-assign, view markers everywhere, manual swap view, optimization-suggestion button (descriptive, no auto-apply)"
    - topic: "blast radius"
      decision: "reservation creation/edit flow"
    - topic: "timeline"
      decision: "2 weeks after-hours"
    - topic: "domain rule"
      decision: "auto-assign garage respecting 10h buffer; staff can override or request descriptive optimization suggestion"
    - topic: "nfr"
      decision: "no regression on existing views; 10h buffer always enforced on auto-assign and manual swap"
    - topic: "product type"
      decision: "no change — existing web app"
    - topic: "user base"
      decision: "no change — existing staff and driver"
    - topic: "hard deadline"
      decision: "none"
    - topic: "non-goals"
      decision: "no auto-execute reshuffling without staff confirmation; no auth/role changes or regular-spot behavior changes; single location only; static price list only"
  frs_drafted: 8
  quality_check_status: accepted
seed_idea: |
  Parking oprócz miejsc parkingowych ma również obsługę miejsc w garażu. Garaże charakteryzją się tym, że mają swoje miejsca, garaż może być pojedyczny lub podwójny. Może to być garaż lub wiata. Garaż i wiaty mają swoje cenniki. Staff zarządza przydzielaniem rezerwacji do poszczególnego garażu, tak aby nie było zbyt dużo przestojów, zachowując zawsze 10h czasu buforu na wypadek gdyby samolot powrotny się opóżnił.
  Idęą jest aby stworzyć konfigurator miejsc garażowych -> z polam typu: garaż/wiata, z checkboxem dostępny.
  oprócz tego w formie widoku czas/miejse parkignowe stworzyuć miejsce w którym bedzie podglaad meijsc w garaży zarezerwowanych z możliwośca zamiany poprzez staff lub też przycisk zaproponuj optymalizacje i w sposób opisowy będzie proponował zamiany
  W ramach rezerwacji utowrzyć algorytm który będzie sprawdzał dostepność i ewentualnie będzie dokonywał roszad pod kątem optymalizacji, ale to raczej nie w MVP
  garaże na widokach rezerwacji, dashboard, kerowcy oraz kalendarz powinny mieć oznaczenie poprzez ikone garażu oraz informacje o przydzielonym miejscu
  w widoku szcegółow jest to opis garaż oraz przydzioelone meijsce
---

## Current System

ParkTrack — system rezerwacji parkingu przy lotnisku. Dziś obsługuje tylko zwykłe miejsca parkingowe (open-air): rezerwacje, dashboard, widoki kierowcy, kalendarz. Nie ma pojęcia garażu/wiaty jako typu miejsca.

## Vision & Problem Statement

Parking oprócz zwykłych miejsc ma też garaże i wiaty — każdy garaż ma własne miejsca (pojedynczy albo podwójny), własny cennik, i wymaga innego trybu przydziału niż zwykłe miejsce: system ma auto-przydzielać rezerwację do garażu (z buforem min. 10h na wypadek opóźnienia lotu powrotnego), a staff może to nadpisać — ręcznie zamienić przydział albo poprosić o opisową propozycję optymalizacji. Zmiana dodaje garaż/wiatę jako nowy typ miejsca obok istniejących miejsc parkingowych — nie zastępuje ich.

## User & Persona

Staff — konfiguruje miejsca garażowe (typ, dostępność), zarządza przydziałem i zamianami, korzysta z widoku optymalizacji.
Kierowca — widzi przydzielony garaż/miejsce na swoim widoku.
Moment: staff przydziela/reorganizuje rezerwacje garażowe, żeby unikać przestojów przy zachowaniu buforu 10h; kierowca i staff widzą przydział garażu na swoich widokach (rezerwacje, dashboard, kierowca, kalendarz, szczegóły).

## Access Control

Staff i kierowca zostają przy swoich istniejących rolach i widokach — brak nowych ról dla tej zmiany.

No changes planned — current model preserved.

## Success Criteria

### Primary

- Staff otwiera konfigurator miejsc garażowych, definiuje miejsce (typ: garaż/wiata, pojedynczy/podwójny, cennik, checkbox dostępny). Przy tworzeniu/edycji rezerwacji wymagającej garażu system auto-przydziela dostępny garaż/wiatę respektując bufor min. 10h na wypadek opóźnienia lotu powrotnego. Przydzielony garaż i miejsce widoczne (ikona + info) na widokach rezerwacji, dashboardu, kierowcy i kalendarza; w widoku szczegółów jako opis garażu + przydzielone miejsce.
- Staff otwiera widok czas × miejsce garażowe, widzi zarezerwowane miejsca garażowe i może ręcznie zamienić przydział.
- Staff klika "zaproponuj optymalizację" i widzi opisową propozycję zamian ograniczających przestoje (bez auto-wykonania).

### Secondary

- Algorytm, który sam sprawdza dostępność i automatycznie wykonuje roszady (zamiany) pod kątem optymalizacji, bez potwierdzenia staff — nice-to-have, poza MVP.

### Guardrails

- Istniejący przepływ rezerwacji, dashboard, widoki kierowcy i kalendarz dla zwykłych miejsc parkingowych działają bez zmian.
- Bufor 10h między zjazdem jednego auta a przyjazdem następnego jest zawsze respektowany przy auto-przydziale.

## Functional Requirements

### Konfiguracja i przydział

- FR-001: Staff może tworzyć/edytować miejsca garażowe (typ garaż/wiata, pojedynczy/podwójny, cennik, checkbox dostępny). Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-002: System auto-przydziela dostępny garaż/wiatę do rezerwacji, respektując bufor min. 10h. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### Podgląd i zamiana

- FR-003: Staff widzi zajętość garaży w widoku czas × miejsce garażowe. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-004: Staff może ręcznie zamienić przydział garażu dla rezerwacji. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-005: Staff klika "zaproponuj optymalizację" i widzi opisową propozycję zamian (bez auto-wykonania). Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### Oznaczenia w widokach

- FR-006: Ikona garażu i przydzielone miejsce widoczne na widokach rezerwacji, dashboardu, kierowcy i kalendarza. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-007: Widok szczegółów pokazuje opis garażu i przydzielone miejsce. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### Zachowanie istniejącego

- FR-008: Istniejące przepływy rezerwacji, dashboardu, kierowcy i kalendarza dla zwykłych miejsc parkingowych działają bez zmian. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; it stands as written.

## User Stories

### US-01: Auto-przydział garażu z buforem 10h przy tworzeniu rezerwacji

- **Given** staff tworzy rezerwację wymagającą garażu/wiaty
- **When** zapisuje rezerwację
- **Then** system auto-przydziela dostępny garaż/wiatę tak, by zachować bufor min. 10h między poprzednim zjazdem a nowym przyjazdem; przydzielony garaż i miejsce są widoczne na widokach rezerwacji, dashboardu, kierowcy, kalendarza i w szczegółach
- **Before** system nie rozróżniał garaży/wiat — nie było przydziału miejsca garażowego

## Business Logic

Dla rezerwacji wymagającej garażu/wiaty system wybiera dostępne miejsce garażowe tak, by między wyjazdem poprzedniego auta a przyjazdem nowego został zachowany bufor min. 10h, a staff może to ręcznie nadpisać lub poprosić o opisową propozycję optymalizacji.

Wejście: typ i dostępność skonfigurowanych miejsc garażowych, terminy wyjazdów/przyjazdów rezerwacji. Wynik: przydzielone miejsce garażowe (lub, na żądanie staff, opisowa propozycja zamiany zmniejszająca przestoje). Obsługa widzi wynik na widoku czas × miejsce garażowe i na wszystkich widokach, gdzie pokazywana jest rezerwacja.

## Constraints & Preserved Behavior

- Istniejący przepływ rezerwacji, dashboard, kalendarz i widoki kierowcy dla zwykłych miejsc parkingowych działają bez zmian.
- Auto-przydział i ręczna zamiana garażu nigdy nie mogą naruszyć bufora min. 10h.
- Optymalizacja jest tylko opisowa (propozycja) w MVP — system nie wykonuje zamian automatycznie bez potwierdzenia staff.

## Non-Functional Requirements

- Istniejące widoki (rezerwacje, dashboard, kierowca, kalendarz) bez regresji wydajności względem dziś.
- Bufor min. 10h jest zawsze wymuszony — zarówno przy auto-przydziale, jak i przy ręcznej zamianie przez staff (system nie pozwala zapisać zamiany, która go łamie).

## Non-Goals

- Automatyczne wykonywanie roszad (zamian) bez potwierdzenia staff — algorytm w pełni auto-optymalizujący jest poza MVP (patrz Success Criteria → Secondary).
- Zmiana modelu auth/ról oraz zmiana istniejącego zachowania dla zwykłych miejsc parkingowych.
- Obsługa wielu lotnisk/lokalizacji garaży — zakres ograniczony do jednej lokalizacji.
- Dynamiczne/sezonowe cenniki garażowe — tylko statyczny cennik per typ garaż/wiata.

## Timeline acknowledgment

Acknowledged on 2026-09-18: 2-week MVP (after-hours) requires sustained dedication across configurator, auto-assign, view markers, manual swap view, and optimization-suggestion button; user accepted.

## Quality cross-check

All required elements present. No gaps recorded.
