---
name: 10x-impl-review-ci
description: >
  Run implementation review non-interactively in CI against a PR: discovers
  the plan, checks drift/safety/patterns/test coverage, writes
  context/changes/<change-id>/reviews/impl-review.md, commits it to the PR
  branch, and posts a summary comment. Use whenever the request mentions CI,
  GitHub Actions, GHA, your AI coding assistant Action, automated PR review, or "review
  this PR in CI".
---

# Przegląd implementacji (CI/CD)

Uruchom w GitHub Actions (zazwyczaj za pośrednictwem akcji Twojego asystenta kodowania AI) na pull request. Analizuj zmiany w PR w odniesieniu do planu, który ma on implementować. Wygeneruj ścieżkę audytu jako zatwierdzony plik raportu plus zwięzły komentarz do PR.

**Ta umiejętność nie wchodzi w interakcje i nie edytuje kodu.** Bez pytań, bez pętli triage, bez edycji źródła. Czyta, analizuje, zapisuje jeden plik raportu, zatwierdza go, publikuje wierszowe komentarze przeglądowe do oznaczonych wierszy i publikuje podsumowujący komentarz do PR. To całe zadanie.

**Kryteria przeglądu — jak porównać implementację z planem, jak ocenić każdy wymiar i jak kształtować wnioski — znajdują się w `references/impl-review-instructions.md`. Przeczytaj ten plik raz, gdy ta umiejętność się załaduje; Kroki 1–5 orkiestrują go (zbierają dowody, uruchamiają sprawdzenia, normalizują wnioski) i wskazują na niego, zamiast powtarzać kryteria.** Poniższe kroki dotyczą tylko mechaniki uprzęży: odkrywania planu, różnicy, wysyłania subagentów, umowy dotyczącej pliku raportu, zatwierdzenia oraz publikowania komentarzy wierszowych/podsumowujących.

## Kontekst operacyjny

Załóżmy, że działasz nieinteraktywnie na efemerycznym runnerze Linux z:

- **Historią Git** — `origin/<base-ref>` jest pobrany; merge-base PR jest możliwy do rozwiązania.
- **`gh` CLI** — uwierzytelniony za pomocą `GH_TOKEN`/`GITHUB_TOKEN`; może odczytywać metadane PR, publikować komentarze.
- **Łańcuchem narzędzi projektu** — zainstalowanym przed uruchomieniem tej umiejętności (Node/pnpm, Python, Go, cokolwiek projekt używa). Polecenia testowania i lintowania powinny działać.
- **Zmiennymi środowiskowymi** — `PR_NUMBER`, `GITHUB_BASE_REF` (gałąź bazowa), plus wszystko, co eksportuje workflow.
- **Subagentami** — możesz uruchamiać agentów `general-purpose` do równoległego zbierania dowodów.

Żaden użytkownik nie obserwuje. Nigdy nie zadawaj użytkownikowi pytań — nie ma nikogo, kto by odpowiedział. Jeśli coś jest niejednoznaczne, wybierz konserwatywną interpretację i zanotuj to w raporcie.

## Krok 0: Znajdź plan

Utwórz zadanie o nazwie "Impl-Review (CI)" i ustaw jego aktywną formę na "Odkrywanie planu".

Plan jest podstawową prawdą — przegląd porównuje PR z deklarowanym zamiarem planu. Brak planu oznacza brak sensownego przeglądu.

**Główne źródło: konwencja.** Projekty, które używają przepływu pracy opartego na planie, przechowują pliki planu w `context/changes/<change-id>/plan.md` w gałęzi PR — w katalogu głównym repozytorium lub, w monorepo, w poddrzewie obszaru roboczego (np. `projects/<app>/context/changes/<change-id>/plan.md`). Znajdź najnowszy, który jest częścią tego PR:

```bash
BASE="${GITHUB_BASE_REF:-master}"
# The leading `:(glob)**/` matches context/changes/ at the repo root AND
# under any workspace subtree, so this works in single-package repos and
# monorepos alike.
PLAN=$(git diff --name-only "origin/${BASE}...HEAD" -- ':(glob)**/context/changes/**/plan.md' \
  | sort -r \
  | head -1)
```

Sortowanie odwrotno-leksykograficzne wybiera najnowszą zmodyfikowaną folder zmiany (`<change-id>` slugi są zazwyczaj poprzedzone datą dla aktywnej pracy, a porządek alfabetyczny jest wystarczająco dobry jako rozstrzygający; w monorepo również faworyzuje obszar roboczy, którego ścieżka sortuje się jako ostatnia, co jest akceptowalnym rozstrzygającym).

**Nadpisanie: jawne odniesienie w treści PR.** Jeśli opis PR zawiera wiersz taki jak `Plan: context/changes/<change-id>/plan.md`, ma on pierwszeństwo przed konwencją. Obsługuje to połączone PR, przywrócone starsze plany i PR, które reorganizują pliki planu, ale implementują inny:

```bash
PR_BODY=$(gh pr view "$PR_NUMBER" --json body -q .body 2>/dev/null || echo "")
OVERRIDE=$(printf '%s' "$PR_BODY" \
  | grep -oE 'Plan:[[:space:]]*[^[:space:]`]*context/changes/[^[:space:]]+/plan\.md' \
  | head -1 \
  | sed -E 's/Plan:[[:space:]]*//')
