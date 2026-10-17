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

- [macierz-demo.xlsx](macierz-demo.xlsx): trzy arkusze do pracy w Excelu,
- [macierz-demo/punkty_styku.csv](macierz-demo/punkty_styku.csv): punkty styku (jeden wiersz na punkt),
- [macierz-demo/cechy.csv](macierz-demo/cechy.csv): wiele cech na punkt (dobre praktyki, błędy typowe i diagnozowane, przykłady, źródła),
- [macierz-demo/akcje.csv](macierz-demo/akcje.csv): wiele akcji naprawczych na punkt (koszt, ryzyko, zysk, czas, ryzyka wdrożenia).

Punkty w macierzy dealera mają podtyp (kolumna `podtyp`: dealer, salon, serwis); przypisanie w danych DEMO jest przykładowe. Importer podtypów nie ma.

Relacje: `cechy.punkt_id` i `akcje.punkt_id` wskazują `punkty_styku.id`. Pliki (razem z `data/matrix.js`) generuje [tools/gen-macierz-demo.py](tools/gen-macierz-demo.py): źródłem jest skrypt, więc nie edytuj wygenerowanych plików ręcznie.

Wizualizacje (otwierane dwuklikiem, offline, na tych samych danych):

- [matrix.html](matrix.html): **A, heatmapa** procesów z trybem omawiania, do szukania czerwonych punktów,
- [priorytety.html](priorytety.html): **B, priorytety działań**: mapa koszt × zysk akcji naprawczych i robocza lista na najbliższe tygodnie (niezapisywana),
- [radar.html](radar.html): **C, radar** podróży klienta z przelotem kamery po punktach do omówienia.

## Do przemyślenia

- Miernik: jak mierzyć efekt wdrożonych usprawnień.
