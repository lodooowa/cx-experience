@echo off
rem Dwuklik (Windows): zamienia macierz-demo.xlsx (macierze, mapa) i macierz_CX.xlsx (podroz klienta, cj.html) na pliki danych dla stron. Wymaga Pythona 3 (przenosnego w tools\python albo systemowego).
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
echo Nie znaleziono Pythona 3. Rozpakuj przenosny Python do tools\python (instrukcja w README.md), zainstaluj go (python.org, zaznacz "Add to PATH") albo popros o uruchomienie konwersji osobe, ktora go ma.
goto koniec
:start
echo === macierz-demo.xlsx ===
%PY% tools\xlsx-to-data.py
echo.
echo === macierz_CX.xlsx ===
%PY% tools\cj-xlsx-to-data.py
:koniec
echo.
pause
