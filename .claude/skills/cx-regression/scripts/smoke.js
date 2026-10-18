// Smoke test wszystkich stron przez file:// w Chromium (Playwright). Narzędzie agenta, nie zależność produktu.
// Użycie: node .claude/skills/cx-regression/scripts/smoke.js [--out KATALOG] [--pages index,mapa] [--profiles desktop,mobile,reduced]
// Kod wyjścia 0 = brak FAIL (SKIP = brak danych do scenariusza), 1 = co najmniej jeden FAIL, 2 = brak Playwrighta/przeglądarki.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'cx-smoke')));
const WAIT = 3000;

// item: klikalny punkt styku; main: obszar, którego szuflada na desktopie nie może zasłaniać.
const PAGES = {
  index: { file: 'index.html', item: '#graphNodes [data-step]', main: '.map-panel' },
  matrix: { file: 'matrix.html', item: '.tile', main: '#gridPanel' },
  priorytety: { file: 'priorytety.html', item: '.act-open', main: '#board' },
  radar: { file: 'radar.html', item: '#radar .node', main: '#stage' },
  mapa: { file: 'mapa.html', item: '.flow-node', mobileItem: '.flow-item', main: '#flowViewport' }
};
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
  mobile: { viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', isMobile: true, hasTouch: true },
  reduced: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }
};
const pages = arg('pages', Object.keys(PAGES).join(',')).split(',');
const profiles = arg('profiles', Object.keys(PROFILES).join(',')).split(',');

// Playwright: CX_PLAYWRIGHT (ścieżka do modułu), zwykły require, potem kopie z cache npx, jeśli są (najnowsze pierwsze).
function candidates() {
  const list = [process.env.CX_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean);
  const npx = path.join(os.homedir(), '.npm/_npx');
  if (fs.existsSync(npx)) {
    fs.readdirSync(npx).map(d => path.join(npx, d, 'node_modules/playwright'))
      .filter(p => fs.existsSync(p)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      .forEach(p => list.push(p));
  }
  return list;
}
async function launch() {
  for (const id of candidates()) {
    try {
      const { chromium } = require(id);
      const browser = await chromium.launch();
      console.log('Playwright: ' + id + ' (Chromium ' + browser.version() + ')');
      return browser;
    } catch (error) { /* następny kandydat */ }
  }
  return null;
}

const results = [];
const report = (status, scope, name, info) => {
  results.push({ status });
  console.log(status + ' ' + scope + ' · ' + name + (info ? ' — ' + String(info).replace(/\s+/g, ' ') : ''));
};
const check = (scope, name, ok, info = '') => report(ok ? 'PASS' : 'FAIL', scope, name, info);
const skip = (scope, name, info) => report('SKIP', scope, name, info);

// Czekanie na obserwowalny stan zamiast stałych pauz.
const textOf = async locator => (await locator.innerText()).trim();
async function changedText(locator, before) {
  const deadline = Date.now() + WAIT;
  let now = await textOf(locator);
  while (now === before && Date.now() < deadline) { await new Promise(r => setTimeout(r, 50)); now = await textOf(locator); }
  return now;
}
// Skończone animacje CSS (np. wysuwanie szuflady); nieskończone pulsy pomijamy, a wstrzymane nie zawieszą testu (limit WAIT).
const settle = page => page.evaluate(wait => Promise.race([
  Promise.all(document.getAnimations()
    .filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {}))),
  new Promise(resolve => setTimeout(resolve, wait))
]), WAIT);

