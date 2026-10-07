# ParkTrack

[![Version](https://img.shields.io/badge/version-0.0.1-blue)](#)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

## Table of Contents

1. [Project Description](#project-description)
2. [Tech Stack](#tech-stack)
3. [Getting Started Locally](#getting-started-locally)
4. [Konfiguracja Supabase](#konfiguracja-supabase)
5. [Available Scripts](#available-scripts)
6. [Project Scope](#project-scope)
   - [In Scope](#in-scope)
   - [Out of Scope](#out-of-scope)
7. [Project Status](#project-status)
8. [License](#license)

---

## Project Description

ParkTrack is a responsive web application designed for parking lot management staff.  
In its MVP, ParkTrack supports full‐day reservations, manual check-in/out workflows, calendar‐based occupancy reporting, daily arrival/departure statistics, a single external API endpoint for creating reservations, and automated email confirmations.

---

## Tech Stack

### Frontend

- **Astro 5** – Island-architecture framework
- **React 19** – Interactive UI components
- **TypeScript 5** – Static typing
- **Tailwind CSS 4** – Utility-first styling
- **Shadcn/ui** – Ready-to-use React components

### Backend

- **Supabase** – Backend-as-a-Service
  - PostgreSQL database
  - Built-in authentication
  - Row-Level Security (RLS)
  - Edge Functions for custom API logic

### CI/CD & Hosting

- **GitHub Actions** – Continuous integration
- **Docker on DigitalOcean** – Containerized deployment
- **Alternative**: Vercel / Netlify (frontend hosting)

### (Optional)

- **Openrouter.ai** – AI integrations (not required in MVP)

---

## Getting Started Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v22.14.0
- [nvm](https://github.com/nvm-sh/nvm) (optional but recommended)
- A Supabase project with credentials
- SMTP credentials for email notifications

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/parktrack.git
cd parktrack

# 2. Use correct Node version
nvm use

# 3. Install dependencies
npm install

# 4. Create environment file
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SMTP_HOST, SMTP_USER, SMTP_PASS, etc.

# 5. Run development server
npm run dev
```

---

## Konfiguracja Supabase

### Dostęp do panelu Supabase (Cloud)

1. **Zaloguj się do Supabase Dashboard:**
   - Przejdź na [https://supabase.com](https://supabase.com)
   - Zaloguj się lub utwórz konto
   - Przejdź do [Dashboard](https://app.supabase.com)

2. **Wybierz lub utwórz projekt:**
   - Jeśli masz już projekt, kliknij na niego
   - Jeśli nie, kliknij "New Project" i utwórz nowy projekt

3. **Pobierz dane dostępowe:**
   - W panelu projektu przejdź do **Settings** → **API**
   - Skopiuj:
     - **Project URL** → to będzie `SUPABASE_URL`
     - **anon public** key → to będzie `SUPABASE_KEY`

4. **Dodaj do pliku `.env`:**
   ```env
   SUPABASE_URL=https://twoj-projekt.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Supabase lokalne (Development)

Dla rozwoju lokalnego możesz użyć lokalnej instancji Supabase:

1. **Upewnij się, że masz zainstalowane Supabase CLI:**
   ```bash
   # Sprawdź czy jest zainstalowane
   supabase --version
   
   # Jeśli nie, zainstaluj globalnie
   npm install -g supabase
   ```

2. **Uruchom lokalną instancję Supabase:**
   ```bash
   supabase start
   ```

3. **Pobierz dane dostępowe:**
   ```bash
   supabase status
   ```
   
   To wyświetli informacje o lokalnej instancji, w tym:
   - API URL (zwykle `http://127.0.0.1:54321`)
   - anon key (długi JWT token)

4. **Skonfiguruj plik `.env` dla lokalnego developmentu:**
   ```env
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_KEY=<anon-key-z-supabase-status>
   ```

5. **Zastosuj migracje do lokalnej bazy:**
   ```bash
   supabase db reset
   ```
   
   To zastosuje wszystkie migracje z `supabase/migrations/` oraz seed demo z `supabase/seed.sql`.

   Seed wstawia rezerwacje z prefiksem notatki `[DEMO]`. Daty są liczone od **dzisiaj w strefie Europe/Warsaw**, więc na prezentacji widać:
   - przyjazdy dzisiaj (dashboard + moduł kierowcy),
   - wyjazdy dzisiaj (w tym bliski checkout),
   - auta na parkingu z wyjazdem w ciągu 2–3 tygodni,
   - nadchodzące rezerwacje, zakończone, anulowane i no-show.

   Ponowne wklejenie `supabase/seed.sql` w SQL Editorze (Studio) tylko podmienia wiersze `[DEMO]` — nie rusza reszty danych.

### Przydatne komendy Supabase CLI

| Komenda | Opis |
|---------|------|
| `supabase start` | Uruchamia lokalną instancję Supabase |
| `supabase stop` | Zatrzymuje lokalną instancję |
| `supabase status` | Wyświetla status i dane dostępowe |
| `supabase db reset` | Resetuje bazę i aplikuje migracje |
| `supabase db push` | Wysyła migracje do Supabase Cloud |
| `supabase db pull` | Pobiera schemat z Supabase Cloud |
| `supabase gen types typescript --local` | Generuje typy TypeScript z lokalnej bazy |

### Panel administracyjny lokalnego Supabase

Po uruchomieniu `supabase start`, lokalny panel administracyjny jest dostępny pod adresem:
- **Studio URL**: `http://127.0.0.1:54323`

To jest lokalny odpowiednik Supabase Dashboard, gdzie możesz:
- Przeglądać tabele i dane
- Uruchamiać zapytania SQL
- Zarządzać użytkownikami
- Konfigurować RLS (Row Level Security)
- Testować API

---

## Available Scripts

In the project directory, run:

| Command            | Description                     |
| ------------------ | ------------------------------- |
| `npm run dev`      | Start Astro in development mode |
| `npm run build`    | Build for production            |
| `npm run preview`  | Preview production build        |
| `npm run astro`    | Run Astro CLI                   |
| `npm run lint`     | Run ESLint                      |
| `npm run lint:fix` | Run ESLint with auto-fix        |
| `npm run format`   | Prettier code formatter         |

---

## Project Scope

### In Scope

- **Reservation Management**:
  - Quick-entry (surname & dates) + full details form
  - Search, edit, cancel, mark as no-show
- **Parking Operations**:
  - “Today’s Arrivals” & “Today’s Departures” views
  - Check-in (mark as “In Progress”)
  - Check-out (mark as “Completed” & archive)
- **Reporting**:
  - Visual calendar of occupancy
  - Daily arrival/departure statistics
- **External API**:
  - `POST /reservations` endpoint for new reservations
- **Notifications**:
  - Automatic email confirmation upon reservation creation

### Out of Scope

- Driver-facing portal
- Real-time availability API
- Pricing logic & billing calculations
- Multi-tier access control
- Dynamic graphical parking map

---

## Project Status

- **Version**: 0.0.1 (MVP)
- **Stage**: Active development – MVP planning & implementation
- **Next Steps**: Define pricing logic, API response formats, day-boundary rules

---

## License

This project is released under the **MIT License**.  
See the [LICENSE](LICENSE) file for details.
