@echo off
rem Dwuklik (Windows): zapisuje zmiany z folderu i wysyla je na GitHub (main).
chcp 65001 >nul
cd /d "%~dp0"
call tools\git-wspolne.bat
if errorlevel 1 goto koniec
"%GIT%" add -A
"%GIT%" diff --cached --quiet
if not errorlevel 1 goto wyslij
set "MSG="
set /p "MSG=Krotki opis zmian (Enter = Aktualizacja danych): "
if not defined MSG set "MSG=Aktualizacja danych"
"%GIT%" commit -q -m "%MSG%" || goto koniec
:wyslij
"%GIT%" rebase origin/main
if errorlevel 1 (
  echo.
  echo Na GitHubie sa nowsze zmiany, ktore koliduja z Twoimi. Nic nie wyslano. Skontaktuj sie z osoba prowadzaca repozytorium.
  "%GIT%" rebase --abort >nul 2>nul
  goto koniec
)
"%GIT%" push "%AUTHURL%" HEAD:main
if errorlevel 1 (
  echo.
  echo Wysylanie nie powiodlo sie. Sprawdz token i internet.
  goto koniec
)
"%GIT%" fetch -q "%AUTHURL%" +main:refs/remotes/origin/main
echo.
echo Gotowe: zmiany wyslane na GitHub.
:koniec
echo.
pause