[ -n "$OVERRIDE" ] && PLAN="$OVERRIDE"
```

**Grzeczne wyjście, gdy nie znaleziono planu.** Większość PR w dojrzałym repozytorium nie jest oparta na planie (dokumentacja, commity porządkowe, hotfixy). Nie przerywaj workflow — opublikuj neutralny komentarz i wyjdź z kodem 0:

```bash
if [ -z "$PLAN" ] || [ ! -f "$PLAN" ]; then
  gh pr comment "$PR_NUMBER" --body "🔍 **impl-review (CI)** — no plan detected in this PR. Skipping review.

To enable a review, include a \`Plan: context/changes/<change-id>/plan.md\` line in the PR description, or ensure the branch touches a plan file under \`context/changes/<change-id>/\`."
  exit 0
fi
```

Zapisz rozwiązaną ścieżkę planu — każdy późniejszy krok odwołuje się do niej.

## Krok 1: Załaduj i przeanalizuj plan

Zaktualizuj aktywną formę bieżącego zadania na "Ładowanie planu".

W pełni odczytaj plik planu (bez przesunięcia, bez limitu) i wyodrębnij jego zobowiązania — zaplanowane ścieżki plików, automatyczną/ręczną weryfikację, wykluczenia, decyzje architektoniczne — zgodnie z **"Odczytaj plan jako punkt odniesienia"** w `references/impl-review-instructions.md` (anatomia planu i pięć celów ekstrakcji). PR jest zawsze przeglądany jako całość — częściowe przeglądy CI są podatne na błędy bez plików stanu i rzadko przydatne w praktyce.

### Oblicz różnicę

```bash
BASE="${GITHUB_BASE_REF:-master}"
git fetch origin "$BASE" --depth=50 2>/dev/null || true
CHANGED_FILES=$(git diff --name-only "origin/${BASE}...HEAD")
```

Trzykropkowy zakres daje różnicę merge-base — to, co ten PR faktycznie dodaje, a nie wszystko, co wydarzyło się od rozbieżności gałęzi.

Porównaj zmienione pliki z zaplanowanymi plikami:

- **W planie I w różnicy** → oczekiwana zmiana; sprawdź, czy intencja się zgadza.
- **W różnicy, ale NIE w planie** → nieplanowane dodanie; sprawdź listę wykluczeń, a następnie oznacz jako rozszerzenie zakresu, jeśli nie jest jawnie wykluczone.
- **W planie, ale NIE w różnicy** → prawdopodobnie brakująca implementacja; oznacz.

Nie wczytuj każdego zmienionego pliku źródłowego do głównego kontekstu. Zleć to subagentom poniżej — zachowaj w głównym kontekście tylko tekst planu i podsumowanie różnicy.

## Krok 2: Równoległe zbieranie dowodów

Zaktualizuj aktywną formę bieżącego zadania na "Zbieranie dowodów".

Uruchom trzech subagentów równolegle, każdego z ukierunkowanym kontekstem. Nie wrzucaj całego planu do wszystkich z nich — każdy agent potrzebuje tylko tego, co jest istotne dla jego pytania. Kryteria oceny, które stosuje każdy agent, znajdują się w `references/impl-review-instructions.md` w sekcji **"Wymiary przeglądu"** — daj każdemu agentowi jego dane wejściowe i wskaż mu jego wymiar; zgłasza on wnioski w kształcie określonym w odniesieniu dla danego wymiaru.

### Agent 1 — Wykrywanie odchyleń od planu

`subagent_type: "general-purpose"`

Daj mu: wyodrębniony tekst "Wymagane zmiany" (na fazę) i listę zaplanowanych ścieżek plików. Stosuje **wymiar 1 (Odchylenie od planu)** — ZGODNOŚĆ / ODCHYLENIE / BRAK / DODATKOWE dla każdej zaplanowanej zmiany.

### Agent 2 — Bezpieczeństwo, jakość i zgodność ze wzorcami

`subagent_type: "general-purpose"`

Daj mu: listę zmienionych plików źródłowych (wyklucz pliki testowe i sam plik planu) oraz katalog główny projektu. Stosuje **wymiar 2** — bezpieczeństwo / wydajność / niezawodność / bezpieczeństwo danych, plus porównanie wzorców rodzeństwa skalowane do rozmiaru zmiany.

### Agent 3 — Pokrycie testami

`subagent_type: "general-purpose"`

Daj mu: sekcję Kryteria sukcesu planu (wyodrębnij tekst przed uruchomieniem), listę plików różnicowych podzieloną na `source_files` i `test_files`, katalog główny projektu oraz listę "Czego NIE robimy". Stosuje **wymiar 3** — wyodrębnia zobowiązania testowe, dopasowuje je do artefaktów, skanuje w poszukiwaniu niepokrytego zachowania, uruchamia polecenia testowe planu i respektuje jawne wyłączenia.

Jeśli raport subagenta staje się nieporęczny, poproś go o zwrócenie tylko najważniejszych ustaleń, a nie pełnego śledzenia dochodzenia.

