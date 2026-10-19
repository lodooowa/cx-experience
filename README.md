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
style.css            lokalne wejście do arkuszy CSS (tokens, layout)
css/tokens.css       tokeny wyglądu
css/layout.css       układ, komponenty i responsywność
app.js               walidacja, stan i interakcje
js/scenes.js         lokalne szablony scen SVG
data/personas.js     wyłącznie dane person
data/journeys.js     wyłącznie dane ścieżek i touchpointów
COPILOT.md           instrukcje edycji danych

Widoki macierzy (dane z xlsx, patrz macierz.md):
matrix.html, priorytety.html, radar.html, mapa.html   strony widoków
css/matrix.css       wspólne style widoków; osobno priorities.css, radar.css, flow.css
js/matrix-core.js    wspólny model danych (CX.mx)
js/matrix.js, priorities.js, radar.js   logika poszczególnych widoków
js/flow-core.js, flow-layout.js, flow-map.js   graf, układ i rysowanie mapy przepływu
data/matrix.js, data/flow.js   GENEROWANE z macierz-demo.xlsx, nie edytować ręcznie
macierz-demo.xlsx, macierz-demo/*.csv   źródło danych i eksport CSV
tools/               konwerter xlsx, seed xlsx i testy
konwertuj-dane.bat, konwertuj-dane.command   dwuklik: uruchamia konwerter
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
- `cj.html`: podróż klienta (Customer Journey): wykres emocji −5…+5 po punktach styku w krokach i etapach, pain pointy, drzewo pain point → root cause → inicjatywa oraz krzywe prognozy po Quick Wins, Mid i Long Term. Dane z `macierz_CX.xlsx` przez `python3 tools/cj-xlsx-to-data.py` (→ `data/cj.js`); kolumny prognozy (`Po Quick Wins`, `Po Mid Term`, `Po Long Term`, `Status prognozy`, `Initiative ID`) w zakładce `Macierz CX` są przykładowe (DEMO) do czasu uzupełnienia przez eksperta,
- `mapa.html`: mapa przepływu (swimlane: tory = wykonawcy, kolumny = procesy, krawędzie = kolejne kroki). Lista „Przypadek” podświetla trasę klienta z `data/flow.js` (stan kroku: znak i kolor, pominięte punkty przygaszone); przyciski Start/Dalej/Wstecz prowadzą krok po kroku (mapa przesuwa się do punktu, kropka jedzie po trasie; bez ruchu przy `prefers-reduced-motion`).

Dane tych widoków nie są edytowane ręcznie: źródłem jest `macierz-demo.xlsx`. Po zmianie zamknij Excela i kliknij `konwertuj-dane.command` (macOS) albo `konwertuj-dane.bat` (Windows); skrypt (Python 3) zapisze `macierz-demo/*.csv`, `data/matrix.js` i `data/flow.js`. Szczegóły zakładek, torów i przypadków: `macierz.md`.

**Windows bez Pythona:** pobierz [python-3.13.9-embed-amd64.zip](https://www.python.org/ftp/python/3.13.9/python-3.13.9-embed-amd64.zip) (przenośny Python, ok. 10 MB, bez instalacji) i rozpakuj go do folderu `tools\python`, tak aby powstał plik `tools\python\python.exe`. `konwertuj-dane.bat` użyje go w pierwszej kolejności, przed Pythonem z systemu. Folder jest w `.gitignore`, więc zip nie trafia do repozytorium. Skrypt używa tylko biblioteki standardowej, więc nic więcej nie trzeba doinstalowywać.

Testy (node/Python, bez zależności): `node tools/test-flow-core.js`, `node tools/test-flow-layout.js`, `python3 tools/test-xlsx-to-data.py`.

## Synchronizacja z GitHubem (Windows)

Pierwsza paczka trafia do użytkownika mailem (zip), kolejne zmiany idą przez GitHuba (repozytorium `lodooowa/cx-experience`, gałąź `main`). Użytkownik nie musi znać Gita: wystarczą dwa skrypty do kliknięcia w głównym folderze.

- `pobierz-zmiany.bat`: pobiera najnowszą wersję z GitHuba. Gdy folder nie jest jeszcze repozytorium, tworzy je i ustawia `main` na `origin/main`, nie nadpisując plików z zipa (różnice widać potem jako zmiany). Zmiany lokalne zostają zachowane.
- `wyslij-zmiany.bat`: zapisuje zmiany z folderu (pyta o krótki opis, Enter = „Aktualizacja danych”) i wysyła je na `main`. Gdy na GitHubie są nowsze, kolidujące zmiany, niczego nie wysyła i wyświetla komunikat.
- `tools/git-wspolne.bat`: wspólna część obu skryptów (wybór Gita, inicjalizacja, token).

**Git:** skrypty używają przenośnego `tools\PortableGit\cmd\git.exe`, a gdy go nie ma, Gita z systemu. PortableGit (archiwum `PortableGit-*-64-bit.7z.exe` ze strony git-scm.com/download/win) rozpakuj do `tools\PortableGit`, tak aby powstał plik `tools\PortableGit\cmd\git.exe`. Folder jest w `.gitignore`.

**Token:** autoryzacja idzie tokenem GitHub typu fine-grained, utworzonym na koncie `lodooowa`, ograniczonym do jednego repozytorium `cx-experience`, z uprawnieniem *Contents: Read and write*. Skrypt prosi o token przy pierwszym uruchomieniu i zapisuje go w `.git\cx-token` (poza historią repozytorium; nie dołączaj folderu `.git` do zipa wysyłanego dalej). Token trafia do Gita tylko jako adres przy `fetch`/`push`, bez zapisu w konfiguracji. Aby wpisać nowy token, usuń plik `.git\cx-token`. Commity ze skryptów mają autora `lodooowa-cx` (`lodooowa-cx@users.noreply.github.com`), więc łatwo je odróżnić od commitów właściciela: `git log --author=lodooowa-cx`.

## Kontrola po zmianie danych

1. Otwórz `index.html` dwuklikiem i sprawdź, czy pojawia się wybrana persona oraz jej ścieżki.
2. Wybierz różne punkty na mapie i sprawdź panel szczegółów.
3. Sprawdź gałęzie ścieżki, jeśli występują.
4. Zwiń i rozwiń emocje; wybierz punkty mapy i wykresu.
5. Sprawdź brakujące emocje, długie teksty oraz wąski ekran.

Wszystkie przykładowe treści są demonstracyjne. Aplikacja nie pobiera danych, fontów ani grafik z internetu.
