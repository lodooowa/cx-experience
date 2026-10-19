# JEDNORAZOWY SEED: tworzy macierz-demo.xlsx z danych DEMO (treści wymyślone, do pracy nad wizualizacją). Źródłem danych jest odtąd xlsx, który edytuje ekspert.
# Z xlsx powstają CSV i data/matrix.js przez tools/xlsx-to-data.py. Struktura 1:wiele: punkty_styku <- cechy, punkty_styku <- akcje; słowniki i procesy w osobnych zakładkach.
import csv
FLAT=["macierz","id","punkt_styku","proces","emocja","emocja_1_5","wplyw_na_emocje","typowe_bledy","wzorzec_i_wynik","bledy_diagnozowane","monitoring","przyklad","wlasciciel","ocena_cx","akcja_naprawcza","koszt","ryzyko","zysk","czas_wdrozenia_tyg","zrodla","status_danych"]
# punkt|proces|emocja|1-5|wplyw|bledy|wzorzec|diagnozowane|monitoring|przyklad|wlasciciel|ocena|akcja|koszt|ryzyko|zysk|czas|zrodla
IMP="""Reklama TV i radio|Pozyskanie|Zainteresowanie|4|Buduje pierwsze skojarzenia z marką|Obietnice nieprzystające do oferty|Spójny przekaz i jasny następny krok|Brak adresu lub kodu do kontaktu|tak|Spot zachęca do wizyty, ale nie podaje salonu|Marketing importera|ok||||||ankiety, NPS
Media społecznościowe|Pozyskanie|Ciekawość|4|Daje poczucie bliskości marki|Brak odpowiedzi na komentarze|Odpowiedź w ciągu 2 godzin|Komentarze bez reakcji przez dni|częściowo|Pytanie o cenę pod postem zostaje bez odpowiedzi|Marketing importera|do_poprawy|Dyżur moderatora w godzinach szczytu|średni|niski|średni|4|obserwacje, analityka
Targi i wydarzenia|Pozyskanie|Ekscytacja|5|Bezpośredni kontakt z autem i ludźmi|Brak kontynuacji po wydarzeniu|Zebrane kontakty trafiają do dealera w 48 h|Kontakty z targów nie trafiają do dealerów|nie|Klient zostawia dane na targach i nikt się nie odzywa|Marketing importera|niezaopiekowany|Proces przekazywania kontaktów do dealerów|średni|niski|wysoki|8|obserwacje
Strona www marki|Pozyskanie|Ciekawość|4|Pierwsze wrażenie o marce i ofercie|Nieaktualne ceny, trudna nawigacja|Klient w 3 kliknięciach znajduje model i cenę|Wysoki odsetek wyjść ze strony ofertowej|tak|Cena na stronie różni się od ceny w salonie|E-commerce importera|do_poprawy|Test użyteczności i uproszczenie menu|średni|niski|wysoki|10|analityka, opinie Google
Konfigurator online|Zakup|Zaangażowanie|4|Daje poczucie kontroli i personalizacji|Brak przejścia do kontaktu z dealerem|Z konfiguracji jednym kliknięciem umawiasz jazdę|Brak propozycji jazdy po konfiguracji|częściowo|Klient kończy konfigurację i nie wie co dalej|E-commerce importera|do_poprawy|Przycisk „umów jazdę próbną” w konfiguratorze|niski|niski|wysoki|4|analityka, obserwacje
Wyszukiwarka dealerów|Zakup|Irytacja|2|Błędne dane utrudniają pierwszy kontakt|Nieaktualne godziny i telefony|Aktualne dane z potwierdzeniem godzin pracy|Klienci trafiają pod zły numer|nie|Klient dzwoni na numer, który nie istnieje|Sprzedaż importera|niezaopiekowany|Coroczna weryfikacja danych dealerów|niski|niski|średni|6|opinie Google
Infolinia sprzedażowa|Zakup|Niepewność|3|Rozmowa daje lub odbiera pewność wyboru|Brak wiedzy o promocjach dealerów|Konsultant zna ofertę i kieruje do dealera|Sprzeczne informacje o promocjach|tak|Konsultant podaje cenę inną niż na stronie|Obsługa klienta importera|do_poprawy|Baza wiedzy o aktualnych ofertach|średni|średni|średni|8|ankiety, nagrania rozmów
Czat i chatbot|Zakup|Frustracja|2|Brak zrozumienia pytań obniża nastrój|Pętla odpowiedzi bez przekazania człowiekowi|Szybkie przekazanie do konsultanta|Wysoki odsetek rozmów porzuconych|tak|Bot powtarza te same trzy odpowiedzi|Obsługa klienta importera|do_poprawy|Przekazanie do człowieka po drugim pytaniu|średni|niski|średni|6|analityka, opinie
Kalkulator finansowania|Finansowanie|Niepewność|3|Pomaga lub zniechęca do zakupu|Wyniki bez uwzględnienia kosztów dodatkowych|Czytelna rata z podanym całkowitym kosztem|Rata różni się od oferty dealera|częściowo|Klient widzi ratę, której dealer nie potwierdza|Finanse importera|do_poprawy|Uwzględnić koszty dodatkowe w kalkulatorze|średni|średni|średni|12|opinie Google
Ubezpieczenie w pakiecie|Finansowanie||||Brak jasnej oferty||Brak danych o odbiorze oferty|nie||Finanse importera|brak_oceny|Zebrać dane o emocjach klientów w tym punkcie|niski|niski|średni|4|
Wniosek o finansowanie|Finansowanie|Napięcie|2|Czekanie na decyzję budzi stres|Długi czas decyzji bez informacji o statusie|Decyzja w 24 h z informacją o statusie|Brak informacji o statusie wniosku|tak|Klient czeka trzy dni i nie wie czy jest decyzja|Finanse importera|do_poprawy|Powiadomienia SMS o statusie wniosku|niski|niski|wysoki|5|NPS, ankiety
Potwierdzenie zamówienia|Zamówienie|Ulga|4|Daje poczucie bezpieczeństwa|Brak szczegółów o terminie|Potwierdzenie z terminem i opiekunem|Brak daty dostawy w potwierdzeniu|tak|Klient dostaje potwierdzenie bez terminu|Logistyka importera|ok||||||ankiety
Status produkcji i dostawy|Zamówienie|Niecierpliwość|2|Brak informacji wydłuża oczekiwanie|Brak aktualizacji statusu|Informacja o statusie co dwa tygodnie|Klienci dzwonią z pytaniem o termin|nie|Klient czeka pół roku bez żadnej informacji|Logistyka importera|niezaopiekowany|Automatyczne powiadomienia o etapach|średni|niski|wysoki|12|opinie Google, obserwacje
Opóźnienie dostawy|Zamówienie|Złość|1|Zerwanie obietnicy mocno obniża zaufanie|Informacja o opóźnieniu po fakcie|Wcześniejsza informacja, przeprosiny i rekompensata|Klient dowiaduje się w dniu dostawy|tak|Auto miało być w marcu, klient dowiaduje się w kwietniu|Logistyka importera|do_poprawy|Procedura informowania i rekompensaty|średni|średni|wysoki|10|NPS, opinie Google
Rejestracja i dokumenty|Dostawa|Znużenie|2|Formalności psują radość z zakupu|Brak jasnej listy dokumentów|Jedna lista kroków i dokumentów|Klient wraca po brakujące dokumenty|nie|Klient jedzie do urzędu dwa razy|Sprzedaż importera|niezaopiekowany|Lista kontrolna dokumentów w potwierdzeniu|niski|niski|średni|3|obserwacje
Pakiet powitalny|Dostawa|Radość|5|Wzmacnia emocje zakupu|Brak spójności między dealerami|Spójny pakiet z podziękowaniem od marki|Pakiet nie dociera do części klientów|częściowo|Klient dostaje list od marki z kluczem do aplikacji|Marketing importera|ok||||||ankiety
Aplikacja mobilna|Użytkowanie|Wygoda|4|Ułatwia codzienne korzystanie|Błędy po aktualizacji|Stabilna aplikacja z pełną funkcją|Niska ocena w sklepie po aktualizacji|tak|Aplikacja nie łączy się z autem po aktualizacji|Produkt i usługi cyfrowe|do_poprawy|Testy regresji przed wydaniem|średni|średni|wysoki|14|opinie w sklepach, analityka
Aktualizacje oprogramowania|Użytkowanie|Obojętność|3|Neutralne gdy działają, irytują gdy zawodzą|Brak informacji o zmianach|Czytelny opis zmian i prosty proces|Klienci nie wiedzą co zmieniła aktualizacja|częściowo|Aktualizacja zmienia ustawienia bez informacji|Produkt i usługi cyfrowe|do_poprawy|Opis zmian w aplikacji|niski|niski|średni|4|opinie, ankiety
Usługi łączności (Connected)|Użytkowanie|Rozczarowanie|2|Niespełnione obietnice cyfrowe|Funkcje niedostępne po okresie próbnym|Jasne warunki i ceny po okresie próbnym|Klienci nie wiedzą kiedy kończy się okres próbny|nie|Funkcja przestaje działać po roku bez ostrzeżenia|Produkt i usługi cyfrowe|niezaopiekowany|Przypomnienia o końcu okresu próbnego|niski|średni|wysoki|6|opinie Google
Pomoc drogowa|Użytkowanie|Ulga|4|W kryzysie liczy się szybkość i empatia|Długi czas oczekiwania na holownik|Holownik w 60 minut, kontakt na bieżąco|Rzadkie przypadki oczekiwania powyżej 2 godzin|tak|Konsultant dzwoni co 15 minut z informacją|Obsługa klienta importera|ok||||||ankiety, NPS
Kampania serwisowa|Posprzedaż|Niepokój|2|Komunikat o usterce budzi obawy|Suchy list bez wskazania kolejnych kroków|Jasna informacja, termin u dealera i brak kosztów|Klienci nie reagują na pierwszy kontakt|częściowo|Klient dostaje list i nie wie czy auto jest bezpieczne|Jakość importera|niezaopiekowany|Nowy list i SMS z linkiem do rezerwacji|niski|średni|wysoki|6|obserwacje, opinie Google
Przypomnienie o przeglądzie|Posprzedaż|Obojętność|3|Rzadko wzbudza emocje|Przypomnienie w złym momencie|Przypomnienie 30 dni wcześniej z możliwością rezerwacji|Przypomnienia wysyłane po terminie|tak|SMS przychodzi tydzień po terminie przeglądu|Posprzedaż importera|ok||||||analityka
Gwarancja i roszczenia|Posprzedaż|Napięcie|1|Spór o gwarancję mocno obniża zaufanie|Odmowa bez uzasadnienia|Decyzja w 14 dni z wyjaśnieniem|Klienci skarżą się na brak uzasadnienia odmowy|tak|Klient dostaje odmowę bez wyjaśnienia powodu|Jakość importera|do_poprawy|Szablon decyzji z uzasadnieniem i procedurą odwołania|niski|średni|wysoki|8|NPS, opinie Google
Reklamacje|Reklamacje|Złość|1|Kontakt w sprawie wady budzi silne emocje|Przekazywanie sprawy między działami|Jeden opiekun sprawy i termin odpowiedzi|Klient powtarza sprawę wielu osobom|tak|Sprawa wędruje między trzema działami|Obsługa klienta importera|niezaopiekowany|Jeden opiekun sprawy od początku|średni|średni|wysoki|16|opinie Google, NPS
Ankieta po zakupie|Posprzedaż|Zaangażowanie|3|Pokazuje że opinia się liczy|Brak informacji zwrotnej|Krótka ankieta i informacja o zmianach|Klienci nie dostają informacji o wynikach|tak|Klient nie słyszy o wynikach ankiety|Badania importera|ok||||||NPS
Program lojalnościowy|Lojalność|Docenienie|4|Buduje poczucie bycia wyróżnionym|Mało atrakcyjne korzyści|Korzyści dopasowane do stażu|Niski odsetek aktywnych uczestników|częściowo|Klient nie wie jakie ma punkty|CRM importera|do_poprawy|Widoczne saldo punktów w aplikacji|średni|niski|średni|10|analityka
Newsletter|Lojalność|Obojętność|3|Rzadko wzbudza emocje|Za duża częstotliwość i treści ogólne|Treści dopasowane do modelu klienta|Wysoki odsetek wypisań|tak|Klient dostaje oferty na model, którego nie ma|CRM importera|ok||||||analityka
Klub właścicieli|Lojalność|Duma|5|Buduje przynależność do marki|Brak oferty dla właścicieli|Cykl wydarzeń i społeczność|Brak jakiegokolwiek monitoringu|nie|Właściciele organizują się sami na forach|Marketing importera|niezaopiekowany|Pilotaż klubu w jednym regionie|średni|niski|wysoki|20|obserwacje
Oferta wymiany i odkupu|Wymiana|Zainteresowanie|3|Ułatwia decyzję o następnym aucie|Oferta bez wyceny|Wstępna wycena online|Brak oferty przed końcem umowy|nie|Klient dostaje ofertę po zakończeniu umowy|Sprzedaż importera|niezaopiekowany|Wycena online przed końcem umowy|średni|niski|wysoki|12|obserwacje
Zakończenie umowy leasingu|Wymiana|Niepewność|2|Brak jasnych kroków budzi stres|Brak informacji o opcjach|Jasna informacja o opcjach 6 miesięcy przed końcem|Klienci nie znają kosztów zwrotu|nie|Klient dostaje wycenę uszkodzeń po zwrocie|Finanse importera|do_poprawy|Przewodnik po opcjach i kosztach zwrotu|niski|średni|wysoki|8|opinie Google"""
DEA="""Zapytanie przez formularz|Zapytanie|Oczekiwanie|3|Szybka odpowiedź buduje zaufanie|Odpowiedź po kilku dniach|Odpowiedź w 1 dzień roboczy|Brak odpowiedzi w 24 h|tak|Klient czeka trzy dni na kontakt|Dealer|do_poprawy|Automatyczne potwierdzenie i przypomnienie po 4 h|niski|niski|wysoki|3|analityka, obserwacje
Telefon do salonu|Zapytanie|Irytacja|2|Długie oczekiwanie obniża nastrój|Nikt nie odbiera|Odbiór w 5 sygnałów lub oddzwonienie|Nieodebrane połączenia w godzinach pracy|nie|Klient dzwoni trzy razy w ciągu godziny|Dealer|niezaopiekowany|Raport nieodebranych połączeń|niski|niski|średni|2|opinie Google
Czat i WhatsApp salonu|Zapytanie|Wygoda|4|Szybki i wygodny kontakt|Brak obsługi poza godzinami|Odpowiedź w 30 minut|Brak monitorowania wiadomości|częściowo|Doradca odpowiada na zdjęcie auta w 10 minut|Dealer|ok||||||ankiety
Powitanie w salonie|Zakup|Zaciekawienie|4|Atmosfera buduje emocje|Klient czeka bez powitania|Powitanie w ciągu 1 minuty|Brak powitania przy dużym ruchu|nie|Klient chodzi po salonie i nikt się nie odzywa|Dyrektor salonu|niezaopiekowany|Dyżur powitalny w godzinach szczytu|niski|niski|średni|2|obserwacje, tajemniczy klient
Analiza potrzeb|Zakup|Zaangażowanie|4|Poczucie że doradca słucha|Pytania zbyt ogólne|Doradca zadaje pytania i notuje potrzeby|Doradca od razu prezentuje model|tak|Doradca pyta o codzienne dojazdy|Sprzedaż dealera|ok||||||ankiety, NPS
Prezentacja auta|Zakup|Ekscytacja|5|Moment budowania pożądania|Zbyt techniczna prezentacja|Prezentacja dopasowana do potrzeb|Prezentacja bez odniesienia do potrzeb|tak|Doradca pokazuje funkcje ważne dla rodziny klienta|Sprzedaż dealera|ok||||||ankiety, NPS
Jazda próbna|Zakup|Ekscytacja|5|Pierwszy realny kontakt z autem|Trasa niedopasowana do potrzeb|Trasa dopasowana i rozmowa po jeździe|Jazda bez rozmowy o wrażeniach|częściowo|Doradca dopasowuje trasę do dojazdów klienta|Sprzedaż dealera|ok||||||ankiety, NPS
Oferta i wycena|Zakup|Napięcie|2|Niejasne ceny budzą nieufność|Oferta bez wyjaśnienia składników|Jedna czytelna oferta|Klient nie rozumie różnic między ofertami|nie|Dwie oferty o różnych cenach bez wyjaśnienia|Sprzedaż dealera|niezaopiekowany|Ujednolicony szablon oferty|niski|niski|wysoki|4|opinie Google, obserwacje
Negocjacje|Zakup|Napięcie|2|Presja obniża komfort|Presja czasu i zmiana warunków|Spokojna rozmowa o wartości|Zmiana warunków w trakcie rozmowy|nie|Doradca zmienia rabat po konsultacji z szefem|Sprzedaż dealera|niezaopiekowany|Zasady rabatowe znane klientowi|niski|średni|średni|6|opinie Google
Wycena auta w rozliczeniu|Zakup|Niepewność|2|Różnica z oczekiwaniami frustruje|Wycena bez uzasadnienia|Wycena z uzasadnieniem|Klienci porównują wycenę z internetem|częściowo|Klient dostaje niższą wycenę niż online|Sprzedaż dealera|do_poprawy|Raport wyceny z uzasadnieniem|niski|niski|średni|4|opinie Google, ankiety
Finansowanie u dealera|Finansowanie|Niepewność|3|Rozmowa o kosztach budzi napięcie|Za mało czasu na wyjaśnienia|Przejrzyste warunki|Klient podpisuje bez zrozumienia|tak|Doradca omija koszty dodatkowe|Finanse dealera|do_poprawy|Karta jednej strony z warunkami|niski|średni|wysoki|5|ankiety, NPS
Umowa i formalności|Zakup|Znużenie|2|Papierologia osłabia emocje|Długi czas i wiele dokumentów|Podpisanie w 30 minut|Powtarzanie tych samych danych|nie|Klient przepisuje dane na pięciu formularzach|Sprzedaż dealera|niezaopiekowany|Cyfrowe podpisywanie|średni|niski|średni|12|obserwacje
Przygotowanie auta do wydania|Dostawa|Oczekiwanie|4|Budzi radosne oczekiwanie|Auto brudne lub z brakami|Auto czyste i kompletne|Rzadkie braki w wyposażeniu|tak|Auto czeka umyte i z dopiętymi dodatkami|Dealer|ok||||||ankiety
Wydanie auta|Dostawa|Radość|5|Moment ważny emocjonalnie|Pośpiech i formalności|Uroczyste wydanie|Brak czasu na omówienie|tak|Klient dostaje kluczyki i zdjęcie|Dealer|ok||||||ankiety, NPS
Szkolenie z obsługi auta|Dostawa|Pewność|4|Daje poczucie opanowania auta|Brak pokazania funkcji|Pokazanie 10 najważniejszych funkcji|Klient nie umie obsłużyć systemu|częściowo|Nikt nie pokazuje jak sparować telefon|Sprzedaż dealera|do_poprawy|Lista 10 funkcji do pokazania|niski|niski|średni|3|ankiety
Kontakt po 7 dniach od wydania|Dostawa|Docenienie|4|Pokazuje troskę o klienta|Brak jakiegokolwiek kontaktu|Telefon lub SMS po 7 dniach|Brak działań po wydaniu|nie|Klient nie słyszy od dealera po odbiorze|Sprzedaż dealera|niezaopiekowany|SMS po 7 dniach od wydania|niski|niski|średni|2|obserwacje
Rezerwacja serwisu|Serwis|Wygoda|3|Łatwa rezerwacja zmniejsza opór|Rezerwacja tylko telefoniczna|Rezerwacja online w 2 minuty|Brak wolnych terminów online|częściowo|Klient dzwoni trzy razy|Serwis dealera|do_poprawy|Rezerwacja online z kalendarzem|średni|średni|wysoki|16|analityka, opinie Google
Przyjęcie do serwisu|Serwis|Niepewność|3|Klient nie wie co się stanie z autem|Brak omówienia zakresu i kosztu|Doradca potwierdza zakres, koszt i termin|Brak potwierdzenia kosztu|częściowo|Klient zostawia auto i nie wie kiedy będzie informacja|Serwis dealera|do_poprawy|Karta przyjęcia z kosztem i terminem|niski|niski|średni|3|ankiety, NPS
Kosztorys napraw|Serwis|Niepokój|2|Wysoka cena budzi obawy|Brak wyjaśnienia pozycji|Wyjaśnienie każdej pozycji|Klient nie rozumie kosztów|tak|Kosztorys bez opisu prac|Serwis dealera|do_poprawy|Opisy prac prostym językiem|niski|niski|średni|4|opinie Google
Prace dodatkowe|Serwis|Złość|1|Niespodzianka kosztowa mocno obniża zaufanie|Wykonanie prac bez zgody klienta|Zgoda klienta przed każdą pracą dodatkową|Faktura wyższa niż kosztorys|tak|Faktura wyższa o 30 procent bez telefonu|Serwis dealera|niezaopiekowany|Telefon przed każdą pracą dodatkową|niski|średni|wysoki|3|NPS, opinie Google
Auto zastępcze|Serwis|Wdzięczność|4|Zmniejsza uciążliwość wizyty|Brak dostępności|Auto dostępne bez kaucji|Brak aut zastępczych w szczycie|tak|Klient dostaje auto na czas naprawy|Serwis dealera|ok||||||ankiety, NPS
Poczekalnia|Serwis|Znużenie|3|Komfort wpływa na nastrój|Brak kawy i internetu|Komfortowa poczekalnia|Skargi na komfort|nie|Klient czeka dwie godziny bez wody|Serwis dealera|do_poprawy|Odświeżenie poczekalni|średni|niski|niski|10|opinie Google
Informowanie o postępie prac|Serwis|Niecierpliwość|2|Brak informacji wydłuża oczekiwanie|Brak aktualizacji o statusie|SMS o postępie prac|Klienci dzwonią z pytaniem o status|nie|Klient dzwoni cztery razy|Serwis dealera|niezaopiekowany|SMS o statusie naprawy|niski|niski|wysoki|4|opinie Google
Odbiór po serwisie|Serwis||||Brak wyjaśnienia prac|Pełne wyjaśnienie prac||nie||Serwis dealera|brak_oceny|Zebrać dane o emocjach klientów|niski|niski|średni|2|
Rozliczenie i faktura|Serwis|Obojętność|3|Neutralne gdy zgodne z ofertą|Zbyt skomplikowana faktura|Przejrzysta faktura|Pytania o pozycje faktury|tak|Klient prosi o wyjaśnienie faktury|Serwis dealera|ok||||||ankiety
Kontakt po serwisie|Serwis|Docenienie|4|Pokazuje troskę o klienta|Brak jakiegokolwiek kontaktu|SMS po 3 dniach|Brak działań po wizycie|nie|Klient nigdy nie słyszy od serwisu po odbiorze|Serwis dealera|niezaopiekowany|SMS po 3 dniach|niski|niski|średni|2|obserwacje
Naprawa gwarancyjna|Gwarancja|Napięcie|1|Spór o gwarancję obniża zaufanie|Odmowa bez wyjaśnienia|Jasne zasady i szybka decyzja|Odmowy bez uzasadnienia|tak|Serwis odmawia naprawy i odsyła do importera|Serwis dealera|do_poprawy|Wyjaśnienie zasad gwarancji klientowi|niski|średni|wysoki|6|NPS, opinie Google
Naprawa blacharska po wypadku|Serwis|Stres|2|Trudna sytuacja życiowa klienta|Brak empatii i informacji|Opiekun sprawy i terminy|Brak opiekuna sprawy|częściowo|Klient po wypadku sam kontaktuje się z ubezpieczycielem|Serwis dealera|do_poprawy|Opiekun sprawy dla napraw powypadkowych|średni|niski|wysoki|8|opinie Google
Sprzedaż samochodów używanych|Auta używane|Nieufność|2|Niska pewność co do stanu auta|Brak historii auta|Pełna historia i gwarancja|Skargi na stan auta|nie|Klient odkrywa wadę po tygodniu|Sprzedaż dealera|niezaopiekowany|Raport stanu auta|średni|średni|wysoki|10|opinie Google
Kontakt przed końcem umowy|Lojalność|Zainteresowanie|3|Szansa na kolejną sprzedaż|Brak kontaktu przed końcem|Kontakt 6 miesięcy przed końcem|Klient dowiaduje się z listu|nie|Klient nie zna opcji na koniec umowy|Sprzedaż dealera|niezaopiekowany|Kontakt 6 miesięcy przed końcem|niski|niski|wysoki|4|obserwacje"""

