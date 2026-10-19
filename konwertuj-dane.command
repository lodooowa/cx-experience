#!/bin/bash
# Dwuklik (macOS): zamienia macierz-demo.xlsx i macierz_CX.xlsx (cj.html) na pliki danych dla stron. Wymaga Pythona 3.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 tools/xlsx-to-data.py
  echo
  python3 tools/cj-xlsx-to-data.py
else
  echo "Nie znaleziono Pythona 3. Zainstaluj go (python.org) albo poproś o uruchomienie konwersji osobę, która go ma."
fi
echo
read -n 1 -s -r -p "Naciśnij dowolny klawisz, aby zamknąć okno..."
