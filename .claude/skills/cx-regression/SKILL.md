---
name: cx-regression
description: Regresja offline CX Journey Experience przed oddaniem pracy - testy narzędzi, node --check i automatyczny smoke wszystkich stron (index, matrix, priorytety, radar, mapa) przez file:// w Chromium, z desktopem, mobile, reduced-motion, szufladą, Escape, zerem żądań sieciowych i zrzutami ekranu. Używaj zawsze, gdy w tym repo zmieniasz JS, CSS, HTML albo dane i masz powiedzieć, że działa, przed commitem, oraz gdy użytkownik prosi „sprawdź”, „przetestuj”, „regresja”, „czy nic się nie zepsuło”, „zrób screenshot”.
---

# Regresja offline (cx-experience)

Produkt działa z `file://` bez serwera i sieci (AGENTS.md §1, §3), a jego jedyne testy to skrypty w `tools/`, `node --check` i regresja z AGENTS.md §6. Ten skill składa je w jedną procedurę i dodaje automatyczny smoke w przeglądarce, żeby raport „działa” opierał się na wyniku, a nie na deklaracji.

## 1. Ustal zakres zmiany

```bash
git status --porcelain   # obejmuje zmiany w indeksie, w drzewie i nowe pliki
```

Dobierz najwęższy zestaw, który pokrywa zmianę (pełny zestaw puść raz, po ostatniej zmianie):

| Zmienione pliki | Testy | Smoke |
|---|---|---|
| `js/flow-*.js`, `css/flow.css`, `pages/mapa.html` | `node tools/test-flow-core.js`, `node tools/test-flow-layout.js` | `--pages mapa` |
| `tools/xlsx-to-data.py`, `macierz-demo.xlsx`, `data/matrix.js`, `data/flow.js`, `data/macierz-demo/*.csv` | `python3 tools/test-xlsx-to-data.py` + oba testy flow | wszystkie strony macierzy (`--pages matrix,priorytety,radar,mapa`) |
| `js/matrix-core.js`, `css/matrix.css`, `css/tokens.css` | — | `--pages matrix,priorytety,radar,mapa` (+ `index`, jeśli tokeny) |
| `js/matrix.js` / `priorities.js` / `radar.js` (+ ich CSS i HTML) | — | ta jedna strona |
| `js/cj*.js`, `css/cj.css`, `pages/cj.html`, `data/cj.js`, `data/cj-demo.js`, `tools/cj-xlsx-to-data.py`, `macierz_CX_demo.xlsx` | `node tools/test-cj-core.js` | `--pages cj` |
| `js/app.js`, `js/scenes.js`, `index.html`, `css/style.css`, `css/layout.css`, `data/personas.js`, `data/journeys.js` | — | `--pages index` |
| tylko `.md` | — | — (sprawdź odwołania do plików) |

Zawsze dodaj `node --check <plik>` dla każdego zmienionego `.js`.

## 2. Smoke w przeglądarce

```bash
node .claude/skills/cx-regression/scripts/smoke.js --out <scratchpad>/smoke [--pages index,mapa] [--profiles desktop,mobile,reduced]
```

Skrypt dla każdej strony i profilu (desktop 1440×900, mobile 390×844, desktop z `prefers-reduced-motion: reduce`):
- otwiera stronę przez `file://`, blokuje żądania `http(s)` i wykrywa WebSockety: każde takie połączenie to FAIL (wymóg zero sieci),
- sprawdza ukryty `#errorScreen` (widoki macierzy pokazują błędy danych tylko tam, bez `console.error`) i zero błędów konsoli,
- wybiera pierwszy punkt myszą, środkowy i ostatni klawiaturą (fokus + Enter): szuflada ma treść, Escape ją zamyka, na desktopie szuflada nie zachodzi na główny obszar,
- `index`: wszystkie persony × ścieżki mają punkty, tytuł w szczegółach zgadza się z punktem, wariant rozwidlenia zmienia punkt, panel emocji zwija się i rozwija przy widocznej mapie,
- `mapa`: tryb przypadku (podsumowanie, Start/Dalej, Wstecz, komunikat o kroku na ukrytym torze), brak `animateMotion` przy reduced-motion,
- mobile: brak poziomego przewijania strony,
- zapisuje zrzuty `<strona>-<profil>.png`, `-drawer.png`, `mapa-<profil>-case.png`.

Kod wyjścia: 0 = brak FAIL, 1 = jest FAIL, 2 = brak Playwrighta z Chromium. SKIP oznacza, że dane nie mają materiału do scenariusza (np. brak `branches` albo przypadków). To poprawny wariant danych, ale w raporcie napisz, że ten scenariusz nie został sprawdzony.

**Playwright** nie jest zależnością repo i nie dodawaj go do repo. Skrypt bierze moduł z `CX_PLAYWRIGHT` (ścieżka do katalogu `playwright`), potem przez zwykły `require`, potem z cache `~/.npm/_npx/*/node_modules/playwright`, jeśli taki istnieje na maszynie. Przy kodzie 2 spróbuj narzędzi Playwright MCP (skill `playwright`), a jeśli też nie działają, napisz w raporcie, że testu przeglądarkowego nie wykonano. Nie instaluj niczego bez zgody użytkownika.

Selektory w skrypcie (`PAGES` na górze pliku) odpowiadają obecnym ID w HTML. Gdy zmiana celowo zmienia strukturę strony (np. nowy widok, inny element punktu), zaktualizuj skrypt w tym samym commicie, zamiast ignorować FAIL.

## 3. Obejrzyj zrzuty

Smoke nie ocenia wyglądu. Otwórz narzędziem Read zrzuty stron, których dotyczy zmiana (desktop i mobile), i porównaj z oczekiwaniem: hierarchia, ucięte teksty, nakładanie, kontrast, czytelny wybór. Przy zmianie wyglądu porównaj zrzuty przed i po: uruchom smoke na `git stash` albo na poprzednim commicie do innego katalogu `--out`.

Pozostałe punkty AGENTS.md §6, których smoke nie obejmuje (perspektywa dealer/importer, gdy dane ją mają, dłuższe teksty, scenariusz krytyczny), sprawdź ręcznie, jeśli zmiana ich dotyczy.

## 4. Raport

Podaj komendy i liczby, np.:

```
node --check js/app.js                         OK
node tools/test-flow-core.js                OK
smoke --pages index                          N PASS, 0 FAIL, 0 SKIP (zrzuty: …/smoke)
```

Wprost wymień, czego nie sprawdzono. Zawsze poza zasięgiem jest prawdziwy Edge/Chrome na Windows w firmie, czcionki systemowe Windows (headless Linux może nie mieć niektórych glifów, np. ⛶), ekrany dotykowe i przepływ przez Copilot Chat. FAIL zgłaszaj z linią z wyjścia. Nie osłabiaj sprawdzeń skryptu, żeby przeszło.
