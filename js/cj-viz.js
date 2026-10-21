(() => {
  'use strict';

  // Sterownik widoków Orbita i Krajobraz: przełącznik widoku, horyzont emocji z płynnym przejściem, „Pokaż poprawę” i „Przejdź podróż”.
  // Same widoki (js/cj-orbit.js, js/cj-landscape.js) tylko rysują wartości, które im poda sterownik. Brak wartości w danych zostaje przerwą (null).
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ease = t => t * t * (3 - 2 * t);
  const BOXES = { orbit: 'orbitView', landscape: 'landView' };
  const instances = {};
  let host, vals = [], horizon = 'now', view = 'chart', cursor = -1, token = 0, raf = 0, improving = false, touring = false, ready = false;

  // Podczas przejścia wartości są ułamkowe; pokazujemy je z dokładnością do 0,1 (dane źródłowe mają co najwyżej połówki).
  const shown = v => v === null ? null : Math.round(v * 10) / 10;
  const ctrl = { shown, vals: () => vals, base: () => host.model.series.now, horizon: () => horizon, cursor: () => cursor, reduced };
  const current = () => instances[view];
  const redraw = () => { const v = current(); if (v) { v.draw(); v.update(); } caption(); };
  // Klatka przejścia: zmieniają się tylko wartości, zaznaczenie i filtry zostają, więc pomijamy update().
  const frame = () => { const v = current(); if (v) v.draw(); caption(); };

  function caption() {
    const { $, cj, esc, title, level, emClass } = host, st = host.state(), pts = host.model.points;
    const i = cursor >= 0 ? cursor : st.sel && st.sel.kind === 'tp' ? pts.findIndex(t => t.id === st.sel.id) : -1;
    const hz = host.core.HORIZONS.find(h => h.key === horizon);
    const name = (list, id) => (list.find(x => x.id === id) || {}).name || id;
    let html = `<span class="cap-hz">${esc(hz.label)}${horizon !== 'now' && cj.forecastStatus ? ' · ' + esc(cj.forecastStatus) : ''}</span>`;
    if (i >= 0) {
      const t = pts[i], v = shown(vals[i]);
      html += `<b>${esc(title(t))}</b><span>Krok ${esc(t.step)}: ${esc(cj.steps.find(s => s.nr === t.step).name)}</span><span class="em ${emClass(v)}">${esc(level(v))}</span>`
        + (t.painPoint ? `<span>Pain point: ${esc(name(cj.painPoints, t.painPoint))}</span>` : '') + (t.rootCause ? `<span>Root cause: ${esc(name(cj.rootCauses, t.rootCause))}</span>` : '');
    } else html += '<span class="cap-hint">Kliknij punkt albo uruchom „Przejdź podróż”.</span>';
    $('vizCaption').innerHTML = html;
  }

  // Płynne przejście do krzywej horyzontu. Gdy punkt nie ma wartości na końcu przejścia, zostaje przerwa; nic nie jest dopełniane.
  function goTo(key, ms) {
    cancelAnimationFrame(raf);
    horizon = key;
    host.$('vizHz').value = key;
    const to = host.model.series[key], from = vals.slice();
    if (!ms || reduced()) { vals = to.slice(); redraw(); return Promise.resolve(); }
    return new Promise(resolve => {
      const t0 = performance.now(), step = now => {
        const p = Math.min(1, (now - t0) / ms), e = ease(p);
        vals = from.map((a, i) => a === null || to[i] === null ? to[i] : a + (to[i] - a) * e);
        frame();
        if (p < 1) raf = requestAnimationFrame(step); else { vals = to.slice(); redraw(); resolve(); }
      };
      raf = requestAnimationFrame(step);
    });
  }

  function stop() {
    token++; cancelAnimationFrame(raf); improving = false; touring = false; cursor = -1;
    host.$('vizImprove').textContent = '▶ Pokaż poprawę'; host.$('vizTour').textContent = '▶ Przejdź podróż';
    ['vizImprove', 'vizTour'].forEach(id => host.$(id).setAttribute('aria-pressed', 'false'));
    const v = current(); if (v) v.setCursor(-1);
  }

  async function improve() {
    if (improving) { stop(); redraw(); return; }
    stop(); improving = true;
    const mine = token;
    host.$('vizImprove').textContent = '■ Zatrzymaj'; host.$('vizImprove').setAttribute('aria-pressed', 'true');
    const keys = host.core.HORIZONS.map(h => h.key).filter(k => k === 'now' || host.model.hasForecast(k));
    await goTo('now', 500); if (mine !== token) return;
    for (const key of keys.slice(1)) {
      await wait(reduced() ? 1200 : 700); if (mine !== token) return;
      await goTo(key, 1500); if (mine !== token) return;
    }
    await wait(reduced() ? 1200 : 900);
    if (mine === token) { stop(); redraw(); }
  }

  async function tour() {
    if (touring) { stop(); redraw(); return; }
    stop(); touring = true;
    const mine = token;
    host.$('vizTour').textContent = '■ Zatrzymaj'; host.$('vizTour').setAttribute('aria-pressed', 'true');
    for (let i = 0; i < host.model.points.length; i++) {
      cursor = i; current().setCursor(i); caption();
      await wait(reduced() ? 1300 : 1050); if (mine !== token) return;
    }
    stop(); redraw();
  }

  function setView(next) {
    if (next === view) return;
    stop(); view = next;
    const { $ } = host;
    $('viz').hidden = next === 'chart'; $('chartPanel').hidden = next !== 'chart';
    document.body.classList.toggle('view-viz', next !== 'chart');
    document.body.classList.toggle('view-landscape', next === 'landscape');
    for (const key of Object.keys(BOXES)) $(BOXES[key]).hidden = key !== next;
    if (next === 'chart') window.dispatchEvent(new Event('cj-zoom-label'));
    if (next !== 'chart') {
      if (!instances[next]) instances[next] = window.CX.cjViews[next](host, ctrl, $(BOXES[next]));
      $('vizLegend').textContent = instances[next].legend;
      if (instances[next].activate) instances[next].activate();
      redraw();
    }
  }

  function init(h) {
    host = h;
    const { $, esc, core, model, cj } = host;
    vals = model.series.now.slice();
    const keys = core.HORIZONS.filter(x => x.key === 'now' || model.hasForecast(x.key));
    $('vizHz').innerHTML = keys.map(x => `<option value="${x.key}">${esc(x.label)}</option>`).join('');
    $('vizImprove').hidden = keys.length < 2;
    $('vizHz').addEventListener('change', e => { stop(); goTo(e.target.value, 900); });
    $('vizImprove').addEventListener('click', improve);
    $('vizTour').addEventListener('click', tour);
    $('viewSelect').addEventListener('change', e => setView(e.target.value));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && (improving || touring)) { stop(); redraw(); } });
    ready = true;
  }

  window.CX = window.CX || {};
  window.CX.cjViz = { init, playing: () => improving || touring, update: () => { if (ready && view !== 'chart') { current().update(); caption(); } } };
})();