RISKS="""imp-02|Dyżury wymagają obsady poza godzinami pracy
imp-03|Zła jakość danych kontaktowych z wydarzeń
imp-04|Wymaga uzgodnienia z działem prawnym i zespołem UX
imp-05|Integracja z systemami dealerów
imp-06|Dealerzy muszą aktualizować dane sami
imp-07|Baza wiedzy szybko się dezaktualizuje
imp-08|Zmiana wymaga prac po stronie dostawcy chatbota
imp-09|Zmiana wyliczeń wymaga zgody działu prawnego
imp-10|Brak kontaktu z klientami w tym punkcie
imp-11|Koszt wysyłki SMS i integracja z systemem wniosków
imp-13|Dane o produkcji mogą być niepełne
imp-14|Rekompensaty zwiększają koszty
imp-15|Wymaga uzgodnienia z urzędami
imp-17|Ryzyko opóźnienia wydań aplikacji
imp-18|Ryzyko niezgodności z oprogramowaniem auta
imp-19|Zmiana komunikacji wymaga zgody działu prawnego
imp-21|Ryzyko zbyt alarmującego tonu komunikatu
imp-23|Potrzebna zgoda działu prawnego i jakości
imp-24|Opiekun musi mieć uprawnienia do decyzji
imp-26|Zmiana integracji z aplikacją
imp-28|Pilotaż może nie wzbudzić zainteresowania
imp-29|Wycena wymaga danych rynkowych
imp-30|Koszty zwrotu zależą od leasingodawcy
dea-01|Doradcy mogą ignorować przypomnienia
dea-02|Wymaga zmiany organizacji dyżurów
dea-04|Doradcy mogą odbierać dyżur jako obciążenie
dea-08|Dealerzy mają własne procedury ofertowania
dea-09|Rabaty zależą od polityki importera
dea-10|Różne standardy wyceny między dealerami
dea-11|Zmiana szablonu wymaga zgody finansującego
dea-12|Integracja z systemem umów
dea-15|Brak czasu przy wydaniu auta
dea-16|Kontakt wymaga zgód marketingowych
dea-17|Integracja z systemem serwisowym
dea-18|Doradcy muszą zmienić nawyki
dea-19|Czasochłonne opisywanie prac
dea-20|Opór serwisu przed dodatkowym kontaktem
dea-22|Remont może kolidować z pracą serwisu
dea-23|Wymaga integracji z systemem warsztatowym
dea-24|Brak jednego opiekuna sprawy
dea-26|Kontakt wymaga zgód marketingowych
dea-27|Ryzyko rozbieżności z polityką importera
dea-28|Obciążenie zespołu opiekunów
dea-29|Koszt raportów stanu
dea-30|Kontakt wymaga zgód marketingowych"""
# dodatkowe cechy: punkt_id|typ|tresc  (typ: dobra_praktyka, blad_typowy, blad_diagnozowany, przyklad, zrodlo)
EXTRA_CECHY="""imp-01|dobra_praktyka|Kreacje spójne we wszystkich kanałach
imp-01|blad_typowy|Zbyt wiele obietnic w jednym spocie
imp-03|dobra_praktyka|Dane kontaktowe zbierane na miejscu przez skan kodu
imp-05|dobra_praktyka|Zapisywanie konfiguracji na koncie klienta
imp-05|blad_typowy|Brak podglądu ceny końcowej
imp-05|blad_diagnozowany|Wysoki odsetek porzuceń na ostatnim kroku
imp-07|dobra_praktyka|Konsultant widzi historię kontaktów klienta
imp-13|blad_typowy|Status zmienia się bez komunikatu do klienta
imp-14|dobra_praktyka|Przeprosiny i konkretna rekompensata
imp-17|blad_typowy|Niezrozumiałe komunikaty błędów
imp-19|dobra_praktyka|Jasna tabela funkcji i okresów próbnych
imp-20|dobra_praktyka|Konsultant podaje czas dojazdu na bieżąco
imp-21|dobra_praktyka|SMS z linkiem do rezerwacji terminu
imp-23|dobra_praktyka|Jeden opiekun roszczenia od zgłoszenia do decyzji
imp-24|blad_typowy|Odpowiedzi szablonowe bez odniesienia do sprawy
imp-24|blad_diagnozowany|Czas rozpatrzenia przekracza deklarowany
imp-26|dobra_praktyka|Korzyści widoczne w aplikacji
imp-28|dobra_praktyka|Wydarzenia lokalne organizowane z dealerami
dea-01|dobra_praktyka|Automatyczne potwierdzenie przyjęcia zgłoszenia
dea-03|dobra_praktyka|Doradca przedstawia się z imienia
dea-04|blad_typowy|Doradca zajęty innym klientem
dea-07|dobra_praktyka|Rozmowa po jeździe o wrażeniach
dea-07|dobra_praktyka|Trasa wybrana z klientem
dea-08|blad_diagnozowany|Oferta dociera po tygodniu
dea-14|dobra_praktyka|Zdjęcie pamiątkowe z kluczykami
dea-14|dobra_praktyka|Omówienie najważniejszych funkcji
dea-17|blad_diagnozowany|Brak wolnych terminów w ciągu 2 tygodni
dea-19|blad_typowy|Opisy prac w żargonie
dea-20|blad_diagnozowany|Klienci zgłaszają prace bez zgody
dea-21|dobra_praktyka|Auto zastępcze bez kaucji
dea-21|blad_typowy|Brak dostępności w szczycie sezonu
dea-24|dobra_praktyka|Doradca omawia prace przy aucie
dea-27|dobra_praktyka|Wyjaśnienie zasad gwarancji przed naprawą
dea-28|dobra_praktyka|Pomoc w kontakcie z ubezpieczycielem
dea-29|blad_typowy|Brak pełnej historii serwisowej
dea-29|dobra_praktyka|Gwarancja dealera na auto używane"""
# dodatkowe akcje: punkt_id|rodzaj|opis|koszt|ryzyko|zysk|czas|ryzyka_wdrozenia
EXTRA_AKCJE="""imp-05|docelowa|Integracja konfiguratora z systemem dealerów|wysoki|średni|wysoki|26|Integracja z wieloma systemami
imp-13|docelowa|Portal klienta ze statusem zamówienia|wysoki|średni|wysoki|30|Zależność od danych z produkcji
imp-24|docelowa|System jednego rekordu sprawy|wysoki|wysoki|wysoki|40|Duży projekt IT i zmiana procesów
imp-28|docelowa|Ogólnopolski klub właścicieli|wysoki|średni|wysoki|52|Wymaga stałego budżetu
imp-03|quick_win|Formularz zbierania kontaktów przez kod QR na stoisku|niski|niski|średni|2|Wymaga obsady stoiska
dea-02|docelowa|Centralny numer z kolejką dla salonu|średni|średni|wysoki|16|Zmiana organizacji pracy
dea-17|quick_win|Przypomnienia o terminie serwisu|niski|niski|średni|3|Wymaga zgód marketingowych
dea-20|docelowa|Aplikacja do akceptacji prac przez klienta|wysoki|średni|wysoki|24|Wdrożenie w całej sieci
dea-23|quick_win|Zdjęcia z postępu prac wysyłane SMS-em|niski|niski|średni|2|Czas pracy mechaników
dea-29|docelowa|Certyfikacja aut używanych|wysoki|średni|wysoki|36|Koszt i audyt dealerów"""

