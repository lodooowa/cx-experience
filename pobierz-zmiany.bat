@echo off
rem Dwuklik (Windows): pobiera najnowsza wersje z GitHuba (main) i nadpisuje nia pliki w folderze; przy pierwszym uruchomieniu tworzy repozytorium.
rem Zmiany lokalne sa odrzucane (reset --hard); kopia zmian w sledzonych plikach zostaje w refs/kopie/ostatnia (odzysk: git checkout refs/kopie/ostatnia -- plik).
chcp 65001 >nul
cd /d "%~dp0"
call tools\git-wspolne.bat
if errorlevel 1 goto koniec
for /f %%h in ('"%GIT%" stash create') do "%GIT%" update-ref refs/kopie/ostatnia %%h
"%GIT%" reset --hard origin/main
if errorlevel 1 (
  echo.
  echo Nie udalo sie zaktualizowac plikow. Skontaktuj sie z osoba prowadzaca repozytorium.
  goto koniec
)
echo.
echo Gotowe: folder zgodny z najnowsza wersja z GitHuba (zmiany lokalne odrzucone).
:koniec
echo.
pause
