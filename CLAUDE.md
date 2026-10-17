@AGENTS.md

# Claude Code

- Źródłem zasad jest `AGENTS.md` (powyżej). Tu tylko to, co specyficzne dla Claude Code; nie dubluj reguł.
- Bez npm/bundlera: testy to `node --check` na zmienionych `.js` oraz ręczna regresja z `AGENTS.md` (sekcja 6) po otwarciu `index.html` przez `file://`. Do testów przeglądarkowych użyj Playwright (skill `playwright`).
- Stan: v3 wdrożone, plus widoki macierzy (patrz `AGENTS.md` §2). `app.js` jest nadal monolitem (~330 linii), podział na `js/` robić stopniowo, osobno od funkcji.
