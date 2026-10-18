---
name: cx-flow-map
description: Zmiany mapy przepływu (mapa.html, swimlane punktów styku) w CX Journey Experience - układ kart, kolumn, torów i podkolumn, trasy krawędzi i powrotów, groty, kolory torów, animacja kierunku, zoom/pan, szuflada, tryb przypadku i krok po kroku (Start/Dalej/Wstecz), lista na mobile. Używaj zawsze, gdy zmieniasz js/flow-core.js, js/flow-layout.js, js/flow-map.js, css/flow.css albo mapa.html, oraz gdy użytkownik mówi o „mapie przepływu”, „liniach”, „strzałkach”, „powrotach”, „torach”, „przypadku klienta” lub „swimlane”, nawet jeśli nie podaje nazwy pliku.
---

# Mapa przepływu (cx-experience)

Skill wskazuje, w którym pliku leży każda odpowiedzialność mapy, i zbiera uzgodnione reguły wyglądu, żeby nowa zmiana ich po cichu nie cofnęła. Zmiany w danych mapy (`macierz-demo.xlsx`, konwerter, nowe tory i stany) prowadź według skilla `cx-data-update`. Ten skill obejmuje ich rysowanie.

## Gdzie co zmieniać

| Plik | Odpowiedzialność | Nie wkładaj tu |
|---|---|---|
| `js/flow-core.js` (`CX.flowCore`) | tory (`laneOf`, `lanes`), walidacja `CX_FLOW` (błąd przez `fail`, ostrzeżenia zwracane z `validate`), cykle | DOM, geometrii |
| `js/flow-layout.js` (`CX.flowLayout`) | deterministyczny układ w jednostkach SVG: kolumny = procesy, pasy = tory, podkolumny, trasy krawędzi (`d`), pozycje etykiet. Parametry w `DEFAULTS` | DOM, CSS, kolorów. Zależy tylko od `CX.flowCore` |
| `js/flow-map.js` | rysowanie SVG i listy mobile, zoom/pan (`view`, `clampView`, `keepScreenScale`), podświetlenia, szuflada, tryb przypadku i stepper, znaki stanów (`stateMarks`) | obliczeń układu, które da się przetestować w Node |
| `css/flow.css` | kolory torów `--lane-0…5` i stanów `--st-*`, wygląd kart, linii i animacji, breakpoint 850 px, reduced-motion | wartości zależnych od konkretnego punktu |
| `data/flow.js` | generowany z xlsx; zmiany danych przez skill `cx-data-update` | — |

Geometrię zmieniaj w `flow-layout.js`, bo tam ją sprawdza `tools/test-flow-layout.js`. Kod rysujący w `flow-map.js` ma tylko konsumować wynik `compute()`.

## Utrwalone decyzje (nie cofaj bez prośby)

- **Karty** jednolinijkowe 208×30, pełny tytuł w nakładce po najechaniu (`showFull`), bez zmiany kolejności DOM.
- **Kolumny i podkolumny**: kolumna to proces w kolejności `matrix.processes`. Kroki jednego procesu połączone krawędzią „do przodu” idą w podkolumny w prawo (max `maxSub` = 3), a nie w pionie.
- **Krawędzie w przód** wychodzą z prawego boku źródła i wchodzą w lewy bok celu, z prostym odcinkiem `LEAD` przed grotem (grot leży prosto). Wyjątek: sąsiednie karty w tej samej komórce łączy krótki pionowy łącznik.
- **Powroty** (wstecz albo odległa karta w tej samej kolumnie) są prostokątne: wyjście z prawej, wejście z lewej, pion w korytarzach między kolumnami, poziom w kanale u góry pasa. Pasma przydziela się zachłannie bez nakładania, a trasy do tego samego celu łączą się w jedną linię. Powroty są ukryte (`.backward` w `css/flow.css`) i pokazują się tylko dla wybranego lub najechanego punktu. Bez łuków nad kartami.
- **Kolory**: linia ma kolor toru źródła (pasek przy nazwie toru, chipy, legenda). Kolorów torów nie bierz z palety ocen ani stanów: zieleń i czerwień znaczą „działa/nie działa”, dlatego drugi tor jest grafitowy, a nie zielony. Klas jest 6 (`% 6`).
- **Ruch**: świetlik z ogonem w kolorze toru (`animateMotion`, stała prędkość) pokazuje kierunek. Przy `prefers-reduced-motion` nie ma świetlika, pulsów ani jazdy kropki w trybie przypadku.
- **Widok**: przesuwanie ograniczone do obszaru mapy. Wysunięcie szuflady nie zmienia skali ani położenia mapy na ekranie. Fokus klawiaturą przesuwa mapę do węzła.
- **Tryb przypadku**: trasa klienta, znak i kolor stanu kroku, pominięte punkty przygaszone, podsumowanie z licznikami i komunikatem o krokach na ukrytych torach, szczegóły kroku w szufladzie. Stepper Start/Dalej/Wstecz centruje krok, a kropka jedzie po ostatnim odcinku.
- **Mobile (≤850 px)**: lista torów i procesów zamiast SVG, szczegóły jako szuflada.

Gdy użytkownik prosi o zmianę sprzeczną z którąś regułą, zrób ją, a w raporcie napisz, którą regułę zmieniasz.

## Jak pracować

1. **Test najpierw.** Regułę geometrii zapisz jako asercję w `tools/test-flow-layout.js` (wzór: `checkLayout` sprawdza granice, nakładanie, pas, kolumnę i NaN w `d`). Regułę danych zapisz w `tools/test-flow-core.js` (`throwsWith`). Testy ładują pliki przez `vm`, bez DOM.
2. **Zrzut przed zmianą**: `node .claude/skills/cx-regression/scripts/smoke.js --pages mapa --out <scratchpad>/przed`. Daje desktop, mobile, reduced-motion, szufladę i tryb przypadku.
3. Minimalna zmiana w jednym z plików z tabeli. Parametry odstępów zmieniaj w `DEFAULTS`, nie w stałych rozsianych po kodzie.
4. Uruchom `node --check` na zmienionych plikach oraz `node tools/test-flow-core.js` i `node tools/test-flow-layout.js`.
5. **Zrzut po zmianie** do `<scratchpad>/po`. Porównaj narzędziem Read pary `mapa-desktop.png`, `mapa-desktop-drawer.png`, `mapa-desktop-case.png` i `mapa-mobile.png`. Stanów po najechaniu smoke nie fotografuje. Gdy zmiana ich dotyczy, sprawdź je osobnym krótkim skryptem Playwright w scratchpadzie (`page.hover('.flow-node')`), wzorując się na `smoke.js`.
6. Reszta regresji i raport według skilla `cx-regression`.

Liczby torów, kolumn, punktów i krawędzi wynikają z danych. Nie koduj ich ani nie opieraj logiki na ID przykładowych punktów (AGENTS.md §3).
