# AGENTS.md — CX Journey Experience

## 1. Cel produktu i kontekst

Budujemy **interaktywną, efektowną wizualizację Customer Journey** dla sieci dealerskiej branży motoryzacyjnej. Produkt ma robić wrażenie na managementcie, ale przede wszystkim pomagać pracownikom sieci zrozumieć ścieżki, emocje, punkty styku i ich szczegóły. Jest to **silnik prezentacji treści**, nie narzędzie do wymyślania Customer Journey.

- Ekspert CX jest właścicielem merytoryki: person, ścieżek, touchpointów, emocji, opisów, zależności, odpowiedzialności i cytatów.
- Implementacja odpowiada za UX, UI, animacje, nawigację, dostępność, walidację danych i prezentację różnorodnych przypadków.
- **Nie dopisuj ani nie interpretuj merytorycznych ustaleń CX jako faktów.** Treści testowe oznaczaj jako DEMO. Jeśli dane są niepełne, pokaż neutralny stan lub czytelny komunikat; nie wymyślaj wartości, emocji ani właścicieli.
- Ma działać **offline z lokalnego `index.html` (`file://`)** w firmowym Edge/Chrome, bez serwera, instalacji, zewnętrznych API, CDN, fontów i pobierania zasobów.
- Odbiorca biznesowy powinien móc aktualizować ścieżki **wyłącznie przez edycję plików danych** (również jako `.txt` w Copilot Chat), bez dotykania kodu mechaniki lub styli.

## 2. Stan wdrożenia i układ v3

v3 jest wdrożone (szczegóły i lista plików: `README.md`). Strona startowa `index.html` przekierowuje na `pages/cj.html`; ścieżki klienta to `pages/sciezki.html` + `js/app.js`. Poza nimi repo zawiera widoki macierzy punktów styku: `pages/matrix.html`, `pages/priorytety.html`, `pages/radar.html`, `pages/mapa.html`. Działają na danych generowanych z `macierz-demo.xlsx` (`data/matrix.js`, `data/flow.js`; konwerter `tools/xlsx-to-data.py`, testy w `tools/`; opis w `docs/macierz.md`). Nie edytuj wygenerowanych plików ręcznie. Zanim założysz, co istnieje, sprawdź aktualną zawartość repozytorium.

### Docelowy układ v3: cztery sekcje

1. **Górny pasek na całą szerokość:** marka/nawigacja, wybór persony i ścieżki, **jawny wybór perspektywy obserwatora** (np. klient / dealer / importer, jeśli dane obsługują dany widok). Persona (kto jest klientem) i perspektywa (z czyjej strony oglądamy) to **dwa różne pojęcia**. Wybrana perspektywa musi być stale czytelna.
2. **Główna przestrzeń:** duża, wizualnie atrakcyjna i interaktywna **linia podróży**, z możliwością rozwidleń zgodnie z danymi. Touchpointy i połączenia muszą być czytelne na tym samym ekranie, bez konieczności przechodzenia do osobnego widoku.
3. **Dolny panel emocji:** rozwijany i zwijany, wyświetlany **równocześnie** z mapą. Punkty wykresu odpowiadają punktom styku; wybór/synchronizacja działa w obie strony. To **emocje klienta**, niezależnie od aktualnie wybranej perspektywy; nie sugeruj odrębnych ocen emocji dealera/importera, jeśli dane ich nie zawierają.
4. **Prawy panel szczegółów (drawer):** wysuwany po wybraniu touchpointu. Na desktopie zajmuje wydzielone miejsce z prawej strony, **nie zasłania głównej mapy**. Lewa/środkowa przestrzeń może być lekko przygaszona i rozmyta (subtelny blur); nagłówek i panel szczegółów pozostają czytelne. Zamknięcie przywraca pełny widok. Na małych ekranach dopuszczalny jest osobny układ responsywny.

Wymagania v3: zachować działanie bez internetu, obsługę wielu person, ścieżek, typów touchpointów, rozgałęzień i prezentację danych demonstracyjnych. Nie usuwać bez potrzeby działających funkcji z v2. Efekt „wow” buduj przede wszystkim czytelnością kompozycji, jakością ruchu, hierarchią i spójną oprawą — nie liczbą animacji.

## 3. Zasady architektury — najważniejsze