def build(prefix,text):
    out=[]
    for i,l in enumerate(text.split("\n"),1):
        f=l.split("|")
        assert len(f)==18,(prefix,i,len(f),f[0])
        out.append(dict(zip(FLAT[2:20],f),macierz="importer" if prefix=="imp" else "dealer",id=f"{prefix}-{i:02d}"))
    return out
flat=build("imp",IMP)+build("dea",DEA)

# Podtyp punktu w macierzy dealera (DEMO): dealer / salon / serwis. Importer nie ma podtypu.
SALON=set(list(range(2,11))+[13,14,15])
def podtyp(r):
    if r["macierz"]!="dealer": return ""
    n=int(r["id"][4:])
    return "salon" if n in SALON else "serwis" if 17<=n<=28 or n==27 else "dealer"
# Stopień zaopiekowania 1-5 (DEMO): wynika z oceny CX; w obrębie oceny na przemian niższy/wyższy. Brak oceny = brak wartości.
_n={}
def opieka(r):
    k=r["ocena_cx"]; i=_n[k]=_n.get(k,-1)+1
    return {"niezaopiekowany":[1,2],"do_poprawy":[3,3],"ok":[4,5]}.get(k,["",""])[i%2]
risks=dict(l.split("|",1) for l in RISKS.split("\n"))
punkty=[[r["macierz"],podtyp(r),r["id"],r["punkt_styku"],r["proces"],r["emocja"],r["emocja_1_5"],r["wplyw_na_emocje"],r["monitoring"],r["wlasciciel"],r["ocena_cx"],"DEMO",opieka(r),""] for r in flat]
PH=["macierz","podtyp","id","punkt_styku","proces","emocja","emocja_1_5","wplyw_na_emocje","monitoring","wlasciciel","ocena_cx","status_danych","zaopiekowanie_1_5","tor_nadpisanie"]

