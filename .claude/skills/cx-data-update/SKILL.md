---
name: cx-data-update
description: Zmiany danych i schematu danych w CX Journey Experience - edycja ścieżek klienta (data/personas.js, data/journeys.js) oraz macierzy i mapy przepływu z macierz-demo.xlsx przez konwerter tools/xlsx-to-data.py (data/matrix.js, data/flow.js, macierz-demo/*.csv). Używaj zawsze, gdy zadanie dotyczy nowej kolumny, zakładki, pola, słownika, toru, stanu przypadku, procesu, punktu styku, krawędzi mapy, konwertera xlsx, pliku 2-przebuduj-dane albo błędu „BŁĄD DANYCH”, także gdy użytkownik mówi tylko „dodaj pole”, „zmień dane”, „przelicz xlsx” albo „ekspert dopisał wiersze”.
---

# Dane i schemat (cx-experience)

Dane są oddzielone od mechaniki i wyglądu (AGENTS.md §3, §7). Ekspert CX jest właścicielem treści: **nie wymyślaj** wartości, emocji, właścicieli, cytatów ani przypadków. Dane testowe oznaczaj jako DEMO. Nowe pola są opcjonalne i mają fallback.

Najpierw rozpoznaj, w którym świecie danych jest zadanie. Mają różne źródła, walidację i odbiorców.

## A. Ścieżki klienta: `data/personas.js`, `data/journeys.js`

- Edytowane ręcznie (także przez Copilot Chat jako `.txt`, patrz `COPILOT.md`). Format: JSON w jednym przypisaniu, `window.CX_PERSONAS = [...];` w `personas.js` i `window.CX_JOURNEYS = [...];` w `journeys.js`, z komentarzem nagłówka. Zachowaj przypisanie, średnik i styl wierszy.
- Schemat pól: `README.md` („Pola ścieżki i punktu”). Walidacja: `validateData()` w `app.js` (ID, `personaId`, typy, sceny, emocja 1–5, `branches.target` w tej samej ścieżce). Błąd pokazuje się na `#errorScreen` z nazwą pliku.
- Nie ma testu w Node. Sprawdzeniem jest smoke `--pages index` ze skilla `cx-regression`.
- Nowe pole w schemacie oznacza zmiany w: renderowaniu w `app.js` (opcjonalnie, z bezpiecznym `esc`), `README.md`, nagłówku komentarza w `data/journeys.js` i prompcie w `COPILOT.md`, żeby Copilot nie usunął pola.

## B. Macierz i mapa przepływu: `macierz-demo.xlsx` → konwerter

Źródłem jest wyłącznie `macierz-demo.xlsx`. `macierz-demo/*.csv`, `data/matrix.js` i `data/flow.js` są **generowane**: nie edytuj ich ręcznie. Opis zakładek, torów i przypadków: `macierz.md`.

### B1. Zmiana treści (wiersze w istniejących kolumnach)

1. Zmieniony xlsx dostarcza ekspert albo użytkownik.
2. `python3 tools/xlsx-to-data.py`: zapisuje CSV i oba pliki JS. Błąd ma format „BŁĄD DANYCH: Arkusz 'x', wiersz N: …”. Przekaż go użytkownikowi do poprawy w Excelu i nie obchodź go w kodzie.
3. `python3 tools/test-xlsx-to-data.py`: na końcu porównuje konwersję xlsx z repo z commitowanymi CSV i JS, więc niezsynchronizowane pliki wywalą test.
4. `node tools/test-flow-core.js` i `node tools/test-flow-layout.js`. Uwaga: `test-flow-layout.js` ma zaszyte liczby dla danych DEMO (obecnie 60 węzłów, 4 tory). Gdy ekspert celowo zmienia liczbę punktów lub torów, zaktualizuj te asercje i napisz to w raporcie. Silnik nie wymaga wtedy zmian.
5. Commit atomowy: xlsx + wszystkie CSV + `data/matrix.js` + `data/flow.js` razem.

### B2. Zmiana schematu (nowa kolumna, zakładka, słownik, pole w modelu)

Przejdź wszystkie miejsca. Pominięte miejsce zwykle daje cichy brak danych, a nie błąd.

1. **Konwerter** `tools/xlsx-to-data.py`:
   - `SHEETS` (kolumny na zakładkę; konwerter szuka kolumn po nazwie nagłówka, więc ich kolejność w xlsx nie ma znaczenia, a nadmiarowe kolumny są ignorowane),
   - `INT` dla kolumn liczbowych, `LABEL_GROUPS`/`FLOW_GROUPS` dla nowej grupy słownika, `LEVELS`,
   - walidacja w `convert()` (komunikat z arkuszem i wierszem, jak istniejące),
   - serializacja: `dict(...)` punktu, cechy lub akcji do `CX_MATRIX` albo krawędzi i przypadku do `CX_FLOW`. Pole opcjonalne dodawaj tylko, gdy niepuste (wzór: `subtype`, `lane`).
2. **Test** `tools/test-xlsx-to-data.py`: dopisz kolumnę do `sample()`, asercję w `main()` i `expect_error` dla nowej walidacji.
3. **Skoroszyt** `macierz-demo.xlsx`: konwerter używa tylko biblioteki standardowej i nie zapisuje xlsx. Domyślnie poproś, żeby kolumnę dodał ekspert albo użytkownik w Excelu. Jeśli to ma zrobić agent, uzgodnij z użytkownikiem narzędzie: `openpyxl`, którego używa seed, może nie być zainstalowany, a instalacja wymaga zgody i nigdy nie może stać się zależnością repo. Przy edycji programowej zachowaj listy rozwijane, zamrożony nagłówek i zakładkę `czytaj_mnie`. Nowe kolumny dopisuj na końcu tabeli (zasada z `czytaj_mnie`), chyba że użytkownik chce inaczej.
4. **Seed** `tools/gen-macierz-demo.py`: ma własne nagłówki (`PH`, `CH`, `AH`, `NH`, `PCH`, `KH`…), listy rozwijane (`dv(...)`) i tekst `README` zakładki `czytaj_mnie`. Zaktualizuj je dla spójności, ale **nie uruchamiaj** seeda (`--force` nadpisuje dane eksperta).
5. **Konsumenci w JS**: walidacja modelu w `js/matrix-core.js` (`validate()`, `CX.mx`) albo `js/flow-core.js`, potem widok, który pokazuje pole. Brak wartości oznacza neutralny stan, nie zmyśloną liczbę.
6. **Przypadki szczególne mapy przepływu**:
   - **tor** domyślnie wynika z macierzy i podtypu punktu (`laneOf` w `js/flow-core.js`), więc nowy podtyp (z etykietą w `slowniki`, grupa `subtype`) daje nowy tor bez osobnego wpisu toru. Tor spoza tego podziału to `tor_nadpisanie` + etykieta w `slowniki` (grupa `tor`). Kolory torów to tylko 6 klas `lc-0…5` (`% 6` w `js/flow-map.js`, `--lane-N` w `css/flow.css`), więc siódmy tor powtórzy kolor. Zgłoś to, zamiast dokładać kolory po cichu.
   - nowy **stan kroku** to wpis w `slowniki` (grupa `stan`) + znak w `stateMarks` (`js/flow-map.js`; bez niego mapa pokaże `?` i `console.warn`) + kolor `--st-<klucz>` i klasa `.st-<klucz>` w `css/flow.css`.
7. Uruchom konwerter i wszystkie testy jak w B1. Zaktualizuj `macierz.md`, tekst `czytaj_mnie` i `README.md`/`COPILOT.md`, jeśli zmienia się to, co robi ekspert.

## Na koniec

Gdy zmiana danych wymaga też zmiany rysowania mapy (nowy stan, kolor toru, nowe pole na karcie), część w `js/flow-map.js` i `css/flow.css` prowadź według skilla `cx-flow-map`.

Skill `cx-regression`: zakres „xlsx/konwerter” albo „ścieżki klienta”. W raporcie wymień, które pliki są generowane i czy xlsx zmienił się w tym commicie.
