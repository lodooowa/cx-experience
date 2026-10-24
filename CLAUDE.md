@AGENTS.md

# Claude Code

- Źródłem zasad jest `AGENTS.md` (powyżej). Tu tylko to, co specyficzne dla Claude Code; nie dubluj reguł.
- Bez npm/bundlera: testy to `node --check` na zmienionych `.js` oraz regresja z `AGENTS.md` (sekcja 6) przez `file://`. Prowadź ją skillem `cx-regression` (testy z `tools/` + smoke wszystkich stron w Chromium).
- Zmiany UI prowadź według „Zmiany w UI: tryb pracy” w `AGENTS.md` §6. Zrzuty i interakcje: Playwright z cache npx (MCP nie ma Chrome, patrz pamięć), całość regresji przez `cx-regression`.
- Skille projektu (`.claude/skills/`): `cx-regression` (regresja i zrzuty), `cx-data-update` (dane ścieżek i xlsx → `data/`), `cx-flow-map` (mapa przepływu).
- Stan: v3 wdrożone, plus widoki macierzy (patrz `AGENTS.md` §2). `js/app.js` jest nadal monolitem (~330 linii), podział na `js/` robić stopniowo, osobno od funkcji.