## Krok 3: Zweryfikuj zautomatyzowane sprawdzenia inne niż testowe

Zaktualizuj aktywną formę bieżącego zadania na "Weryfikowanie zautomatyzowanych sprawdzeń".

Agent 3 już uruchomił polecenia automatycznej weryfikacji związane z testami. Teraz uruchom wszystko inne — lint, build, format-check, typecheck, wszelkie inne polecenia inne niż testowe z pól wyboru. Dla każdego:

```bash
echo "→ running: $cmd"
$cmd
echo "exit: $?"
```

Zapisz polecenie, wynik (pass/fail), skrócony wynik (pierwsze 40 i ostatnie 20 wierszy zazwyczaj wystarcza). Aby dowiedzieć się, jak odczytywane są pola wyboru weryfikacji ręcznej i jak nieudane sprawdzenia mapują się na oceny, postępuj zgodnie z **"Zweryfikuj kryteria sukcesu"** w odniesieniu.

## Krok 4: Oceń każdy wymiar

Zaktualizuj aktywną formę bieżącego zadania na "Ocenianie".

Przypisz PASS / WARNING / FAIL do każdego z siedmiu wymiarów i wyprowadź ogólny werdykt (APPROVED / NEEDS ATTENTION / REJECTED) za pomocą zasad zawartych w **"Oceń każdy wymiar"** i **"Ogólny werdykt"** w odniesieniu.

## Krok 5: Skompiluj wnioski

Zaktualizuj aktywną formę bieżącego zadania na "Kompilowanie wniosków".

Znormalizuj dane wyjściowe subagentów w jedną listę wniosków. Posortuj według ważności (KRYTYCZNE → OSTRZEŻENIE → OBSERWACJA). Ogranicz do 10 łącznie — skonsoliduj powiązane problemy (np. "6 plików używa niewłaściwej konwencji nazewnictwa" → jedno ustalenie, a nie sześć). Zastosuj kształt ustalenia, gramatykę wpływu i gramatykę opcji naprawy z **"Wyraź wnioski"** w odniesieniu.

**Jeden dodatek specyficzny dla uprzęży, którego nie ma w odniesieniu:** każde ustalenie w zapisanym raporcie otrzymuje również pole `- **Decyzja**: OCZEKUJĄCA` (narzędzia do triage uzupełniają je później). Jest to część umowy wyjściowej w Kroku 6 — nie pomijaj go.

## Krok 6: Zapisz raport

Zaktualizuj aktywną formę bieżącego zadania na "Zapisywanie raportu".

Wyprowadź katalog zmian ze ścieżki rozwiązanego planu — jest to folder nadrzędny planu (`$(dirname "$PLAN")`), który rozwiązuje się na `context/changes/<change-id>` w katalogu głównym repozytorium lub `projects/<app>/context/changes/<change-id>` w monorepo. Zapisz raport do `<change-dir>/reviews/impl-review.md`. Zaktualizuj również `change.md` w miejscu: ustaw `status: impl_reviewed` i `updated: <dzisiaj>` — commit CI w Kroku 7 przenosi to z powrotem do gałęzi PR wraz z przeglądem.

**Katalog jest wyprowadzany z planu, a nie wybierany: raport trafia do folderu `reviews/` obok `change.md` planu (`<…>/context/changes/<change-id>/reviews/impl-review.md`).** NIE zapisuj raportu do `.claude-pr/`, `.github/`, katalogu głównego repozytorium ani żadnej innej lokalizacji — nawet jeśli domyślny prompt Twojego asystenta kodowania AI sugeruje taką. Narzędzia do triage odczytują tylko z tej wyprowadzonej ścieżki. Formatowanie musi odpowiadać otaczającym przeglądom: zgodne z oxfmt (projekt uruchamia `oxfmt --check .` w CI).

### Umowa wyjściowa (nośna)

Plik **musi** zaczynać się od znacznika komentarza HTML `<!-- IMPL-REVIEW-REPORT -->` w pierwszym wierszu i **musi** zawierać `- **Decyzja**: OCZEKUJĄCA` dla każdego ustalenia. Narzędzia downstream odczytują ten kształt, aby skierować raport do przepływu pracy triage. Nie pomijaj żadnego z nich.

### Szablon

```markdown
<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: [Plan Title]

- **Plan**: `context/changes/<change-id>/plan.md`
- **Scope**: Full plan (CI review on PR #<N>)
- **Date**: YYYY-MM-DD
- **CI run**: <GitHub Actions workflow run URL>
- **Verdict**: [APPROVED | NEEDS ATTENTION | REJECTED]
- **Findings**: [N critical] [N warnings] [N observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS / WARNING / FAIL |
| Scope Discipline | PASS / WARNING / FAIL |
| Safety & Quality | PASS / WARNING / FAIL |
| Architecture | PASS / WARNING / FAIL |
| Pattern Consistency | PASS / WARNING / FAIL |
| Test Coverage | PASS / WARNING / FAIL |
| Success Criteria | PASS / WARNING / FAIL |

## Findings

### F1 — [Short title]

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/auth/handler.ts:42
- **Detail**: SQL query built with string concatenation. Plan specified parameterized queries in Phase 2; actual implementation uses template literals.
- **Fix**: Replace the template literal with a parameterized query using db.query($1, [value]).
  - Strength: Matches the pattern in src/users/query.ts; removes injection class entirely.
  - Tradeoff: Minor — one call site, a few-line change.
  - Confidence: HIGH — identical pattern exists elsewhere in this repo.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — [Next finding]
…

<!-- End of report -->
```