### Dane ≠ mechanika ≠ wygląd

- **Dane** (`data/`) opisują persony, ścieżki, touchpointy, powiązania, emocje, media i kontekst. Są deklaratywne; bez HTML, CSS, event handlerów, funkcji i logiki UI.
- **Mechanika** (`js/`) interpretuje dane, waliduje je, zarządza stanem oraz rysuje interfejs. Nie powinna zawierać tekstów konkretnych ścieżek ani specjalnych reguł opartych na identyfikatorach przykładowych person lub touchpointów.
- **Wygląd** (`css/`) definiuje układ, identyfikację wizualną i animacje. Nie powinien zależeć od treści pojedynczej ścieżki.
- **Szablony wizualizacji** dobieraj na podstawie **typu/sceny zapisanych w danych**, a nie konkretnych tytułów czy pozycji na liście.
- Dopuszczaj opcjonalne pola i poprawne wartości domyślne. Walidacja ma wykrywać błędne referencje, duplikaty ID, nieistniejące cele rozgałęzień i nieobsługiwane typy. Pokazuj komunikat z nazwą pliku/ścieżki i problematycznym ID, gdy to możliwe.
- Dodanie nowej persony, kolejnej ścieżki lub punktu w **obsługiwanym schemacie** nie może wymagać zmiany silnika. Nowy rodzaj animowanej sceny to osobna zmiana techniczna.
- Nie zakładaj liniowości: ścieżki mogą mieć rozgałęzienia, a liczba touchpointów jest zmienna. Nie koduj na sztywno sześciu etapów, indeksów, wartości emocji ani proporcji odpowiedzialności.

### Offline bez procesu build

- Preferuj **zwykły HTML, CSS i klasyczne skrypty JavaScript** z jawnie określoną kolejnością ładowania w `index.html`.
- **Nie wprowadzaj automatycznie** React, Vite, Webpack, npm, bundlera, frameworka, CDN, `fetch()` dla lokalnych JSON ani importów ES modules zależnych od lokalnego serwera. Jeśli zmiana tego założenia jest konieczna — najpierw uzasadnij i uzyskaj akceptację.
- `file://` nie pozwala niezawodnie wczytywać plików JSON przez `fetch()`. Obecny kontrakt jest celowy: `window.CX_PERSONAS = [...]` oraz `window.CX_JOURNEYS = [...]` w plikach `.js` zawierających **dane w składni JSON opakowane pojedynczym przypisaniem**. Zachowaj zgodność z tym mechanizmem, dopóki nie wdrożysz i nie przetestujesz równoważnego wariantu offline.
- Jeśli dzielisz dane na wiele plików, zapewnij przewidywalne ładowanie (np. rejestrację i jawny manifest danych); dodanie nowej ścieżki może wymagać wpisu **w manifeście danych**, nigdy edycji renderera. Nie komplikuj ładowania, jeśli dwa obecne pliki wystarczają.
- Zero żądań sieciowych w czasie działania. Grafiki, SVG, zdjęcia i czcionki muszą być lokalne lub wbudowane, a licencje zasobów respektowane.

## 4. Podział na małe pliki domenowe

**Unikaj monolitu.** `js/app.js` i `css/style.css` z v2 to materiał do **stopniowego**, testowanego podziału. Nie przenoś wszystkiego jednocześnie wyłącznie dla estetyki struktury. Dziel po odpowiedzialności, aby niewielka zmiana wymagała odczytania 1–3 plików, a nie całej aplikacji.

Proponowana struktura **docelowa**, nie obowiązek jednorazowego utworzenia wszystkich plików:

```text
index.html
AGENTS.md
README.md
css/
  tokens.css                 # zmienne brandingu i motywy
  layout.css                 # cztery obszary v3 + responsywność
  journey-map.css           # węzły, połączenia, rozwidlenia
  emotion-panel.css         # dolny panel emocji
  detail-drawer.css         # prawy wysuwany panel
  animations.css            # przejścia i reduced-motion
js/
  core/state.js             # jeden stan aplikacji i zdarzenia
  core/validation.js        # walidacja danych, bez DOM
  core/navigation.js        # wybór ścieżki/touchpointu
  components/header.js      # persona, ścieżka, perspektywa
  components/journey-map.js # rysowanie mapy i rozgałęzień
  components/emotions.js    # dolny panel i synchronizacja
  components/details.js     # panel szczegółów
  scenes/registry.js        # wybór szablonu sceny
  app.js                    # wyłącznie inicjalizacja i połączenie modułów
data/
  personas.js               # tylko dane
  journeys.js               # tylko dane, aktualny format
  # w razie potrzeby: journeys/ + manifest ładowania
```