async function runPage(browser, key, profileKey) {
  const cfg = PAGES[key], profile = PROFILES[profileKey], scope = key + '/' + profileKey;
  const itemSel = profile.isMobile && cfg.mobileItem ? cfg.mobileItem : cfg.item;
  const context = await browser.newContext(profile);
  const blocked = [], errors = [];
  await context.route(/^https?:/, route => { blocked.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.on('websocket', ws => blocked.push(ws.url())); // route() nie obejmuje WebSocketów
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', req => { if (req.url().startsWith('file:')) errors.push('brak pliku: ' + req.url()); });
  const finish = async () => {
    check(scope, 'zero żądań sieciowych', blocked.length === 0, blocked.slice(0, 3).join(', '));
    check(scope, 'zero błędów w konsoli', errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  };

  await page.goto('file://' + path.join(ROOT, cfg.file));
  await page.waitForFunction(sel => !document.getElementById('errorScreen').hidden || document.querySelector(sel), itemSel, { timeout: WAIT }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${key}-${profileKey}.png`) });
  const started = await page.locator('#errorScreen').isHidden();
  check(scope, 'brak ekranu błędu', started, await page.locator('#errorText').textContent().catch(() => ''));
  if (!started) return finish();

  if (profile.isMobile) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(scope, 'brak poziomego przewijania strony', overflow <= 1, overflow > 1 ? overflow + ' px' : '');
  }
  if (key === 'mapa' && profileKey === 'reduced') {
    check(scope, 'brak animateMotion przy reduced-motion', await page.locator('#flowSvg animateMotion').count() === 0);
  }

  const drawer = page.locator('#detailDrawer');
  const items = page.locator(itemSel);
  const count = await items.count();
  check(scope, 'są punkty styku', count > 0, count + ' szt.');
  const picks = count ? [...new Set([0, Math.floor((count - 1) / 2), count - 1])] : [];
  // Pierwszy punkt myszą, kolejne klawiaturą (fokus + Enter): duża mapa przepływu nie mieści się w oknie i sama przesuwa się do fokusu.
  for (const i of picks) {
    const how = i === picks[0] ? 'mysz' : 'klawiatura';
    if (how === 'mysz') await items.nth(i).click();
    else { await items.nth(i).focus(); await page.keyboard.press('Enter'); }
    await drawer.waitFor({ state: 'visible', timeout: WAIT }).catch(() => {});
    const open = await drawer.isVisible() && (await textOf(page.locator('#detailBody'))).length > 0;
    check(scope, `szuflada po wyborze punktu #${i + 1} (${how})`, open);
    if (key === 'index' && open) {
      const title = await textOf(page.locator('#detailTitle'));
      check(scope, `tytuł szczegółów zgodny z punktem #${i + 1}`, (await items.nth(i).innerText()).includes(title), title);
    }
    if (!profile.isMobile && open && i === picks[Math.floor(picks.length / 2)]) {
      await settle(page);
      const [a, b] = [await page.locator(cfg.main).boundingBox(), await drawer.boundingBox()];
      check(scope, 'szuflada nie zasłania głównego obszaru', !!a && !!b && a.width > 0 && a.x + a.width <= b.x + 1);
      await page.screenshot({ path: path.join(OUT, `${key}-${profileKey}-drawer.png`) });
    }
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden', timeout: WAIT }).catch(() => {});
    check(scope, `Escape zamyka szufladę (#${i + 1})`, await drawer.isHidden());
  }

  if (key === 'index') await indexExtras(page, scope);
  if (key === 'mapa') await caseExtras(page, scope, profileKey);
  return finish();
}

async function indexExtras(page, scope) {
  const options = sel => page.locator(sel + ' option').evaluateAll(list => list.map(o => o.value));
  const nodes = page.locator('#graphNodes [data-step]');
  let branched = false;
  for (const persona of await options('#persona')) {
    await page.selectOption('#persona', persona);
    for (const journey of await options('#journey')) {
      await page.selectOption('#journey', journey);
      const ok = await nodes.count() > 0 && await page.locator('#errorScreen').isHidden();
      check(scope, `ścieżka ${persona}/${journey} ma punkty`, ok);
      // Rozwidlenie: pierwszy punkt z wariantem w szczegółach; wybór wariantu zmienia wybrany punkt.
      for (let i = 0; ok && !branched && i < await nodes.count(); i++) {
        await nodes.nth(i).click();
        const branch = page.locator('#detailBody [data-branch]').first();
        if (!await branch.count()) continue;
        const title = page.locator('#detailTitle'), before = await textOf(title);
        await branch.click();
        check(scope, 'wybór wariantu rozwidlenia zmienia punkt', (await changedText(title, before)) !== before, before);
        branched = true;
      }
      await page.keyboard.press('Escape');
    }
  }
  if (!branched) skip(scope, 'wybór wariantu rozwidlenia', 'dane nie mają punktu z branches');
  const toggle = page.locator('#toggleEmotions');
  await toggle.click();
  check(scope, 'zwinięcie panelu emocji', await page.locator('#emotionContent').isHidden() && await page.locator('.map-panel').isVisible());
  await toggle.click();
  check(scope, 'rozwinięcie panelu emocji', await page.locator('#emotionContent').isVisible());
}

async function caseExtras(page, scope, profileKey) {
  const values = await page.locator('#caseSelect option').evaluateAll(list => list.map(o => o.value).filter(Boolean));
  if (!values.length) { skip(scope, 'tryb przypadku', 'dane nie mają przypadków'); return; }
  await page.selectOption('#caseSelect', values[0]);
  check(scope, 'tryb przypadku: podsumowanie widoczne', await page.locator('#caseInfo').isVisible());
  const text = page.locator('#stepText');
  const start = await textOf(text);
  await page.click('#stepNext');
  const first = await changedText(text, start);
  check(scope, 'tryb przypadku: Start pokazuje krok', first !== start, first);
  if (await page.locator('#stepNext').isEnabled()) {
    await page.click('#stepNext');
    const second = await changedText(text, first);
    check(scope, 'tryb przypadku: Dalej zmienia krok', second !== first, second);
    await page.screenshot({ path: path.join(OUT, `mapa-${profileKey}-case.png`) });
    await page.click('#stepPrev');
    check(scope, 'tryb przypadku: Wstecz wraca do poprzedniego kroku', (await changedText(text, second)) === first);
  } else skip(scope, 'tryb przypadku: Dalej/Wstecz', 'przypadek ma jeden krok');
  // Ukryty tor z krokiem przypadku: podsumowanie musi to zgłosić; tor przywracamy.
  const chips = page.locator('#lanes [data-lane]');
  if (await chips.count() < 2 || !await chips.first().isVisible()) { skip(scope, 'komunikat o kroku na ukrytym torze', 'za mało widocznych torów'); return; }
  let reported = false;
  for (let i = 0; i < await chips.count() && !reported; i++) {
    await chips.nth(i).click();
    reported = (await page.locator('#caseInfo').innerText()).includes('ukrytych torach');
    await chips.nth(i).click();
  }
  check(scope, 'tryb przypadku: komunikat o krokach na ukrytym torze', reported);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  if (!browser) {
    console.error('Brak działającego Playwrighta z Chromium. Ustaw CX_PLAYWRIGHT na katalog modułu playwright. Instalację przeglądarki uzgodnij z użytkownikiem.');
    process.exit(2);
  }
  for (const key of pages) {
    for (const profileKey of profiles) {
      if (!PAGES[key] || !PROFILES[profileKey]) { check(key + '/' + profileKey, 'znana strona i profil', false); continue; }
      try { await runPage(browser, key, profileKey); }
      catch (error) {
        const info = error.message.replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter((line, i) => !i || /waiting for locator/.test(line)).join(' ');
        check(key + '/' + profileKey, 'przebieg bez wyjątku', false, info);
      }
    }
  }
  await browser.close();
  const n = status => results.filter(r => r.status === status).length;
  console.log(`\n${n('PASS')} PASS, ${n('FAIL')} FAIL, ${n('SKIP')} SKIP. Zrzuty: ${OUT}`);
  process.exit(n('FAIL') ? 1 : 0);
})();