Sekcje z zerową liczbą ustaleń mogą zostać pominięte z listy ustaleń, ale tabela werdyktów zawsze pokazuje wszystkie siedem wymiarów.

### Ikony ważności/wpływu (sparowane ze słowami)

- Ważność: ❌ KRYTYCZNE · ⚠️ OSTRZEŻENIE · 👁 OBSERWACJA
- Wpływ: 🏃 NISKI · 🔎 ŚREDNI · 🔬 WYSOKI

Nigdy nie używaj samej ikony bez jej etykiety — zmusza to czytelnika do zapamiętywania, co oznacza każdy glif.

## Krok 7: Zatwierdź raport

Zaktualizuj aktywną formę bieżącego zadania na "Zatwierdzanie przeglądu".

```bash
# Derive every path from the plan's own directory so this works at the
# repo root AND in a monorepo where context/changes/ lives under a
# workspace subtree (e.g. projects/<app>/context/changes/<id>/plan.md).
CHANGE_DIR=$(dirname "$PLAN")            # …/context/changes/<change-id>
CHANGE_ID=$(basename "$CHANGE_DIR")      # <change-id>
REVIEW_PATH="${CHANGE_DIR}/reviews/impl-review.md"
CHANGE_MD="${CHANGE_DIR}/change.md"
mkdir -p "${CHANGE_DIR}/reviews"

git config user.name "your-ai-coding-assistant[bot]"
git config user.email "41898282+your-ai-coding-assistant[bot]@users.noreply.github.com"

git add "$REVIEW_PATH" "$CHANGE_MD"
git commit -m "chore(review): impl-review for ${CHANGE_ID} [skip ci]

CI-generated implementation review.
Pull this branch and triage locally."

# Belt-and-suspenders: verify [skip ci] made it onto the commit before
# pushing. If the subject is missing the marker (e.g., a rebase or an
# amend stripped it), the push would retrigger this same workflow on
# the bot's own HEAD. Abort loudly — a failed push is recoverable via
# the PUSH_FAILED fallback below; a recursion loop isn't.
if ! git log -1 --format=%s | grep -Fq '[skip ci]'; then
  echo "ERROR: HEAD commit subject is missing [skip ci] — refusing to push to prevent workflow recursion" >&2
  exit 1
fi

# Retry once on concurrent-push race (common on active PRs)
git push || { git pull --rebase && git push; } || PUSH_FAILED=1

if [ "$PUSH_FAILED" = "1" ]; then
  # Don't lose the work — inline the report in a PR comment as a fallback.
  gh pr comment "$PR_NUMBER" --body "$(printf '⚠️ impl-review generated but push failed (branch moved). Report content below:\n\n<details><summary>Click to expand</summary>\n\n\`\`\`markdown\n%s\n\`\`\`\n\n</details>' "$(cat "$REVIEW_PATH")")"
  exit 0
fi
```

**Znacznik `[skip ci]` jest nośny.** Bez niego push ponownie uruchamia ten sam workflow i tworzy pętlę. Zawsze go dołączaj.

**Idempotencja: nie zmieniaj, zawsze twórz nowy commit.** Jeśli ten workflow zostanie ponownie uruchomiony (np. ponowne uruchomienie z interfejsu GHA lub późniejszy push go ponownie uruchomi), plik przeglądu w tej samej ścieżce zostanie nadpisany, a nowy commit zarejestruje nowy przegląd. Poprzednie przeglądy pozostają w historii Git — to jest ścieżka audytu. Zmiana usunęłaby je.

## Krok 8: Opublikuj wierszowe komentarze przeglądowe

Zaktualizuj aktywną formę bieżącego zadania na "Publikowanie przeglądu wierszowego".

Wnioski, których `Location` to konkretny `plik:wiersz` **i** których wiersz znajduje się w różnicy PR, stają się wierszowymi komentarzami przeglądowymi — zakotwiczonymi do dokładnego wiersza w zakładce "Zmienione pliki". Wnioski bez kotwicy wiersza (lub których wiersz znajduje się poza różnicą) są odkładane do komentarza podsumowującego w następnym kroku.

**Użyj narzędzia MCP, a nie `gh api`.** Akcja Twojego asystenta kodowania AI w wersji 1 udostępnia `mcp__github_inline_comment__create_inline_comment` za pośrednictwem wbudowanego serwera MCP. Zawija ona punkt końcowy dla każdego komentarza (`POST /pulls/:n/comments`), który zgłasza błędy **głośno** w przypadku złych pozycji wierszy — w przeciwieństwie do punktu końcowego przeglądu wsadowego, który cicho odrzuca nieprawidłowe wpisy i pozostawia pustą powłokę przeglądu. Opublikuj każde ustalenie jako oddzielne wywołanie narzędzia, z `confirmed: true`, aby klasyfikator Haiku akcji nie buforował, a następnie filtrował (odpowiednie dla deterministycznego recenzenta CI — każde ustalenie, które emitujemy, jest już decyzją triage).