Przy dzieleniu:
- Każdy plik ma **jedną, rozpoznawalną odpowiedzialność**; celuj w około 100–250 linii na moduł, ale nie dziel sztucznie tylko ze względu na liczbę linii.
- Zależności między modułami muszą być jawne, minimalne, a kolejność skryptów w `index.html` stabilna. Dla klasycznych skryptów używaj jednej przestrzeni nazw (np. `window.CX`), nie rozsypuj wielu nowych globali. Wyjątek: tablice danych (`window.CX_PERSONAS`, `CX_JOURNEYS`, `CX_MATRIX`, `CX_FLOW`) to kontrakt plików danych; kod rejestruje się w `window.CX` (`CX.sceneSvg`, `CX.mx`, `CX.flowCore`, `CX.flowLayout`).
- **Nie dubluj** renderowania, stylów ani walidacji. Logika prezentacji nie powinna trafiać do danych.
- Przy prośbie „popraw drawer” najpierw czytaj plik komponentu drawera, jego style, testy i ewentualnie kontrakt stanu; nie wczytuj wszystkich scen i danych.
- Każdy etap refaktoryzacji ma być osobno uruchamialny i testowalny. Nie mieszaj refaktoryzacji z nowymi funkcjami.

## 5. Łatwa zmiana identyfikacji wizualnej (VI)

Przygotuj **jeden zestaw tokenów design systemu** (`css/tokens.css`) zamiast wpisywać kolory, czcionki i rozmiary w kilkudziesięciu miejscach:

```css
:root {
  --brand-primary: #5aa9e6;
  --brand-accent: #ef9d65;
  --surface-base: #0b1422;
  --surface-panel: #14243a;
  --text-primary: #f3f7fc;
  --text-muted: #b9c7d9;
  --font-ui: system-ui, sans-serif;
  --radius-card: 16px;
  --motion-standard: 280ms;
}
```

To **przykładowe tokeny**, nie obowiązkowe kolory firmowe. Korzystaj z semantycznych nazw i odrębnych tokenów stanów (`critical`, `success`, `selected`, `focus`). Przygotuj możliwość przyszłego przełączenia motywu/brandingu przez podmianę jednego pliku z tokenami lub klasy motywu. Nigdy nie zakładaj konkretnego logo, palety ani licencji fontów, dopóki nie zostaną dostarczone. Elementy SVG też mają korzystać z tokenów, jeśli pozwala na to sposób renderowania.

## 6. Jak pracować w Codexie — workflow obowiązkowy

1. **Zrozum zadanie.** Podsumuj oczekiwane zachowanie w 1–3 zdaniach, ustal kryterium sukcesu i wskaż niejasności. Nie zgaduj danych domenowych. Jeśli niejasność nie blokuje realizacji, wybierz najmniejszy bezpieczny wariant i nazwij założenie.
2. **Zlokalizuj zmiany.** Znajdź konkretny komponent i jego kontrakt. Czytaj tylko potrzebne pliki lub ich fragmenty. Nie przeglądaj całego projektu bez potrzeby.
3. **Najpierw test.** Przed zmianą zdefiniuj przypadek kontrolny/regresyjny, a jeśli możliwe — dodaj prosty automatyczny test. Ustal, co jest obecnie zepsute, a co ma pozostać niezmienione.
4. **Minimalny patch.** Edytuj tylko uzasadnione pliki. Bez niezamówionego przeprojektowywania, nowych frameworków, abstrakcji „na przyszłość” i kosmetycznych zmian w obcym kodzie.
5. **Uruchom i sprawdź.** Test składni, walidacja danych, test działania offline, test interakcji i regresja istotnych ścieżek. Nie deklaruj testu wykonanego, jeśli go nie wykonano.
6. **Raport końcowy.** Wymień krótko zmienione pliki, wynik testów i znane ograniczenia. Jeżeli zadanie nie jest ukończone, napisz to wprost.