cechy=[]
def addc(pid,typ,tr):
    cechy.append([pid,typ,tr,"DEMO"])
for r in flat:
    if r["wzorzec_i_wynik"]: addc(r["id"],"dobra_praktyka",r["wzorzec_i_wynik"])
    if r["typowe_bledy"]: addc(r["id"],"blad_typowy",r["typowe_bledy"])
    if r["bledy_diagnozowane"]: addc(r["id"],"blad_diagnozowany",r["bledy_diagnozowane"])
    if r["przyklad"]: addc(r["id"],"przyklad",r["przyklad"])
    for z in r["zrodla"].split(", "):
        if z: addc(r["id"],"zrodlo",z)
for l in EXTRA_CECHY.split("\n"):
    a,b,c=l.split("|"); addc(a,b,c)
cechy.sort(key=lambda x:x[0])
cechy=[[f"ch-{i:03d}"]+c for i,c in enumerate(cechy,1)]
CH=["id","punkt_id","typ","tresc","status_danych"]

akcje=[]
for r in flat:
    if r["akcja_naprawcza"]:
        t=int(r["czas_wdrozenia_tyg"])
        akcje.append([r["id"],"quick_win" if t<=6 else "docelowa",r["akcja_naprawcza"],r["koszt"],r["ryzyko"],r["zysk"],t,risks.get(r["id"],"")])
