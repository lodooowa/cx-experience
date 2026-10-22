# Macierze punktów styku

## Cel

Pełna inwentaryzacja stanu obecnego, diagnoza miejsc do poprawy i zbudowanie planu poprawy: krótko- i długoterminowego.

## Co mamy

Dwie macierze:

1. styk importera z klientem,
2. styk dealera/serwisu z klientem.

Punkty styku zawsze dotyczą klienta.

### Co powinna zawierać macierz (dla każdego punktu styku)

| Status | Element |
|---|---|
| ✅ jest | Punkt styku (touchpoint) |
| ✅ jest | Informacja, czy i w jakim procesie występuje dany styk |
| ✅ jest | Emocja, jaką generuje styk |
| ❌ do dopisania | Opis, na jakie emocje wpływa |
| ❌ do dopisania | Jakie błędy łatwo popełnić |
| ❌ do dopisania | Wzorcowy punkt styku i jego wynik |
| ❌ do dopisania | Błędy obecnie diagnozowane w tym punkcie |
| ❌ do dopisania | Czy punkt jest objęty procesem monitorowania |
| ❌ do dopisania | Przykłady z życia |
| ❌ do dopisania | Właściciel punktu styku (kto za niego odpowiada) |
| ❌ do dopisania | Ocena eksperta CX (zaopiekowany / do poprawy / w porządku) |
| ❌ do dopisania | Akcja naprawcza: koszt, ryzyko, zysk, szacowany czas wdrożenia |

### Źródła danych i ocen

- ankiety,
- obserwacje,
- NPS,
- wiedza ekspercka,
- opinie w Google i podobne.

Ocena punktu styku (zaopiekowany / do poprawy / w porządku) to subiektywna ocena eksperta CX.

## Plan działania

1. Dokończyć budowę macierzy i ustalić, czy powinny zawierać jeszcze jakieś dane lub wymiary.
2. Zaplanować wizualizację macierzy.
3. Zaznaczyć obszary, które nie są obecnie w ogóle objęte opieką albo wymagają poprawy, oraz te, które są w porządku (coś w rodzaju heatmapy).
4. Znaleźć quick win dla każdego problematycznego obszaru, z informacją o koszcie, ryzyku, zysku i szacowanym czasie wdrożenia.
5. Opracować docelowe usprawnienia problematycznych touchpointów, z informacją o koszcie, ryzyku, zysku i szacowanym czasie wdrożenia.
6. Skrzyżować obie macierze, wskazać części wspólne i rozbieżne, zwizualizować je i wyciągnąć wnioski.

## Przykładowa macierz (DEMO)

Dane wymyślone, do pracy nad wizualizacją: 30 punktów styku w każdej z dwóch macierzy.

- [macierz-demo.xlsx](../macierz-demo.xlsx): skoroszyt do pracy w Excelu (9 zakładek, patrz niżej),
- [data/macierz-demo/punkty_styku.csv](../data/macierz-demo/punkty_styku.csv): punkty styku (jeden wiersz na punkt),
- [data/macierz-demo/cechy.csv](../data/macierz-demo/cechy.csv): wiele cech na punkt (dobre praktyki, błędy typowe i diagnozowane, przykłady, źródła),
- [data/macierz-demo/akcje.csv](../data/macierz-demo/akcje.csv): wiele akcji naprawczych na punkt (koszt, ryzyko, zysk, czas, ryzyka wdrożenia).

Punkty w macierzy dealera mają podtyp (kolumna `podtyp`: dealer, salon, serwis); przypisanie w danych DEMO jest przykładowe. Importer podtypów nie ma.

Kolumna `zaopiekowanie_1_5` to stopień zaopiekowania punktu (1–5, 5 = w pełni zaopiekowany); na kafelkach macierzy pokazują go paski. W danych DEMO wynika z oceny CX (niezaopiekowany 1–2, do poprawy 3, w porządku 4–5, brak oceny = pusto), więc docelowo wpisuje ją ekspert CX.

