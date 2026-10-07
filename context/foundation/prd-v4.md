---
project: "# TODO: project — see Open Questions"
version: 4
status: draft
created: 2026-09-16
context_type: brownfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

System parkingowy przy lotnisku Katowice-Pyrzowice. Kierunek lotu jest zapisywany podczas rezerwacji lub podczas przyjazdu na parking. Są widoki powrotów. Check-out i listy powrotów działają dziś bez godzin przylotu samolotu.

Obecni użytkownicy: staff i kierowca — obaj na swoich widokach powrotów.

# TODO: key architecture and tech stack — see Open Questions

## Problem Statement & Motivation

Na widokach powrotów obsługa chce widzieć czasy przylotów samolotów na podstawie kierunków lotów już zapisanych w rezerwacji lub przy wjeździe. Parking operuje przy KTW, więc informacje o godzinie przylotu (w tym status i ETA na żywo) mają pochodzić z tego lotniska. Danego okresu może być kilka przylotów z danego kierunku — wtedy trzeba wskazać te godziny, a nie zgadywać jeden lot. Przy 100× skali reguła zostaje: kierunek + okno ± ok. 3h, wszystkie godziny w oknie.

# TODO: why this change is needed now (trigger event, business pressure, user feedback) — see Open Questions

## User & Persona

Staff i kierowca — obaj na swoich widokach powrotów. Moment: obsługa powrotów klientów z lotniska, gdy znany jest kierunek lotu, ale nie widać, o której samolot ląduje i czy jest opóźniony.

## Success Criteria

### Primary

- Staff albo kierowca otwiera swój widok powrotów i przy rezerwacji z zapisanym kierunkiem lotu widzi godziny rozkładowe przylotów na KTW z tego kierunku w oknie ± ok. 3h wokół estymowanego czasu powrotu. Jeśli w tym oknie jest kilka przylotów z tego kierunku — widzi te godziny; system nie wybiera jednego lotu.

### Secondary

- Zapisywanie numeru lotu przy rezerwacji lub przy wjeździe.
- Status i ETA na żywo na widokach powrotów.

### Guardrails

- Listy powrotów i check-out muszą działać jak dziś.

## User Stories

### US-01: Widok powrotów pokazuje godziny przylotów KTW dla zapisanego kierunku

- **Given** staff lub kierowca jest na swoim widoku powrotów i rezerwacja ma zapisany kierunek lotu
- **When** patrzy na ten powrót w oknie powrotu
- **Then** widzi godziny rozkładowe przylotów KTW z tego kierunku w oknie ± ok. 3h wokół estymowanego czasu powrotu; przy kilku przylotach z tego kierunku w tym oknie — te godziny; system nie wybiera jednego lotu
- **Before** listy powrotów były bez godzin przylotu samolotu

## Scope of Change

- [new] FR-001: Staff i kierowca widzą na swoich widokach powrotów godziny rozkładowe przylotów KTW dla zapisanego kierunku w oknie ± ok. 3h wokół estymowanego czasu powrotu. Priority: must-have
  > Socrates: Counter-argument considered: "wystarczą godziny rozkładowe bez statusu/ETA na żywo — ETA psuje v1." Resolution: split; v1 to godziny rozkładowe; status i ETA na żywo jako FR-007 nice-to-have.
- [new] FR-002: Przy kilku przylotach z tego kierunku w oknie ± ok. 3h wokół estymowanego powrotu staff i kierowca widzą te godziny; system nie wybiera jednego lotu. Priority: must-have
  > Socrates: Counter-argument considered: "kilka godzin z tego samego kierunku myli obsługę." Resolution: kept; obsługa ma widzieć godziny kandydatów, nawet jeśli jest ich więcej niż jedna.
- [preserved] FR-003: Staff i kierowca korzystają z list powrotów jak dziś. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [preserved] FR-004: Staff i kierowca robią check-out jak dziś. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [preserved] FR-005: Kierunek lotu zapisuje się przy rezerwacji lub wjeździe jak dziś. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-006: Staff może zapisać numer lotu przy rezerwacji lub wjeździe. Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-007: Staff i kierowca widzą na widokach powrotów status i ETA na żywo dla godzin kandydatów. Priority: nice-to-have
  > Socrates: Counter-argument considered as part of FR-001: live ETA hurts v1. Resolution: demoted to nice-to-have.

## Constraints & Compatibility

- Istniejące rezerwacje z zapisanym kierunkiem dostają godziny bez migracji danych i bez numeru lotu.
- Listy powrotów i check-out — bez zmiany kontraktu.
- Zapis kierunku lotu przy rezerwacji lub wjeździe zostaje jak dziś.

## Business Logic Changes

Dla rezerwacji z zapisanym kierunkiem lotu pokaż godziny rozkładowe przylotów na KTW z tego kierunku w oknie ± ok. 3h wokół estymowanego czasu powrotu; gdy jest kilka — wszystkie te godziny, bez zgadywania jednego lotu.

Wejście, które obsługa już ma: kierunek lotu (rezerwacja lub wjazd) oraz estymowany czas powrotu. Wynik: lista godzin rozkładowych przylotów z tego kierunku, których rozkład mieści się w oknie ± ok. 3h wokół estymowanego powrotu. Obsługa widzi to na istniejącym widoku powrotów staff i kierowcy — bez wyboru „tego jednego” lotu.

## Access Control Changes

Staff i kierowca zostają przy swoich widokach powrotów jak dziś.

No access control changes — current model preserved.

## Non-Goals

- Nie wybierać jednego lotu, gdy w oknie ± ok. 3h jest kilka przylotów z danego kierunku — v1 pokazuje te godziny.
- Nie wymagać numeru lotu, żeby pokazać godziny — numer jest nice-to-have, wiązanie v1 idzie kierunkiem.
- Nie zmieniać auth, check-out ani kontraktu list powrotów.
- Nie obsługiwać innych lotnisk niż KTW.

## Open Questions

1. **What is the project name?** — Input `project: null`. Owner: user. Block: no (change is shaped; name is identity only).
2. **Current System Overview is missing key architecture and tech stack.** — Shape-notes describe purpose and core functionality only. Owner: user. Downstream stack assessment may fill this from the existing system. Block: no.
3. **Why is this change needed now (trigger event, business pressure, user feedback)?** — Not captured in shape-notes. Owner: user. Block: no.
4. **target_scale.qps and target_scale.data_volume** — Not captured; only `users: small`. Owner: user. Block: no.
