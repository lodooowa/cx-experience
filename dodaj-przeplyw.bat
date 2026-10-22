@echo off
rem Dwuklik (Windows): dopisuje zakladke "Przeplyw" (Z, Do, Etykieta, Scenariusz, Opcjonalny + nazwy punktow) do macierz_CX.xlsx i macierz_CX_demo.xlsx. Zamknij pliki w Excelu przed uruchomieniem. Kopia zapasowa: plik.xlsx.bak. Ponowne uruchomienie niczego nie psuje. Wymaga Pythona 3 (przenosnego w tools\python albo systemowego).
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist tools\python\python.exe (
  set PY=tools\python\python.exe
  goto start
)
where py >nul 2>nul
if %errorlevel%==0 (
  set PY=py -3
  goto start
)
where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
  goto start
)
echo Nie znaleziono Pythona 3. Rozpakuj przenosny Python do tools\python (instrukcja w README.md), zainstaluj go (python.org, zaznacz "Add to PATH") albo popros o uruchomienie osobe, ktora go ma.
goto koniec
:start
%PY% tools\add-flow-sheet.py
:koniec
echo.
pause