Relacje: `cechy.punkt_id` i `akcje.punkt_id` wskazują `punkty_styku.id`. Źródłem danych jest [macierz-demo.xlsx](../macierz-demo.xlsx) (zakładki: punkty_styku, cechy, akcje, slowniki, procesy oraz mapa przepływu: nastepne, przypadki, kroki_przypadku). Po edycji zamknij Excela i kliknij dwukrotnie `2-przebuduj-dane.command` (macOS) albo `2-przebuduj-dane.bat` (Windows), albo uruchom `python3 tools/xlsx-to-data.py` (Python 3, bez dodatkowych bibliotek): zapisze CSV, `data/matrix.js` i `data/flow.js`, więc nie edytuj ich ręcznie. Plik pobrany z internetu (zip) macOS może zablokować: otwórz go z menu kontekstowego (Otwórz), a Windows (SmartScreen) zapyta o zgodę (Więcej informacji, Uruchom mimo to). Pierwsza zakładka `czytaj_mnie` opisuje kolejność uzupełniania, a kolumny słownikowe i `punkt_id` mają listy rozwijane (dodane przez seed; zakładki spoza listy konwerter ignoruje). Skrypt zgłasza błędy z nazwą zakładki i numerem wiersza. Test: `python3 tools/test-xlsx-to-data.py`. [tools/gen-macierz-demo.py](tools/gen-macierz-demo.py) to jednorazowy seed xlsx z danych DEMO i nie nadpisuje istniejącego pliku bez `--force`.

Wizualizacje (otwierane dwuklikiem, offline, na tych samych danych):

- [matrix.html](../pages/matrix.html): **A, heatmapa** procesów z trybem omawiania, do szukania czerwonych punktów,
- [priorytety.html](../pages/priorytety.html): **B, priorytety działań**: mapa koszt × zysk akcji naprawczych i robocza lista na najbliższe tygodnie (niezapisywana),
- [radar.html](../pages/radar.html): **C, radar** podróży klienta z przelotem kamery po punktach do omówienia.

### Mapa przepływu i przypadki (DEMO)

- `nastepne`: krawędzie mapy (`punkt_id` → `nastepny_id`, opcjonalna `etykieta`, `opcjonalny` tak/nie). Kilka wierszy z tym samym `punkt_id` to rozwidlenie. Pętle (powrót do wcześniejszego punktu) są dozwolone.
- `przypadki` i `kroki_przypadku`: przebieg prawdziwego klienta. `stan` kroku bierze się ze słownika (`zadzialal`, `czesciowo`, `nie_zadzialal`, `brakuje`). Punkt mapy bez wpisu w przypadku to punkt pominięty. Pola `klient`, `model_pojazdu`, `numer_sprawy` są opcjonalne.
- Tory: domyślnie macierz i podtyp punktu (importer, dealer, salon, serwis). Nowy tor to wartość w kolumnie `tor_nadpisanie` punktu oraz jego etykieta w `slowniki` (grupa `tor`; kolejność wierszy tej grupy to kolejność torów; ID toru nie może być samą liczbą).
- Graf i przypadki w danych DEMO są wymyślone, żeby pokazać mechanikę. Docelowo wpisuje je ekspert CX. Test: `node tools/test-flow-core.js`.

### Mapa przepływu z macierzy CX (`macierz_CX.xlsx`)

`pages/mapa.html` czyta ten sam plik co widok Customer Journey. Ekspert uzupełnia zakładkę `Przepływ` (dopisuje ją `python3 tools/add-flow-sheet.py [plik.xlsx]`, z kopią `.bak`, bez zmian przy ponownym uruchomieniu): wiersz = jedno przejście `Z` → `Do` (Touchpoint ID z `Macierz CX`, listy rozwijane); kolumny `Z – punkt styku` i `Do – punkt styku` to formuły podglądu nazwy (konwerter ich nie czyta; `— brak takiego ID` = błędne ID), a ponowne uruchomienie skryptu przebudowuje starą zakładkę z zachowaniem wpisanych przejść. Powrót do wcześniejszego punktu to zwykły wiersz wstecz, a odgałęzienie to kilka wierszy z tym samym `Z`. `Scenariusz` (opcjonalny) ogranicza przejście do scenariusza; pusty = wszystkie. `Opcjonalny` = `tak` rysuje linię przerywaną. Tory mapy to właściciel biznesowy (brak: kanał), kolumny to kroki z zakładki `Dane`. Po edycji: `2-przebuduj-dane`.

## Do przemyślenia

- Miernik: jak mierzyć efekt wdrożonych usprawnień.
