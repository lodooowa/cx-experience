// DANE DEMONSTRACYJNE. Edytuj WYŁĄCZNIE tablicę poniżej, jak JSON.
// Zostaw nienaruszone: window.CX_JOURNEYS = oraz końcowy średnik.
// type: standard | critical | success | choice. scene: audio | web | configurator | alert | dealer | drive | message | calendar | options | document.
// emotion: liczba 1–5, ilustracyjna. quote/insight/action/branches są opcjonalne.
window.CX_JOURNEYS = [
  {
    "id": "discovery", "personaId": "prospect", "title": "Od reklamy do jazdy próbnej",
    "subtitle": "Sześć punktów styku, jeden moment niewykorzystanej okazji.", "duration": "kilka tygodni",
    "steps": [
      {"id":"radio","title":"Reklama w radiu","short":"Pierwszy kontakt z marką","description":"Klient słyszy reklamę samochodu podczas jazdy.","type":"standard","scene":"audio","emotion":3,"owner":["Marka"],"quote":"Brzmi ciekawie. Może warto zobaczyć, co to za samochód?","insight":"Pierwszy kontakt z marką. W scenariuszu rozpoczyna zainteresowanie ofertą."},
      {"id":"www","title":"Wieczorem na stronie WWW","short":"Poznawanie oferty","description":"W domu wieczorem klient ogląda materiały promocyjne na stronie marki.","type":"standard","scene":"web","emotion":4,"owner":["Importer","Digital"],"quote":"Chcę spokojnie sprawdzić, czym ten model się wyróżnia."},
      {"id":"config","title":"Konfigurator","short":"Rosnące zaangażowanie","description":"Klient eksperymentuje z wyposażeniem, wersjami i kolorami samochodu.","type":"standard","scene":"configurator","emotion":5,"owner":["Marka","Digital"],"quote":"Ciekawe, jak wyglądałaby moja wersja?","insight":"Wysoka aktywność w konfiguratorze może być sygnałem zainteresowania. W tym przykładzie brak danych o rzeczywistej konwersji."},
      {"id":"cta","title":"Zabrakło zaproszenia na jazdę próbną","short":"Utracona okazja","description":"Po konfiguracji klient nie widzi łatwej propozycji umówienia jazdy próbnej.","type":"critical","scene":"alert","emotion":2,"owner":["Marka","Digital"],"quote":"Mam już konfigurację. A jak mogę właściwie sprawdzić ten samochód?","insight":"Punkt krytyczny określony w przykładowej ścieżce. Brak łatwego przejścia z konfiguracji do kontaktu z dealerem.","action":"Do rozważenia przez eksperta CX: widoczny i prosty sposób umówienia jazdy próbnej przy zakończeniu konfiguracji."},
      {"id":"visit","title":"Po kilku tygodniach — salon","short":"Decyzja klienta","description":"Klient sam decyduje się odwiedzić salon po kilku tygodniach przerwy.","type":"standard","scene":"dealer","emotion":3,"owner":["Klient","Dealer"],"quote":"Może jednak podjadę i zobaczę auto na żywo?"},
      {"id":"test","title":"Umówienie jazdy próbnej","short":"Dalszy ciąg nastąpi","description":"Klient umawia jazdę próbną. Historia będzie kontynuowana przez eksperta CX.","type":"success","scene":"drive","emotion":4,"owner":["Dealer"],"quote":"Wreszcie sprawdzę, jak się nim jeździ."}
    ]
  },
  {
    "id":"aftercare","personaId":"owner","title":"Wizyta w serwisie","subtitle":"Przykład doświadczenia posprzedażowego z momentem krytycznym.","duration":"3 dni",
    "steps":[
      {"id":"remind","title":"Przypomnienie o przeglądzie","description":"Klient dostaje informację o nadchodzącym terminie przeglądu.","type":"standard","scene":"message","emotion":3,"owner":["Importer"],"quote":"Dobrze, że ktoś przypomniał."},
      {"id":"booking","title":"Rezerwacja terminu","description":"Klient umawia wizytę w autoryzowanym serwisie.","type":"standard","scene":"calendar","emotion":4,"owner":["Dealer"]},
      {"id":"delay","title":"Opóźnienie w odbiorze","description":"Termin odbioru zostaje przesunięty, a informacja dociera zbyt późno.","type":"critical","scene":"alert","emotion":1,"owner":["Dealer"],"quote":"Dlaczego nie dowiedziałem się wcześniej?"},
      {"id":"pickup","title":"Odbiór samochodu","description":"Doradca wyjaśnia wykonane prace i przekazuje samochód.","type":"success","scene":"dealer","emotion":4,"owner":["Dealer"]}
    ]
  },
  {
    "id":"fleet","personaId":"fleet","title":"Zapytanie flotowe","subtitle":"Przykład punktu decyzyjnego i rozgałęzienia ścieżki.","duration":"2 tygodnie",
    "steps":[
      {"id":"lead","title":"Zapytanie firmowe","description":"Firma kontaktuje się z dealerem w sprawie nowej floty.","type":"standard","scene":"message","emotion":3,"owner":["Klient"]},
      {"id":"offer","title":"Dwa warianty oferty","description":"Dealer przedstawia alternatywne propozycje finansowania.","type":"choice","scene":"options","emotion":4,"owner":["Dealer"],"branches":[{"label":"Wariant A: prezentacja samochodów","target":"drive"},{"label":"Wariant B: dodatkowa analiza","target":"compare"}]},
      {"id":"compare","title":"Analiza ofert","description":"Klient potrzebuje dodatkowych porównań przed decyzją.","type":"standard","scene":"document","emotion":3,"owner":["Klient"]},
      {"id":"drive","title":"Prezentacja samochodów","description":"Dealer organizuje demonstrację aut flotowych.","type":"success","scene":"drive","emotion":5,"owner":["Dealer"]}
    ]
  }
];