for l in EXTRA_AKCJE.split("\n"):
    a,b,c,d,e,f,g,h=l.split("|"); akcje.append([a,b,c,d,e,f,int(g),h])
akcje.sort(key=lambda x:x[0])
akcje=[[f"ak-{i:03d}"]+a+["DEMO"] for i,a in enumerate(akcje,1)]
AH=["id","punkt_id","rodzaj","opis","koszt","ryzyko","zysk","czas_wdrozenia_tyg","ryzyka_wdrozenia","status_danych"]

# Mapa przepływu (DEMO, wymyślona na potrzeby pokazania mechaniki; ekspert CX nadpisze własną): punkt|następny|etykieta|opcjonalny
NASTEPNE="""imp-01|imp-04||nie
imp-02|imp-04||nie
imp-03|dea-01|kontakty z targów|nie
imp-04|imp-05||nie
imp-04|imp-06||tak
imp-04|imp-07|pytanie o ofertę|tak
imp-04|imp-08|czat|tak
imp-04|imp-09|finansowanie|tak
imp-05|dea-01|zapytanie|nie
imp-05|dea-07|umów jazdę|tak
imp-06|dea-02||nie
imp-07|dea-01||nie
imp-08|dea-03||nie
imp-09|dea-11||tak
dea-01|dea-04||nie
dea-02|dea-04||nie
dea-03|dea-04||nie
dea-04|dea-05||nie
dea-05|dea-06||nie
dea-06|dea-07||tak
dea-06|dea-08||nie
dea-07|dea-08||nie
dea-08|dea-09||tak
dea-08|dea-10||tak
dea-08|dea-11||tak
dea-08|dea-12||nie
dea-09|dea-12||nie
dea-10|dea-12||nie
dea-11|dea-12||nie
dea-11|imp-10|ubezpieczenie|tak
dea-11|imp-11|wniosek|tak
imp-10|dea-12||nie
imp-11|dea-12||nie
dea-12|imp-12||nie
imp-12|imp-13||nie
imp-13|imp-14|gdy opóźnienie|tak
imp-13|dea-13||nie
imp-14|dea-13||nie
dea-13|dea-14||nie
dea-14|imp-15||tak
dea-14|imp-16||tak
dea-14|dea-15||nie
dea-15|dea-16||nie
imp-15|imp-17||nie
imp-16|imp-17||nie
dea-16|imp-17||nie
dea-16|imp-25||tak
imp-17|imp-18||tak
imp-17|imp-19||tak
imp-17|imp-20|awaria|tak
imp-17|imp-21||tak
imp-17|imp-22||tak
imp-17|imp-24|wada|tak
imp-21|dea-17||tak
imp-22|dea-17||nie
imp-17|dea-17||nie
dea-17|dea-18||nie
dea-17|dea-28|po wypadku|tak
dea-18|dea-19||nie
dea-18|dea-21||tak
dea-18|dea-22||tak
dea-18|dea-27|gwarancja|tak
dea-19|dea-20||tak
dea-19|dea-23||nie
dea-20|dea-23||nie
dea-21|dea-23||nie
dea-22|dea-23||nie
dea-28|dea-19||nie
dea-23|dea-24||nie
dea-24|dea-25||nie
dea-25|dea-26||nie
dea-26|imp-22|kolejny przegląd|tak
dea-26|imp-26||tak
dea-27|imp-23|odwołanie|tak
imp-23|imp-24||tak
imp-25|imp-26||nie
imp-26|imp-27||tak
imp-26|imp-28||tak
imp-26|dea-30||tak
dea-30|imp-30||nie
imp-30|imp-29||nie
imp-29|dea-29||tak
imp-29|dea-01|kolejny zakup|tak"""
PRZYPADKI="""P-01|Zakup z jazdą próbną|Klient DEMO A|Model DEMO X|DEMO-001
P-02|Serwis z niespodzianką|Klient DEMO B|Model DEMO Y|DEMO-002
P-03|Odmowa naprawy gwarancyjnej|||"""
KROKI="""P-01|1|imp-01|zadzialal|Klient słyszy spot i zapamiętuje markę.
P-01|2|imp-04|zadzialal|Na stronie znajduje model i orientacyjną cenę.
P-01|3|imp-05|czesciowo|Konfiguruje auto, ale nie widzi jak umówić jazdę.
P-01|4|dea-01|nie_zadzialal|Wysyła zapytanie, odpowiedź przychodzi po trzech dniach.
P-01|5|dea-04|zadzialal|W salonie zostaje powitany po minucie.
P-01|6|dea-05|zadzialal|Doradca pyta o dojazdy i potrzeby rodziny.
P-01|7|dea-06|zadzialal|Prezentacja skupia się na tym, co ważne dla klienta.
P-01|8|dea-07|zadzialal|Jazda po trasie zbliżonej do codziennych dojazdów.
P-01|9|dea-08|czesciowo|Oferta jest czytelna, ale bez wyjaśnienia dodatków.
P-01|10|dea-12|czesciowo|Podpisanie trwa dwie godziny, dane trzeba przepisywać.
P-01|11|imp-12|zadzialal|Potwierdzenie przychodzi od razu, ale bez terminu.
P-01|12|imp-13|nie_zadzialal|Przez kilka miesięcy brak informacji o statusie.
P-01|13|imp-14|nie_zadzialal|O opóźnieniu klient dowiaduje się w dniu dostawy.
P-01|14|dea-13|zadzialal|Auto czeka umyte i kompletne.
P-01|15|dea-14|zadzialal|Uroczyste wydanie kluczyków.
P-01|16|dea-15|czesciowo|Doradca pokazuje tylko kilka funkcji.
P-01|17|dea-16|brakuje|Po wydaniu auta nikt się nie odzywa.
P-02|1|dea-17|czesciowo|Rezerwacja tylko telefoniczna, trzy próby.
P-02|2|dea-18|czesciowo|Przyjęcie bez potwierdzenia kosztu.
P-02|3|dea-19|zadzialal|Kosztorys z opisem prac.
P-02|4|dea-20|nie_zadzialal|Prace dodatkowe wykonane bez zgody klienta.
P-02|5|dea-23|brakuje|Brak informacji o postępie prac.
P-02|6|dea-24|zadzialal|Odbiór bez kolejki.
P-02|7|dea-25|czesciowo|Faktura wyższa od kosztorysu, pytania o pozycje.
P-02|8|dea-26|brakuje|Po odbiorze brak kontaktu z serwisu.
P-03|1|dea-17|zadzialal|Rezerwacja online bez problemu.
P-03|2|dea-18|czesciowo|Doradca przyjmuje auto, nie omawia zasad gwarancji.
P-03|3|dea-27|nie_zadzialal|Odmowa naprawy bez uzasadnienia.
P-03|4|imp-23|nie_zadzialal|Importer odsyła sprawę bez decyzji.
P-03|5|imp-24|nie_zadzialal|Sprawa wędruje między działami."""