### Rozwiąż URL pliku przeglądu

Treści komentarzy wierszowych odsyłają do zatwierdzonego raportu w celu uzyskania pełnego uzasadnienia Siły / Kompromisu / Pewności / Martwego punktu. Zbuduj `REVIEW_URL` na podstawie właśnie wypchniętego commita:

```bash
SHA=$(git rev-parse HEAD)
REVIEW_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/blob/${SHA}/${REVIEW_PATH}"
```

### Klasyfikuj wnioski: wierszowe vs. tylko podsumowanie

API GitHub Reviews odrzuca komentarze do wierszy, które nie znajdują się w różnicy, więc zweryfikuj przed opublikowaniem. Dla każdego ustalenia przeanalizuj `Location`; jeśli jest to `plik:wiersz`, sprawdź, czy `wiersz` znajduje się w bloku `+` dla `pliku`:

```bash
line_in_diff() {
  local file="$1" line="$2"
  git diff --unified=0 "origin/${BASE}...HEAD" -- "$file" \
    | awk -v target="$line" '
        /^@@/ {
          match($0, /\+([0-9]+)(,([0-9]+))?/, m);
          start = m[1]; count = (m[3] == "" ? 1 : m[3]);
          if (target >= start && target < start + count) { found = 1; exit }
        }
        END { exit !found }
      '
}
```

Skieruj każde ustalenie:

- **kwalifikujące się do wiersza** → `Location` ma `plik:wiersz`, `plik` znajduje się w różnicy PR, a `line_in_diff` zwraca true.
- **tylko podsumowanie** → cokolwiek innego: brak kotwicy wiersza, plik nie znajduje się w różnicy lub wiersz poza blokami różnicy (częste dla BRAKUJĄCEGO TESTU, BRAKUJĄCEJ IMPLEMENTACJI i ustaleń na poziomie wymiaru).

Śledź liczniki: `N_INLINE`, `N_SUMMARY_ONLY`. Krok 9 używa obu w nagłówku podsumowania.

### Skomponuj treść każdego komentarza wierszowego

Zachowaj czytelność treści wierszowych — recenzenci czytają je szybko podczas przewijania różnicy. Jednowierszowy tag ważności, tytuł, szczegóły, jednowierszowe podsumowanie poprawki, link do pełnego raportu. Zakończ **niewidocznym znacznikiem**, aby następne uruchomienie mogło znaleźć i usunąć ten komentarz podczas zastępowania:

```markdown
❌ **KRYTYCZNE** · Bezpieczeństwo i jakość · **F1 — Zapytanie SQL zbudowane z konkatenacji ciągów**

Plan określał sparametryzowane zapytania w Fazie 2; rzeczywista implementacja używa literałów szablonowych.

**Poprawka:** Zastąp literał szablonowy sparametryzowanym zapytaniem za pomocą `db.query($1, [value])`.

_Zobacz [pełny raport](<REVIEW_URL>) dla uzasadnienia (Siła / Kompromis / Pewność / Martwy punkt)._

<!-- impl-review-ci:marker -->
```

Znacznik musi być obecny w **każdej** treści komentarza wierszowego — w ten sposób sekcja "Wyczyść poprzednie uruchomienie" poniżej identyfikuje artefakty do usunięcia. Pełna gramatyka opcji naprawy (Siła / Kompromis / Pewność / Martwy punkt) pozostaje w zatwierdzonym pliku raportu — umieszczenie jej w wierszu zaśmieca widok różnicy i duplikuje zawartość.

### Opublikuj każde ustalenie za pomocą narzędzia MCP

**Przed** pierwszym wywołaniem MCP, przechwyć znacznik czasu UTC — sekcja czyszczenia poniżej używa go do odróżnienia "komentarzy z poprzednich uruchomień" od tych, które właśnie tworzysz:

