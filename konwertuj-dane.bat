@echo off
rem Dwuklik (Windows): zamienia macierz-demo.xlsx na pliki danych dla stron. Wymaga Pythona 3 (przenosnego w tools\python albo systemowego).
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist tools\python\python.exe (
  tools\python\python.exe tools\xlsx-to-data.py
  goto koniec
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\xlsx-to-data.py
  goto koniec
)
where python >nul 2>nul
if %errorlevel%==0 (
  python tools\xlsx-to-data.py
  goto koniec
)
echo Nie znaleziono Pythona 3. Rozpakuj przenosny Python do tools\python (instrukcja w README.md), zainstaluj go (python.org, zaznacz "Add to PATH") albo popros o uruchomienie konwersji osobe, ktora go ma.
:koniec
echo.
pause
