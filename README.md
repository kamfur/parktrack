# ParkTrack

[![Version](https://img.shields.io/badge/version-0.0.1-blue)](#)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

## Table of Contents
1. [Project Description](#project-description)  
2. [Tech Stack](#tech-stack)  
3. [Getting Started Locally](#getting-started-locally)  
4. [Available Scripts](#available-scripts)  
5. [Project Scope](#project-scope)  
   - [In Scope](#in-scope)  
   - [Out of Scope](#out-of-scope)  
6. [Project Status](#project-status)  
7. [License](#license)  

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