```bash
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

Dla każdego ustalenia kwalifikującego się do wiersza, wywołaj `mcp__github_inline_comment__create_inline_comment` **raz**. Wywołanie jest synchroniczne — publikuje natychmiast, gdy `confirmed: true` jest ustawione. Śledź sukcesy i porażki dla każdego ustalenia:

```
mcp__github_inline_comment__create_inline_comment({
  path: "<finding.file>",
  line: <finding.line>,
  side: "RIGHT",            // comment on the new version; LEFT is only for deleted lines
  confirmed: true,           // skip the Haiku classifier buffer — we're deterministic
  body: "<composed body incl. marker>"
})
```

Dlaczego `confirmed: true`: domyślnie akcja buforuje niepotwierdzone wywołania, przepuszcza je przez klasyfikator Haiku ("czy to prawdziwy przegląd, czy test?") i publikuje tylko te prawdziwe w kroku końcowym. Jest to przydatne w konwersacyjnych przepływach przeglądu, gdzie asystent AI eksploruje. W przypadku tej umiejętności każde ustalenie jest już decyzją triage — chcemy, aby były publikowane tak, jak są, synchronicznie, aby krok sprawdzania werdyktu workflow widział stan końcowy.

**Śledź wyniki:**

- Każde udane wywołanie → zwiększ `N_INLINE_POSTED`.
- Każda awaria → zmniejsz planowaną liczbę, zapisz plik:wiersz i dodaj ustalenie do listy tylko podsumowania, aby nadal docierało do recenzentów. Nie próbuj ponownie — komunikat o błędzie narzędzia MCP powie Ci, dlaczego (wiersz wyszedł poza różnicę, plik został zmieniony, przejściowy problem z API), a ponowne próby rzadko pomagają.
- Jeśli **każde** wywołanie wierszowe zakończyło się niepowodzeniem: ustaw `INLINE_POST_FAILED=1`. Ścieżka awaryjna Kroku 9 pokazuje wszystkie ustalenia w komentarzu podsumowującym z widocznym ostrzeżeniem.

Po zwróceniu wszystkich wywołań dla poszczególnych ustaleń, ustaw `N_INLINE = N_INLINE_POSTED` i ponownie sklasyfikuj nieudane ustalenia wierszowe jako tylko podsumowanie. Krok 9 używa ostatecznych liczników.

**Nie używaj `gh api POST /pulls/:n/reviews` z tablicą `comments[]`.** Ten punkt końcowy cicho odrzuca komentarze, których wiersz nie znajduje się w prawidłowej pozycji bloku różnicy — kończysz z pustą powłoką przeglądu i zerem zakotwiczonych komentarzy. Narzędzie MCP używa punktu końcowego dla każdego komentarza, który głośno zgłasza błędy, dzięki czemu wiemy, które ustalenie się nie powiodło i dlaczego.

**Pomiń całą podsekcję, jeśli `N_INLINE == 0`** — brak ustaleń kwalifikujących się do wiersza, nic do opublikowania. Krok 9 renderuje wszystko jako tylko podsumowanie.

### Wyczyść wierszowe komentarze z poprzedniego uruchomienia

Tylko po tym, jak co najmniej jedno wywołanie MCP **powiodło się** w tym uruchomieniu — usuń poprzednie wierszowe komentarze bota zidentyfikowane przez znacznik. Celowe jest najpierw opublikowanie nowych, a następnie usunięcie starych: jeśli wszystkie nowe posty się nie powiodły, poprzednie komentarze pozostają widoczne, aby recenzenci nie zostali z niczym.

Przechwyć `NOW_ISO` **przed** pierwszym wywołaniem MCP, aby niezawodnie poprzedzało każdy komentarz, który właśnie utworzono; użyj go poniżej, aby wykluczyć te komentarze z listy do usunięcia.

```bash
# NOW_ISO was captured earlier, before the first create_inline_comment call:
#   NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ "$N_INLINE_POSTED" -gt 0 ]; then
  gh api --paginate "repos/{owner}/{repo}/pulls/${PR_NUMBER}/comments" \
    --jq ".[] | select(.body | contains(\"<!-- impl-review-ci:marker -->\")) | select(.created_at < \"${NOW_ISO}\") | .id" \
    | while read -r COMMENT_ID; do
        gh api --method DELETE \
          "repos/{owner}/{repo}/pulls/comments/${COMMENT_ID}" 2>/dev/null || true
      done
fi
```

`|| true` przy usuwaniu jest celowe — przejściowa awaria API przy jednym komentarzu nie powinna przerywać czyszczenia reszty. Pozostałe elementy zostaną usunięte przy następnym uruchomieniu.

**Dlaczego `created_at < NOW_ISO` zamiast przechwytywania identyfikatorów komentarzy nowego przeglądu?** Prostsze i odporne na wyścigi, w których POST się powiódł, ale kształt odpowiedzi API się zmienia. Każdy komentarz utworzony przed "teraz" jest z definicji z poprzedniego uruchomienia.

### Awaria nie jest krytyczna

Awarie MCP dla poszczególnych ustaleń (wiersz wyszedł poza różnicę, plik został zmieniony, przejściowy problem z API) są już obsługiwane powyżej — nieudane ustalenie przenosi się do tylko podsumowania. Jedynym pozostałym katastrofalnym przypadkiem jest niepowodzenie **wszystkich** wywołań wierszowych, co ustawia `INLINE_POST_FAILED=1`:

- Jeśli `INLINE_POST_FAILED=1`, Krok 9 zawiera **wszystkie** ustalenia w komentarzu podsumowującym z ostrzeżeniem na górze: `⚠️ Publikowanie przeglądu wierszowego nie powiodło się; wszystkie ustalenia pokazane poniżej.`
- W przeciwnym razie Krok 9 wyświetla tylko ustalenia tylko podsumowania (wierszowe znajdują się w różnicy).

Nigdy nie wychodź z workflow z kodem innym niż zero z powodu awarii publikowania wierszowego — raport jest zatwierdzony, podsumowanie zostanie opublikowane, recenzenci nadal mają wszystko. Głośne ostrzeżenie jest lepsze niż czerwony workflow.

## Krok 9: Opublikuj podsumowujący komentarz do PR

Zaktualizuj aktywną formę bieżącego zadania na "Publikowanie komentarza podsumowującego".

Zatwierdzony plik zawiera pełne szczegóły; komentarze wierszowe kotwiczą ustalenia do konkretnych wierszy; to podsumowanie jest czytelnym punktem wejścia w osi czasu PR — werdykt, tabela wymiarów i wszelkie ustalenia, których nie można było opublikować w wierszu.

### Skomponuj i opublikuj

Sekcje treści (w kolejności): baner bramki ODRZUCONO (warunkowo), nagłówek werdyktu, linki do planu + pliku przeglądu, liczniki wierszowe/podsumowujące, notatka awaryjna (warunkowo), tabela wymiarów, lista ustaleń (warunkowo), wiersz zamykający, **znacznik**:

```bash
# REJECTED verdict → prepend a visible gate banner. The workflow step
# after your AI coding assistant-action reads the verdict from the committed report
# and fails the check; the banner tells reviewers what to do.
if [ "$OVERALL_VERDICT" = "REJECTED" ]; then
  REJECTION_BANNER=$'> ⛔ **This check will fail** because the verdict is `REJECTED`.\n> Add the `impl-review-override` label to the PR to bypass after reviewing the findings.\n\n'
