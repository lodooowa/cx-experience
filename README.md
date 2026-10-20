# CX Journey Experience v3 — demo offline

## Uruchomienie

1. Rozpakuj całą paczkę ZIP. Nie otwieraj pliku HTML wewnątrz ZIP.
2. Otwórz `index.html` dwuklikiem w Microsoft Edge lub Google Chrome. Od razu pokazuje się podróż klienta (`pages/cj.html`); pozostałe widoki są w menu „Więcej widoków”.
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
index.html           przekierowanie na pages/cj.html (widok główny)
pages/sciezki.html   ścieżki klienta (mapa podróży): układ i kolejność lokalnych skryptów
css/style.css        lokalne wejście do arkuszy CSS (tokens, layout)
css/tokens.css       tokeny wyglądu
css/layout.css       układ, komponenty i responsywność
js/app.js            walidacja, stan i interakcje
js/scenes.js         lokalne szablony scen SVG
data/personas.js     wyłącznie dane person
data/journeys.js     wyłącznie dane ścieżek i touchpointów
docs/COPILOT.md     instrukcje edycji danych

Widoki macierzy (dane z xlsx, patrz docs/macierz.md):
pages/   matrix.html, priorytety.html, radar.html, mapa.html, cj.html (strony widoków)
css/matrix.css       wspólne style widoków; osobno priorities.css, radar.css, flow.css
js/matrix-core.js    wspólny model danych (CX.mx)
js/matrix.js, priorities.js, radar.js   logika poszczególnych widoków
js/flow-core.js, flow-layout.js, flow-map.js   graf, układ i rysowanie mapy przepływu; js/cj-flow-adapter.js: dane macierzy CX → wejście mapy
data/matrix.js, data/flow.js   GENEROWANE z macierz-demo.xlsx, nie edytować ręcznie
macierz-demo.xlsx, data/macierz-demo/*.csv   źródło danych i eksport CSV
tools/               konwerter xlsx, seed xlsx i testy
1-sciagnij-zmiany.bat, 2-przebuduj-dane.bat/.command, wyslij-zmiany.bat   dwuklik: uruchamia konwerter
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

- `pages/matrix.html`: heatmapa procesów i tryb omawiania,
- `pages/priorytety.html`: mapa koszt × zysk akcji naprawczych,
- `pages/radar.html`: radar podróży klienta,
- `pages/cj.html`: podróż klienta (Customer Journey): wykres emocji −5…+5 po punktach styku w krokach i etapach, pain pointy, drzewo pain point → root cause → inicjatywa oraz krzywe prognozy po Quick Wins, Mid i Long Term. Dwa zestawy danych: prawdziwe („Real”) z `macierz_CX.xlsx` (edytuje go ekspert, plik i `data/cj.js` są poza repozytorium i `1-sciagnij-zmiany` ich nie nadpisuje) oraz demo z `macierz_CX_demo.xlsx` (w repozytorium, wszystkie pola wypełnione przykładowymi wartościami DEMO, → `data/cj-demo.js`); konwersja: `python3 tools/cj-xlsx-to-data.py` albo `2-przebuduj-dane`. Przełącznik „Dane: Real / Demo” nad wykresem (`?dane=demo`); bez pliku produkcyjnego strona pokazuje demo. Kolumny prognozy (`Po Quick Wins`, `Po Mid Term`, `Po Long Term`) w zakładce `Macierz CX` są w demo przykładowe,
- `pages/mapa.html`: mapa przepływu (swimlane) budowana z `macierz_CX.xlsx` (`data/cj.js`; `?dane=demo` = `macierz_CX_demo.xlsx`): tory = właściciel biznesowy (brak: kanał), kolumny = kroki z zakładki `Dane`, krawędzie = zakładka `Przepływ` (Z, Do, Etykieta, Scenariusz, Opcjonalny; powrót to wiersz do wcześniejszego punktu). Zakładkę dopisuje `python3 tools/add-flow-sheet.py`; bez niej mapa pokazuje komunikat. Adapter: `js/cj-flow-adapter.js`. Przypadki klienta (lista „Przypadek”, `data/flow.js` z `macierz-demo.xlsx`) nie są częścią tej mapy (stan kroku: znak i kolor, pominięte punkty przygaszone); przyciski Start/Dalej/Wstecz prowadzą krok po kroku (mapa przesuwa się do punktu, kropka jedzie po trasie; bez ruchu przy `prefers-reduced-motion`).

Widok cj startuje od całego przebiegu; nad wykresem jest podsumowanie z samych danych (średnia emocji i liczba punktów poniżej zera na etap, najniższe punkty, klik w etap pokazuje jego pain pointy i inicjatywy), a przycisk „Drukuj / zapisz PDF” zapisuje wykres na stronie A4 poziomej (tylko widok Wykres). Brak poziomu emocji jest oznaczony pustym znacznikiem przy dolnej krawędzi. Nazwy kolumn w xlsx są porównywane bez względu na wielkość liter, polskie znaki, spacje i podkreślenia.

Dane tych widoków nie są edytowane ręcznie: źródłem jest `macierz-demo.xlsx`. Po zmianie zamknij Excela i kliknij `2-przebuduj-dane.command` (macOS) albo `2-przebuduj-dane.bat` (Windows); skrypt (Python 3) zapisze `data/macierz-demo/*.csv`, `data/matrix.js` i `data/flow.js`. Ten sam skrypt odświeża też `data/cj.js` z `macierz_CX.xlsx` i `data/cj-demo.js` z `macierz_CX_demo.xlsx` (widok `pages/cj.html`). Szczegóły zakładek, torów i przypadków: `docs/macierz.md`.

**Windows bez Pythona:** pobierz [python-3.13.9-embed-amd64.zip](https://www.python.org/ftp/python/3.13.9/python-3.13.9-embed-amd64.zip) (przenośny Python, ok. 10 MB, bez instalacji) i rozpakuj go do folderu `tools\python`, tak aby powstał plik `tools\python\python.exe`. `2-przebuduj-dane.bat` użyje go w pierwszej kolejności, przed Pythonem z systemu. Folder jest w `.gitignore`, więc zip nie trafia do repozytorium. Skrypt używa tylko biblioteki standardowej, więc nic więcej nie trzeba doinstalowywać.

Testy (node/Python, bez zależności): `node tools/test-flow-core.js`, `node tools/test-flow-layout.js`, `python3 tools/test-xlsx-to-data.py`.

## Synchronizacja z GitHubem (Windows)

Pierwsza paczka trafia do użytkownika mailem (zip), kolejne zmiany idą przez GitHuba (repozytorium `lodooowa/cx-experience`, gałąź `main`). Użytkownik nie musi znać Gita: wystarczą dwa skrypty do kliknięcia w głównym folderze.

- `1-sciagnij-zmiany.bat`: pobiera najnowszą wersję z GitHuba. Gdy folder nie jest jeszcze repozytorium, tworzy je i ustawia `main` na `origin/main`, nie nadpisując plików z zipa (różnice widać potem jako zmiany). Przy każdym uruchomieniu nadpisuje pliki wersją z GitHuba (`reset --hard`): zmiany lokalne są odrzucane, a kopię zmian w śledzonych plikach zachowuje `refs/kopie/ostatnia` (odzysk: `git checkout refs/kopie/ostatnia -- plik`). Zmiany do wysłania wysyłaj przed pobraniem.
- `wyslij-zmiany.bat`: zapisuje zmiany z folderu (pyta o krótki opis, Enter = „Aktualizacja danych”) i wysyła je na `main`. Gdy na GitHubie są nowsze, kolidujące zmiany, niczego nie wysyła i wyświetla komunikat.
- `tools/git-wspolne.bat`: wspólna część obu skryptów (wybór Gita, inicjalizacja, token).

**Git:** skrypty używają przenośnego `tools\PortableGit\cmd\git.exe`, a gdy go nie ma, Gita z systemu. PortableGit (archiwum `PortableGit-*-64-bit.7z.exe` ze strony git-scm.com/download/win) rozpakuj do `tools\PortableGit`, tak aby powstał plik `tools\PortableGit\cmd\git.exe`. Folder jest w `.gitignore`.

**Token:** autoryzacja idzie tokenem GitHub typu fine-grained, utworzonym na koncie `lodooowa`, ograniczonym do jednego repozytorium `cx-experience`, z uprawnieniem *Contents: Read and write*. Skrypt prosi o token przy pierwszym uruchomieniu i zapisuje go w `.git\cx-token` (poza historią repozytorium; nie dołączaj folderu `.git` do zipa wysyłanego dalej). Token trafia do Gita tylko jako adres przy `fetch`/`push`, bez zapisu w konfiguracji. Aby wpisać nowy token, usuń plik `.git\cx-token`. Commity ze skryptów mają autora `lodooowa-cx` (`lodooowa-cx@users.noreply.github.com`), więc łatwo je odróżnić od commitów właściciela: `git log --author=lodooowa-cx`.

## Kontrola po zmianie danych

1. Otwórz `pages/sciezki.html` dwuklikiem i sprawdź, czy pojawia się wybrana persona oraz jej ścieżki.
2. Wybierz różne punkty na mapie i sprawdź panel szczegółów.
3. Sprawdź gałęzie ścieżki, jeśli występują.
4. Zwiń i rozwiń emocje; wybierz punkty mapy i wykresu.
5. Sprawdź brakujące emocje, długie teksty oraz wąski ekran.

Wszystkie przykładowe treści są demonstracyjne. Aplikacja nie pobiera danych, fontów ani grafik z internetu.