Przy zmianach wyglądu sprawdzaj też desktop i węższy ekran. Przy zmianach UX sprawdź obsługę klawiaturą, focus, zamykanie drawera przez Escape, stany pustych pól oraz `prefers-reduced-motion`.

### Minimalna regresja przed zakończeniem pracy

- Otwórz `index.html` **bez serwera**, bez połączenia z internetem. Dane ładują się automatycznie.
- Zmień personę i ścieżkę; wybór jest jednoznacznie widoczny.
- Przełącz perspektywę klient/dealer/importer tam, gdzie dane są dostępne; wyświetlane opisy nie mieszają się z emocjami klienta.
- Wybierz pierwszy, środkowy i ostatni touchpoint; szczegóły są poprawne.
- Włącz/wyłącz panel emocji; mapa pozostaje dostępna.
- Otwórz/zamknij prawy drawer. Na desktopie główna ścieżka **nie jest zasłonięta**; blur/dim obejmuje tylko właściwe obszary.
- Przejdź przez przykładowe rozwidlenie; graf pokazuje relacje zgodne z danymi.
- Sprawdź scenariusz krytyczny, dłuższe teksty, mały ekran oraz brak konsolowych błędów.
- W razie dostępności narzędzi uruchom `node --check` na zmienionych plikach JS i testy przeglądarkowe. **Nie dodawaj npm jako wymogu uruchamiania produktu**.

## 7. Kontrakt danych i bezpieczeństwo treści

- Stabilne ID person, ścieżek i touchpointów; referencje i `branches.target` muszą wskazywać istniejące punkty.
- Znane typy v2: `standard`, `critical`, `success`, `choice`; sceny v2: `audio`, `web`, `configurator`, `alert`, `dealer`, `drive`, `message`, `calendar`, `options`, `document`.
- Istniejące dane v2 muszą nadal działać po migracji. Nowe pola są najpierw **opcjonalne** i mają zdefiniowany fallback; wymagane pola dodawaj wyłącznie po świadomej decyzji i migracji przykładów.
- Nie interpretuj `owner` automatycznie jako jedynej odpowiedzialności lub procentu wpływu. Nie generuj procentów, statystyk, NPS, cytatów ani rekomendacji niewynikających z danych.
- Wartości emocji pokazuj wyłącznie, jeśli są dostarczone; przy braku danych nie rysuj sztucznej krzywej.
- Tekst z plików danych traktuj jako niezaufany: bezpiecznie wstawiaj do DOM (`textContent` / escapowanie). Nie wykonuj kodu pochodzącego z treści.
- Dane testowe pozostają fikcyjne i wyraźnie oznaczone jako DEMO.

## 8. Definicja ukończenia v3

Kolejność wdrożenia (tokeny i układ, perspektywa, mapa z emocjami, zwijany panel, drawer, dopiero potem animacje) jest zrealizowana; poniższa definicja służy jako kryterium regresji.

**Definicja ukończenia v3:** aplikacja uruchamia się offline dwuklikiem, zachowuje obsługę wszystkich przykładowych danych z v2, prezentuje cztery uzgodnione sekcje w jednym spójnym interfejsie, a nowa ścieżka w obsługiwanym schemacie nie wymaga edycji logiki ani CSS.

## 9. Zasady współpracy i ograniczenia

- Użytkownik nie chce rozbudowy projektu ponad zgłoszony zakres. **Prostota, punktowe zmiany i testy mają pierwszeństwo nad sprytną architekturą.**
- Nie projektuj merytoryki Customer Journey. Nie zmieniaj danych eksperta bez prośby.
- Nie maskuj błędów i nie udawaj, że niewykonane testy przeszły.
- Nie twórz zbędnych plików ani rozbudowanej infrastruktury. Każdy nowy plik/moduł musi usuwać konkretny problem z utrzymaniem lub pozwalać na wymagane zachowanie.
- Gdy istniejący kod v2 wymusza większy refactoring, podziel go na małe samodzielne kroki ze sprawdzeniem po każdym.
- W tym repo pracujemy bezpośrednio na `main`: commit i push na `main` bez brancha i PR (decyzja użytkownika, wyjątek od globalnej reguły).
