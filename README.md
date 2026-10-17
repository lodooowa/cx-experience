# CX Journey Experience v3 — demo offline

## Uruchomienie

1. Rozpakuj całą paczkę ZIP. Nie otwieraj pliku HTML wewnątrz ZIP.
2. Otwórz `index.html` dwuklikiem w Microsoft Edge lub Google Chrome.
3. Dane ładują się lokalnie. Serwer, internet i instalacja nie są potrzebne.

## Co zawiera v3

- Jeden widok z mapą podróży, punktami styku, emocjami klienta i szczegółami wybranego punktu.
- Wybór persony, ścieżki i jawnie oznaczonej perspektywy obserwatora.
- Połączenia rozwidleń czytane z `branches.target`; wybór wariantu przechodzi do wskazanego touchpointu.
- Zwijany wykres emocji zsynchronizowany z wyborem punktu na mapie.
- Prawy panel szczegółów, który na desktopie zajmuje osobną kolumnę; Escape zamyka panel.
- Zachowane sceny SVG, automatyczne odtwarzanie, nawigacja klawiszami ← → i pełny ekran.
- Układ responsywny oraz obsługa `prefers-reduced-motion`.

## Struktura

```
index.html           układ i kolejność lokalnych skryptów
style.css            lokalne wejście do arkuszy CSS
css/tokens.css       tokeny wyglądu
css/layout.css       układ, komponenty i responsywność
app.js               walidacja, stan i interakcje
js/scenes.js         lokalne szablony scen SVG
data/personas.js     wyłącznie dane person
data/journeys.js     wyłącznie dane ścieżek i touchpointów
COPILOT.md           instrukcje edycji danych
matrix.html, priorytety.html, radar.html, mapa.html   widoki macierzy (dane z xlsx, patrz macierz.md)
```

## Zmiana danych

Ekspert CX edytuje wyłącznie `data/personas.js` i `data/journeys.js`. Pliki zawierają JSON opakowany pojedynczym przypisaniem JavaScript, np.:

```
window.CX_JOURNEYS = [ ... ];
```

Zachowaj przypisanie i końcowy średnik. `file://` nie korzysta z `fetch()` ani z zewnętrznych zasobów.

### Pola ścieżki i punktu

- Ścieżka: `id`, `personaId`, `title`, opcjonalne `subtitle` i lista `steps`.
- Punkt styku: unikalne `id`, `title`, opcjonalne `description`, `short`, `type`, `scene`, `emotion`, `owner`, `quote`, `insight`, `action`, `branches` oraz opisy w panelu szczegółów: `attention` (na co zwrócić uwagę, lista), `emotionImpact` (wpływ na emocje klienta, tekst), `avoid` (jakich błędów unikać, lista) i `risks` (potencjalne ryzyka, lista).
- `type`: `standard`, `critical`, `success` lub `choice`.
- `scene`: `audio`, `web`, `configurator`, `alert`, `dealer`, `drive`, `message`, `calendar`, `options` lub `document`. Pominięta scena ma neutralny fallback.
- `emotion`: opcjonalna liczba 1–5. Brak wartości oznacza brak markera emocji — aplikacja nie uzupełnia jej automatycznie.
- `branches`: opcjonalna lista `{ "label": "Wariant", "target": "id-punktu" }`. Cel musi istnieć w tej samej ścieżce. Wybranie wariantu w szczegółach aktywuje wskazany punkt. Przyciski poprzedni/następny i odtwarzanie zachowują kolejność prezentacji `steps`.
- `owner`: lista obszarów odpowiedzialności; nie określa perspektywy obserwatora ani udziału procentowego.

### Perspektywy obserwatora

Obecne przykładowe dane udostępniają wyłącznie perspektywę klienta. Aplikacja nie wyprowadza opisów dealera ani importera z `owner`.

Aby włączyć dodatkową perspektywę w danej ścieżce, każdy jej punkt musi zawierać opis dla tej samej roli, np.:

```
"perspectives": {
  "dealer": { "title": "...", "description": "...", "insight": "..." }
}
```

Obsługiwane role to `dealer` i `importer`. Dodawaj je wyłącznie na podstawie treści eksperta CX. Emocje pozostają oceną klienta niezależnie od wybranej perspektywy.

### Sceny

Sceny są szablonami wizualnymi. Dodanie nowej ścieżki, punktu, typu lub gałęzi w obsługiwanym schemacie nie wymaga zmiany renderera. Nowy rodzaj sceny wymaga osobnej zmiany technicznej.

## Widoki macierzy punktów styku (DEMO)

Osobne strony na wspólnym modelu danych, otwierane dwuklikiem (offline):

- `matrix.html`: heatmapa procesów i tryb omawiania,
- `priorytety.html`: mapa koszt × zysk akcji naprawczych,
- `radar.html`: radar podróży klienta,
- `mapa.html`: mapa przepływu (swimlane: tory = wykonawcy, kolumny = procesy, krawędzie = kolejne kroki). Lista „Przypadek” podświetla trasę klienta z `data/flow.js` (stan kroku: znak i kolor, pominięte punkty przygaszone).

Dane tych widoków nie są edytowane ręcznie: źródłem jest `macierz-demo.xlsx`. Po zmianie zamknij Excela i kliknij `konwertuj-dane.command` (macOS) albo `konwertuj-dane.bat` (Windows); skrypt (Python 3) zapisze `macierz-demo/*.csv`, `data/matrix.js` i `data/flow.js`. Szczegóły zakładek, torów i przypadków: `macierz.md`.

Testy (node/Python, bez zależności): `node tools/test-flow-core.js`, `node tools/test-flow-layout.js`, `python3 tools/test-xlsx-to-data.py`.

## Kontrola po zmianie danych

1. Otwórz `index.html` dwuklikiem i sprawdź, czy pojawia się wybrana persona oraz jej ścieżki.
2. Wybierz różne punkty na mapie i sprawdź panel szczegółów.
3. Sprawdź gałęzie ścieżki, jeśli występują.
4. Zwiń i rozwiń emocje; wybierz punkty mapy i wykresu.
5. Sprawdź brakujące emocje, długie teksty oraz wąski ekran.

Wszystkie przykładowe treści są demonstracyjne. Aplikacja nie pobiera danych, fontów ani grafik z internetu.
