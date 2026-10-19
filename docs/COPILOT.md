# Instrukcja dla eksperta CX i Microsoft Copilot Chat

## Edycja danych
W aplikacji CX Experience Explorer treści i kod są rozdzielone. Ekspert **nie edytuje** `pages/sciezki.html`, `css/style.css` ani `js/app.js`.

Do Copilota prześlij **jeden** z plików danych po zmianie nazwy rozszerzenia:
- `data/journeys.js` → `journeys.txt`
- `data/personas.js` → `personas.txt`

Gdy Copilot zwróci kompletny plik TXT, przywróć nazwę `.js` i podmień odpowiedni plik w podfolderze `data`. Wykonaj testy opisane w README.

Dotyczy to tylko ścieżek klienta (`pages/sciezki.html`). Dane macierzy punktów styku i mapy przepływu (`pages/matrix.html`, `pages/mapa.html` itd.) pochodzą z `macierz-demo.xlsx`; `data/matrix.js` i `data/flow.js` są generowane, więc nie przekazuj ich Copilotowi (patrz `docs/macierz.md`).

## Gotowy prompt do Copilota

> Załączony plik TXT zawiera dane lokalnej wizualizacji Customer Journey. Mimo rozszerzenia TXT jego zawartość to poprawny JavaScript: `window.CX_JOURNEYS = [ ... ];`, gdzie pomiędzy nawiasami znajdują się dane JSON.
>
> Twoim zadaniem jest zmiana **wyłącznie treści danych**, bez zmian w strukturze i bez pisania aplikacji. Zachowaj początkowe `window.CX_JOURNEYS =` oraz końcowy średnik. Nie usuwaj istniejących ścieżek, jeśli o to nie poproszę. Zachowaj unikalność ID, poprawną składnię JSON i istniejące referencje `personaId` oraz `branches.target`. `emotion` jest opcjonalne; jeśli podano, musi być liczbą 1–5. `type` może mieć wartość standard/critical/success/choice. Używaj tylko istniejących scen: audio, web, configurator, alert, dealer, drive, message, calendar, options, document.
>
> **Nie wymyślaj faktów o rzeczywistych klientach ani opisów perspektywy dealera/importera.** Przygotuj zawartość dokładnie na podstawie informacji, które podam. Jeśli brakuje informacji, pozostaw pola opcjonalne pominięte albo dopytaj. Perspektywy dodawaj tylko wtedy, gdy podam treść dla wszystkich punktów ścieżki. Zwróć **kompletny** zmodyfikowany plik TXT do pobrania; nie skracaj pozostałej części pliku.
>
> Zmiana do wykonania: [TU WPISZ POLECENIE DOTYCZĄCE DANYCH].

## Co sprawdzić po odpowiedzi Copilota?
- Czy zwrócił pełny plik, a nie fragment?
- Czy nie usunął pozostałych ścieżek i punktów?
- Czy `window.CX_JOURNEYS =` zostało zachowane?
- Czy aplikacja ładuje się po podmianie pliku?

## Przykładowe polecenia
- „Zmień tytuł czwartego punktu ścieżki discovery na ...”
- „Dodaj do ścieżki discovery nowy touchpoint po punkcie web; podam Ci opis, emocję i odpowiedzialność”.
- „Utwórz nową ścieżkę dla istniejącej persony fleet na podstawie poniższej specyfikacji”.
- „Zmień emocję punktu cta na 3. Nie zmieniaj pozostałych pól”.

## Uwaga
Copilot może pomijać tekst w długich plikach. Jeśli zwraca uciętą zawartość, **nie podmieniaj pliku**. Zachowuj kopię poprzedniej działającej wersji. Nie wszystkie środowiska Copilot umożliwiają pobieranie edytowanych załączników.