import os, sys, json, datetime
PROCESY=["Pozyskanie","Zapytanie","Zakup","Finansowanie","Zamówienie","Dostawa","Użytkowanie","Serwis","Posprzedaż","Gwarancja","Reklamacje","Auta używane","Lojalność","Wymiana"]
assert {r[4] for r in punkty}<=set(PROCESY),{r[4] for r in punkty}-set(PROCESY)
assert {r[11] for r in punkty}=={"DEMO"}
labels={"matrix":{"importer":"Importer","dealer":"Dealer i serwis"},
 "subtype":{"dealer":"Dealer","salon":"Salon","serwis":"Serwis"},
 "rating":{"niezaopiekowany":"Niezaopiekowany","do_poprawy":"Do poprawy","ok":"W porządku","brak_oceny":"Brak oceny"},
 "monitoring":{"tak":"Monitorowany","częściowo":"Monitorowany częściowo","nie":"Niemonitorowany"},
 "featureType":{"dobra_praktyka":"Dobre praktyki","blad_typowy":"Błędy typowe","blad_diagnozowany":"Błędy diagnozowane","przyklad":"Przykłady z życia","zrodlo":"Źródła danych"},
 "actionKind":{"quick_win":"Quick win","docelowa":"Usprawnienie docelowe"}}
