# Mapa okazji M5 — ParkTrack (solo PoC → 10xChampion)

**Kontekst:** solo / kursowy PoC na bazie ParkTrack  
**Ścieżka certyfikatu:** pipeline review (M5L2 → M5L3)  
**Dane pierwszej wersji:** mock / lokalny diff / tylko do odczytu (niewrażliwe)

---

## Sygnały sklasyfikowane

### S1 — Powtarzalne uwagi review bez twardej bramki

- **Sygnał tarcia:** Przed merge te same klasy problemów wracają ręcznie (brak Zod na API, `prerender` / handlery API, React w złym miejscu, brak testów przy zmianie serwisu) — CI sprawdza test/lint/build, ale nie ocenia jakości diffa względem konwencji ParkTrack.
- **SaaS / domyślna odpowiedź:** GitHub review requests, Code Owners, status checks (`ci.yml`: test → lint → build), ręczne review w PR.
- **Cienki helper:** Agent review na diffie: werdykt JSON + komentarz na PR; nie zastępuje ludzkiego merge, tylko pierwszy przebieg.
- **Pierwsza użyteczna wersja:** lokalnie `git diff | npx tsx review.ts` na symulowanym/rzeczywistym diffa; potem job GHA na `pull_request`.

### S2 — Konwencje AI tylko w głowie / w AGENTS.md

- **Sygnał tarcia:** Reguły z `AGENTS.md` / `context/` nie są egzekwowane na PR — agent w IDE je zna, pipeline CI ich nie „czyta”.
- **SaaS / domyślna odpowiedź:** dokumentacja w repo, ESLint, TypeScript strict.
- **Cienki helper:** system prompt / kryteria review wpięte w agenta CI (te same hard rules co w `AGENTS.md`).
- **Pierwsza użyteczna wersja:** wspólny schemat werdyktu + lista kryteriów w pliku używanym lokalnie i w GHA.

### S3 — Ręczne kopiowanie skilli między repo (na później)

- **Sygnał tarcia:** artefakty AI (skille, reguły) kopiowane między projektami kursowymi / firmowymi.
- **SaaS / domyślna odpowiedź:** wiki, ręczne kopiowanie przy małej skali.
- **Cienki helper:** Shared AI Registry (M5L4) — **nie wybieramy teraz** (Champion = jedna ścieżka; idziemy pipeline).
- **Pierwsza użyteczna wersja:** n/d na Champion (świadomie odłożone).

### S4 — Status „czy PR jest bezpieczny do merge” rozjeżdża się między narzędziami

- **Sygnał tarcia:** zielone CI ≠ sensowny diff; brak jednego miejsca z ryzykiem PR-a (blast radius / krytyczne ścieżki: auth, API, Supabase).
- **SaaS / domyślna odpowiedź:** Checks na PR, ręczne czytanie diffa.
- **Cienki helper:** score + krótkie uzasadnienie ryzyka w komentarzu agenta (MVP bez dashboardu).
- **Pierwsza użyteczna wersja:** pole `score` / `risk` w JSON + komentarz na PR; bez osobnego UI.

---

## Wybrany kandydat

```text
Helper:
ParkTrack AI Code Review (solo PoC → CI)

Czyta:
- lokalnie: git diff (lub symulowany diff)
- w CI: tytuł PR, body PR, git diff względem base
- kontekst reguł: wycinek hard rules z AGENTS.md (API handlers, Zod, granice React/Astro)

Zwraca:
- ustrukturyzowany werdykt JSON (score, findings, summary)
- lokalnie: stdout
- w CI (M5L3): komentarz na PR + opcjonalnie label / fail job przy niskim score

Nie robi:
- nie zastępuje ludzkiego approve/merge
- nie buduje dashboardu, bazy, logowania ani pełnego produktu review
- nie publikuje Shared AI Registry (M5L4)
- nie czyta sekretów / danych klientów z Supabase

Ryzyko danych:
mock / lokalny diff / publiczny kod ParkTrack — tylko do odczytu, niewrażliwe.
Klucz API modelu tylko jako secret w GHA / .env lokalnie (nie commitować).

Kierunek, jeśli okaże się wartościowy:
M5L2 lokalny agent SDK → M5L3 Composite Action + merge gate → ewentualnie później szersze kryteria / promptfoo.
```

**Dlaczego ten, a nie inne:** S1+S2+S4 to jeden wąski problem (jakość PR vs konwencje), łączy GitHub + CI + reguły repo, da się sprawdzić lokalnie bez produktu, i dokładnie mapuje się na dowody 10xChampion (pipeline, logi, komentarz LLM na PR). S3 zostaje na bok — druga ścieżka Champion.

---

## Dowody pod 10xChampion (przypomnienie)

- widok pipeline’u z co najmniej jednym jobem  
- logi joba  
- screenshot komentarza LLM na PR  

---

## Następny ruch

Mapa zamknięta → **budowa** ścieżką M5L2 (lokalny reviewer), potem M5L3 (GHA).