else
  REJECTION_BANNER=""
fi

if [ "$INLINE_POST_FAILED" = "1" ]; then
  # Inline post failed — show all findings in the summary as fallback.
  FINDINGS_FOR_SUMMARY_MARKDOWN="$ALL_FINDINGS_MARKDOWN"
  FINDINGS_SECTION_HEADER="### All findings"
  FAILURE_NOTE=$'⚠️ Inline review failed to post; all findings shown below.\n\n'
  INLINE_LINE="**Inline comments:** failed to post — see findings below"
else
  # Inline succeeded — summary shows only findings that couldn't be anchored.
  FINDINGS_FOR_SUMMARY_MARKDOWN="$SUMMARY_ONLY_FINDINGS_MARKDOWN"
  FINDINGS_SECTION_HEADER="### Findings without a line anchor"
  FAILURE_NOTE=""
  INLINE_LINE="**Inline comments:** ${N_INLINE} posted on changed lines · ${N_SUMMARY_ONLY} without line anchor (below)"
fi

# Capture cutoff for prior-comment cleanup below.
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

gh pr comment "$PR_NUMBER" --body "$(cat <<EOF
## 🔍 Implementation Review (CI)

${REJECTION_BANNER}**Verdict:** \`${OVERALL_VERDICT}\` — ${N_CRITICAL} critical, ${N_WARNINGS} warnings, ${N_OBSERVATIONS} observations
**Plan:** \`${PLAN}\`
**Review file:** [${REVIEW_PATH}](${REVIEW_URL})
${INLINE_LINE}

${FAILURE_NOTE}| Dimension | |
|---|---|
| Plan Adherence | ${V_PLAN} |
| Scope Discipline | ${V_SCOPE} |
| Safety & Quality | ${V_SAFETY} |
| Architecture | ${V_ARCH} |
| Pattern Consistency | ${V_PATTERN} |
| Test Coverage | ${V_TESTS} |
| Success Criteria | ${V_SUCCESS} |

${FINDINGS_SECTION_HEADER}

${FINDINGS_FOR_SUMMARY_MARKDOWN}

---

Pull this branch to see the full review at \`${REVIEW_PATH}\` and triage findings locally.

<!-- impl-review-ci:marker -->
EOF
)" && SUMMARY_POSTED=1
```

Renderuj każde ustalenie z listy podsumowania jako jedną zwięzłą linię (bez szczegółów opcji naprawy — to jest w pliku):

```
- **F3** `WARNING` · Test Coverage · `src/api/routes.ts` — new `/status` endpoint has no test. Plan listed `pnpm test -- src/api/routes.test.ts` in Success Criteria but that file wasn't modified.
- **F5** `CRITICAL` · Plan Adherence · _(no file)_ — migration in Phase 3 is missing from the diff entirely.
```

Ogranicz listę podsumowania do 5. Jeśli istnieje więcej, dodaj `…i N więcej w pełnym raporcie.`

### Wyczyść komentarz podsumowujący z poprzedniego uruchomienia

Ten sam wzorzec post-new-then-delete-old co czyszczenie wierszowe. Usuń poprzednie podsumowania tylko wtedy, gdy nowe zostało pomyślnie opublikowane:

```bash
if [ "$SUMMARY_POSTED" = "1" ]; then
  gh api --paginate "repos/{owner}/{repo}/issues/${PR_NUMBER}/comments" \
    --jq ".[] | select(.body | contains(\"<!-- impl-review-ci:marker -->\")) | select(.created_at < \"${NOW_ISO}\") | .id" \
    | while read -r COMMENT_ID; do
        gh api --method DELETE \
          "repos/{owner}/{repo}/issues/comments/${COMMENT_ID}" 2>/dev/null || true
      done
fi
```

Zwróć uwagę na różnicę w punkcie końcowym: komentarze podsumowujące na karcie Konwersacja znajdują się pod `/issues/:n/comments` (komentarze podsumowujące PR są w rzeczywistości problemami GitHub), podczas gdy wierszowe komentarze przeglądowe w Kroku 8 znajdują się pod `/pulls/:n/comments`.

### Przypadki brzegowe