SH=["grupa","klucz","etykieta"]
labels["stan"]={"zadzialal":"Zadziałał","czesciowo":"Częściowo","nie_zadzialal":"Nie zadziałał","brakuje":"Brakuje"}
slowniki=[[g,k,v] for g,d in labels.items() for k,v in d.items()]
NH=["punkt_id","nastepny_id","etykieta","opcjonalny","status_danych"]
nastepne=[l.split("|")+["DEMO"] for l in NASTEPNE.split("\n")]
PCH=["przypadek_id","nazwa","klient","model_pojazdu","numer_sprawy","status_danych"]
przypadki=[l.split("|")+["DEMO"] for l in PRZYPADKI.split("\n")]
KH=["przypadek_id","lp","punkt_id","stan","co_sie_stalo","status_danych"]
kroki=[[a,int(b),c,d,e,"DEMO"] for a,b,c,d,e in (l.split("|") for l in KROKI.split("\n"))]
PRH=["lp","nazwa"]
procesy=[[i,n] for i,n in enumerate(PROCESY,1)]
ids={r[2] for r in punkty}
assert all(c[1] in ids for c in cechy) and all(a[1] in ids for a in akcje)

if os.path.exists("macierz-demo.xlsx") and "--force" not in sys.argv:
    sys.exit("macierz-demo.xlsx już istnieje i jest źródłem danych: ten skrypt go nie nadpisze (--force wymusza, zmiany eksperta przepadną).")
ie=PH.index("emocja_1_5")
punkty=[[int(v) if i==ie and str(v).isdigit() else v for i,v in enumerate(r)] for r in punkty]
tables=[("punkty_styku",PH,punkty),("cechy",CH,cechy),("akcje",AH,akcje),("slowniki",SH,slowniki),("procesy",PRH,procesy),("nastepne",NH,nastepne),("przypadki",PCH,przypadki),("kroki_przypadku",KH,kroki)]
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment
wb=Workbook(); wb.remove(wb.active)
for n,h,rows in tables:
    ws=wb.create_sheet(n); ws.append(h)
    for r in rows: ws.append(r)
    for c in ws[1]: c.font=Font(bold=True,color="FFFFFF"); c.fill=PatternFill("solid",fgColor="041428")
    ws.freeze_panes="A2"; ws.auto_filter.ref=ws.dimensions
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width=min(60,max(10,max(len(str(c.value or "")) for c in col)+2))
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment=Alignment(wrap_text=True,vertical="top")
# Listy rozwijane (błąd wyświetla Excel, zanim zadziała konwerter) i zakładka czytaj_mnie. Konwerter ignoruje zakładki spoza SHEETS.
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
def dv(sheet,header,col,formula,title,msg,kind="list"):
    ws=wb[sheet]; letter=get_column_letter(header.index(col)+1)
    v=DataValidation(type=kind,formula1=formula,allow_blank=True,showErrorMessage=True,errorTitle=title,error=msg)
    if kind=="whole": v.operator="between"; v.formula2="5" if formula=="1" else "1000"
    ws.add_data_validation(v); v.add(f"{letter}2:{letter}1000")
