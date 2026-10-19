@echo off
rem Wspolny start dla 1-pobierz-zmiany.bat i 3-wyslij-zmiany.bat (wolane przez call).
rem Ustawia GIT, AUTHURL; w razie braku tworzy repozytorium i pyta o token. Kod wyjscia 1 = blad.
set "REPO=github.com/lodooowa/cx-experience.git"
set "GIT="
if exist "%~dp0PortableGit\cmd\git.exe" set "GIT=%~dp0PortableGit\cmd\git.exe"
if not defined GIT (
  where git >nul 2>nul
  if not errorlevel 1 set "GIT=git"
)
if not defined GIT (
  echo Nie znaleziono Gita. Rozpakuj PortableGit do tools\PortableGit, tak aby istnial plik tools\PortableGit\cmd\git.exe.
  exit /b 1
)
set "GIT_TERMINAL_PROMPT=0"

if not exist .git (
  echo Brak repozytorium - tworze je w tym folderze.
  "%GIT%" init -b main || exit /b 1
  "%GIT%" remote add origin https://%REPO% || exit /b 1
)
"%GIT%" config user.name lodooowa-cx
"%GIT%" config user.email lodooowa-cx@users.noreply.github.com

if not exist .git\cx-token (
  echo.
  echo Wklej token GitHub ^(fine-grained, repozytorium cx-experience, Contents: Read and write^) i nacisnij Enter.
  echo Zostanie zapamietany w .git\cx-token i nie trafia do repozytorium.
  set "TOKEN="
  set /p "TOKEN=Token: "
  if not defined TOKEN (
    echo Nie podano tokenu.
    exit /b 1
  )
  >.git\cx-token <nul set /p "=%TOKEN%"
)
set /p "TOKEN="<.git\cx-token
set "AUTHURL=https://lodooowa:%TOKEN%@%REPO%"

"%GIT%" fetch "%AUTHURL%" +main:refs/remotes/origin/main
if errorlevel 1 (
  echo.
  echo Nie udalo sie pobrac z GitHuba. Sprawdz polaczenie z internetem i token. Zeby wpisac token od nowa, usun plik .git\cx-token.
  exit /b 1
)

"%GIT%" rev-parse --verify HEAD >nul 2>nul
if errorlevel 1 (
  rem Pierwsze uruchomienie (folder z zipa): ustaw main na origin/main, pliki zostaja, roznice widac jako zmiany.
  "%GIT%" reset -q origin/main || exit /b 1
  "%GIT%" branch --set-upstream-to=origin/main main >nul
  echo Repozytorium zainicjowane z origin/main. Pliki w folderze zostaly bez zmian.
)
exit /b 0
