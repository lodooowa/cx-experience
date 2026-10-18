@echo off
rem Dwuklik (Windows): pobiera najnowsza wersje z GitHuba (main); przy pierwszym uruchomieniu tworzy repozytorium.
chcp 65001 >nul
cd /d "%~dp0"
call tools\git-wspolne.bat
if errorlevel 1 goto koniec
"%GIT%" rebase --autostash origin/main
if errorlevel 1 (
  echo.
  echo Nie udalo sie polaczyc zmian z wersja z GitHuba. Zmiany lokalne sa bezpieczne. Skontaktuj sie z osoba prowadzaca repozytorium.
  "%GIT%" rebase --abort >nul 2>nul
  goto koniec
)
echo.
echo Gotowe: folder zgodny z najnowsza wersja z GitHuba (zmiany lokalne zachowane).
:koniec
echo.
pause