- `N_SUMMARY_ONLY == 0` i `INLINE_POST_FAILED == 0` → całkowicie pomiń sekcję "Ustalenia bez kotwicy wiersza". Werdykt + tabela wymiarów + liczba wierszowa wystarczy; brak pustej listy.
- `N_INLINE == 0` i `N_SUMMARY_ONLY == 0` → brak ustaleń w ogóle. Nadal opublikuj podsumowanie (tabela werdyktów potwierdza PASS we wszystkich wymiarach); pomiń sekcję ustaleń.

Oznacz zadanie przeglądu CI jako `completed`. Skończyłeś — krok sprawdzania werdyktu workflow (po akcji Twojego asystenta kodowania AI) odczytuje werdykt z zatwierdzonego raportu i kończy sprawdzanie niepowodzeniem, gdy `REJECTED`, respektując etykietę `impl-review-override`.

## Uwagi operacyjne

- **Znacznik raportu jest nośny.** Komentarz `<!-- IMPL-REVIEW-REPORT -->` w pierwszym wierszu i pola `Decision: PENDING` dla każdego ustalenia to umowa wyjściowa z narzędziami downstream. Nie zmieniaj ich kształtu.
- **Nigdy nie edytuj kodu źródłowego.** Wszystkie zmiany kodu przepływają przez oddzielny etap implementacji po triage. Umiejętność przeglądu czyta, analizuje i zapisuje raport — nic więcej.
- **Przegląd wierszowy jest doradczy, nigdy blokujący.** Narzędzie MCP tworzy komentarze przeglądowe (za pośrednictwem `POST /pulls/:n/comments`), a nie formalne decyzje przeglądowe PR — więc nie ma powierzchni `event: APPROVE` / `REQUEST_CHANGES`, na której umiejętność mogłaby się potknąć. Jeśli przyszła wersja kiedykolwiek złoży formalny przegląd, musi użyć `event: COMMENT`: umiejętność nie ma podstaw do zatwierdzania, a żądanie zmian jest decyzją ludzkiego zarządzania. Bramka ODRZUCONO — która *jest* blokująca — znajduje się w kroku sprawdzania werdyktu workflow, a nie w żadnym zgłoszeniu przeglądu po stronie asystenta kodowania AI.
- **Werdykt `REJECTED` jest sygnałem blokującym.** Krok po przeglądzie workflow analizuje werdykt z zatwierdzonego pliku raportu (`- **Werdykt**: REJECTED`) i kończy działanie z kodem innym niż zero, chyba że PR ma etykietę `impl-review-override`. To **jedyny** sposób, w jaki ta umiejętność kończy sprawdzanie niepowodzeniem — sama umiejętność kończy działanie z kodem 0, nawet jeśli werdykt to REJECTED, ponieważ bramka znajduje się w workflow, a nie w turze asystenta AI. To rozdzielenie ma znaczenie: awaria po stronie asystenta AI również pominęłaby komentarz PR i wprowadziłaby recenzentów w błąd; bramka po stronie workflow kończy działanie czysto po opublikowaniu wszystkich artefaktów.
- **Znacznik deduplikacji jest nośny.** Każda treść komentarza wierszowego i komentarz podsumowujący kończą się `<!-- impl-review-ci:marker -->`. Następne uruchomienie używa tego znacznika do znajdowania i usuwania poprzednich artefaktów, zapobiegając ich gromadzeniu się podczas ponownych uruchomień. Czyszczenie odbywa się w kolejności post-new-then-delete-old: jeśli nowy post się nie powiedzie, poprzedni artefakt pozostaje widoczny, aby recenzenci nigdy nie widzieli zerowego pokrycia.
- **Nie wyświetlaj sekretów.** Subagenci są tylko do odczytu/grep/bash, ale mimo to: nigdy nie wrzucaj zmiennych środowiskowych do raportu lub komentarza. Jeśli ustalenie odnosi się do wyciekłego sekretu (zakodowany na stałe token, poświadczenie w kodzie), zredaguj rzeczywistą wartość — napisz `<ZREDAKOWANY token pasujący do wzorca X>`, a nie dosłowny ciąg.
- **Koszt uruchamiania testów.** Agent 3 uruchamia polecenia testowe planu. W przypadku dużych zestawów jest to czasochłonne. Jeśli projekt chce pominąć wykonanie dla konkretnych zestawów, plan powinien pominąć te polecenia z automatycznej weryfikacji — ta umiejętność uruchamia tylko to, co deklaruje plan, więc plan jest powierzchnią kontrolną.
- **Niestandardowy kształt planu.** Jeśli plik planu istnieje, ale nie odpowiada oczekiwanej anatomii (brak kryteriów sukcesu, brak wymaganych zmian itp.), przeprowadź przegląd z tym, co możesz wyodrębnić, i zanotuj luki strukturalne w raporcie. Nie odmawiaj uruchomienia — częściowy sygnał jest lepszy niż brak sygnału.
- **Budżety tokenów subagentów.** Trzech subagentów pracuje równolegle, więc główny kontekst pozostaje oszczędny — zawiera tylko tekst planu, podsumowanie różnicy i ostateczny raport ustaleń każdego agenta. Jeśli raport subagenta staje się nieporęczny, poproś go o zwrócenie tylko najważniejszych ustaleń, które zidentyfikował, a nie pełnego śledzenia dochodzenia.