def group(g):
    rows=[i for i,r in enumerate(slowniki,2) if r[0]==g]
    return f"=slowniki!$B${rows[0]}:$B${rows[-1]}"
ID_PUNKTU="=punkty_styku!$C$2:$C$1000"
dv("punkty_styku",PH,"macierz",group("matrix"),"Macierz","Wybierz wartość z listy (słownik).")
dv("punkty_styku",PH,"podtyp",group("subtype"),"Podtyp","Wybierz wartość z listy (słownik) albo zostaw puste.")
dv("punkty_styku",PH,"ocena_cx",group("rating"),"Ocena CX","Wybierz wartość z listy (słownik).")
dv("punkty_styku",PH,"monitoring",group("monitoring"),"Monitoring","Wybierz wartość z listy (słownik).")
dv("punkty_styku",PH,"proces","=procesy!$B$2:$B$1000","Proces","Wybierz proces z zakładki procesy.")
for c in ("emocja_1_5","zaopiekowanie_1_5"): dv("punkty_styku",PH,c,"1","Skala 1-5","Wpisz liczbę całkowitą od 1 do 5.","whole")
dv("cechy",CH,"punkt_id",ID_PUNKTU,"Punkt","Wybierz ID z zakładki punkty_styku.")
dv("cechy",CH,"typ",group("featureType"),"Typ cechy","Wybierz wartość z listy (słownik).")
dv("akcje",AH,"punkt_id",ID_PUNKTU,"Punkt","Wybierz ID z zakładki punkty_styku.")
dv("akcje",AH,"rodzaj",group("actionKind"),"Rodzaj akcji","Wybierz wartość z listy (słownik).")
for c in ("koszt","ryzyko","zysk"): dv("akcje",AH,c,'"niski,średni,wysoki"',c.capitalize(),"Wybierz: niski, średni albo wysoki.")
dv("akcje",AH,"czas_wdrozenia_tyg","0","Czas","Wpisz liczbę całkowitą tygodni.","whole")
dv("nastepne",NH,"punkt_id",ID_PUNKTU,"Punkt","Wybierz ID z zakładki punkty_styku.")
dv("nastepne",NH,"nastepny_id",ID_PUNKTU,"Punkt","Wybierz ID z zakładki punkty_styku.")
dv("nastepne",NH,"opcjonalny",'"tak,nie"',"Opcjonalny","Wybierz: tak albo nie (puste = nie).")
dv("kroki_przypadku",KH,"przypadek_id","=przypadki!$A$2:$A$1000","Przypadek","Wybierz ID z zakładki przypadki.")
dv("kroki_przypadku",KH,"punkt_id",ID_PUNKTU,"Punkt","Wybierz ID z zakładki punkty_styku.")
dv("kroki_przypadku",KH,"stan",group("stan"),"Stan","Wybierz wartość z listy (słownik).")
dv("kroki_przypadku",KH,"lp","1","Numer kroku","Wpisz liczbę całkowitą od 1 w górę.","whole")
for ws in (wb["punkty_styku"],wb["cechy"],wb["akcje"],wb["nastepne"],wb["przypadki"],wb["kroki_przypadku"]): ws.sheet_properties.tabColor="2E7D32"
for n in ("slowniki","procesy"): wb[n].sheet_properties.tabColor="9E9E9E"
README=[
("CZYTAJ MNIE: jak uzupełniać ten plik",""),
("","Ten plik jest źródłem danych dla wizualizacji (macierz, priorytety, radar, mapa przepływu). Zielone zakładki wypełniasz Ty, szare (slowniki, procesy) zmieniasz tylko przy nowym torze, stanie albo procesie."),
("Kolejność pracy",""),
("1","punkty_styku: jeden wiersz na punkt styku. Nadaj unikalne ID (np. imp-01). Proces, ocenę, monitoring i macierz wybierz z listy."),
("2","cechy i akcje: wiele wierszy na punkt. W kolumnie punkt_id wybierz ID z listy."),
("3","nastepne: mapa przepływu. Jeden wiersz = krok z punktu (punkt_id) do kolejnego (nastepny_id). Kilka wierszy z tym samym punkt_id to rozwidlenie. Opcjonalny = tak, jeśli krok można pominąć. Powroty do wcześniejszego punktu są dozwolone."),
("4","przypadki: prawdziwy przebieg klienta (nazwa wymagana; klient, model_pojazdu i numer_sprawy opcjonalne). Nadaj unikalne przypadek_id (np. P-04)."),
("5","kroki_przypadku: kroki przypadku w kolejności lp (1, 2, 3...). Wybierz punkt i stan. W co_sie_stalo opisz, co zadziałało lub nie. Punkt, którego przypadek nie dotknął, po prostu pomiń."),
("Stany kroku (stan)","zadzialal, czesciowo, nie_zadzialal, brakuje (punkt, który powinien wystąpić, a go nie było). Etykiety są w zakładce slowniki."),
("Tory mapy","Domyślnie wynikają z macierzy i podtypu punktu (importer, dealer, salon, serwis). Nowy tor: wpisz jego nazwę w kolumnie tor_nadpisanie punktu i dodaj etykietę w slowniki (grupa tor; kolejność wierszy to kolejność torów; ID toru nie może być samą liczbą)."),
("status_danych","Wartość DEMO oznacza dane przykładowe. Wiersze własne oznacz inaczej albo zostaw puste; nie zostawiaj DEMO przy danych prawdziwych."),
("Po edycji","Zapisz plik i zamknij Excela. Kliknij dwukrotnie 2-konwertuj-dane.command (macOS) albo 2-konwertuj-dane.bat (Windows). Jeśli pojawi się błąd, zawiera nazwę zakładki i numer wiersza do poprawy."),
("Zasady","Nie zmieniaj nazw zakładek ani nagłówków kolumn, nie wstawiaj kolumn ani pustych wierszy w środku tabeli. Teksty wpisuj zwykłym tekstem."),
]
rm=wb.create_sheet("czytaj_mnie",0)
for a,b in README: rm.append([a,b])
rm.column_dimensions["A"].width=24; rm.column_dimensions["B"].width=110
for row in rm.iter_rows():
    for c in row: c.alignment=Alignment(wrap_text=True,vertical="top")
    if row[0].value and not row[1].value or row[0].row==1: row[0].font=Font(bold=True,size=13 if row[0].row==1 else 11)
    elif row[0].value: row[0].font=Font(bold=True)
rm.sheet_properties.tabColor="041428"
wb.active=0
wb.properties.created=wb.properties.modified=datetime.datetime(2026,1,1)
wb.save("macierz-demo.xlsx")
print("macierz-demo.xlsx:",len(punkty),len(cechy),len(akcje),"- teraz uruchom tools/xlsx-to-data.py")
