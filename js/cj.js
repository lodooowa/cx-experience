(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const NS = 'http://www.w3.org/2000/svg';
  const GUTTER = 140, PW = 92, HEIGHT = 330, TOP = 14, BOTTOM = 14, MIN = -5, MAX = 5;
  // Dwa zestawy danych: produkcyjny (data/cj.js z macierz_CX.xlsx, poza repozytorium) i demo (data/cj-demo.js z macierz_CX_demo.xlsx). Domyślnie produkcyjny, o ile istnieje; ?dane=demo wymusza demo.
  const hasProd = !!window.CX_CJ, demo = new URLSearchParams(location.search).get('dane') === 'demo' || !hasProd;
  const cj = demo ? window.CX_CJ_DEMO : window.CX_CJ, core = window.CX.cjCore;
  let model, sel = null, rel = null, shown = new Set(['now']), painFilter = new Set();
  let zoom = 1, hlStage = null;
  let seriesDots = [], colX = [], colW = [], totalW = 0;
  let dots = [], pointEls = [], stickyTps = [], ppCells = [], hoverEl = null, ppIndex = new Map(), treeNodes = [];

  const el = (name, attrs = {}, text) => {
    const node = document.createElementNS(NS, name);
    for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const showError = message => { $('app').hidden = true; $('errorScreen').hidden = false; $('errorText').textContent = message; };
  const title = t => t.title || '(bez nazwy) ' + t.id;
  const emClass = v => v === null || v === undefined ? 'em-none' : v < 0 ? 'em-neg' : v === 0 ? 'em-zero' : v < 4 ? 'em-pos' : 'em-high';
  const level = v => v === null || v === undefined ? 'brak danych' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  const ppClass = id => ppIndex.has(id) ? 'pp-' + (ppIndex.get(id) % 6) : 'pp-none';
  const y = v => TOP + (MAX - v) / (MAX - MIN) * (HEIGHT - TOP - BOTTOM);

  function toolbar() {
    $('horizons').innerHTML = core.HORIZONS.map(h => {
      const ok = h.key === 'now' || model.hasForecast(h.key);
      return `<button type="button" class="chip hz hz-${h.key}" data-h="${h.key}" aria-pressed="${shown.has(h.key)}"${ok && h.key !== 'now' ? '' : h.key === 'now' ? ' disabled' : ' disabled title="Brak wartości prognozy w arkuszu"'}><i class="sw"></i>${esc(h.label)}${h.key !== 'now' && cj.forecastStatus ? ' (' + esc(cj.forecastStatus) + ')' : ''}</button>`;
    }).join('');
    $('pains').innerHTML = cj.painPoints.map(p => `<button type="button" class="chip pp ${ppClass(p.id)}" data-pp="${esc(p.id)}" aria-pressed="${painFilter.has(p.id)}" title="${esc(p.description)}"><i class="sw"></i>${esc(p.name)}</button>`).join('');
  }

  // Szerokość kolumny punktu: PW * powiększenie; od 80% etap dostaje dodatkowo tyle miejsca, żeby jego nazwa zmieściła się w jednej linii (po równo na jego punkty).
  function layout() {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '800 10px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const stageOf = t => cj.steps.find(s => s.nr === t.step).stage;
    // Najmniejsza szerokość komórki, przy której „nr. nazwa” (11 px) łamie się na max 2 linie.
    const stepNeed = nr => {
      ctx.font = '600 11px "Helvetica Neue", Helvetica, Arial, sans-serif';
      const words = (nr + ' ' + cj.steps.find(s => s.nr === nr).name).split(/\s+/), sp = ctx.measureText(' ').width, ww = words.map(w => ctx.measureText(w).width);
      const lines = avail => { let n = 1, cur = 0; ww.forEach(w => { if (cur && cur + sp + w > avail) { n++; cur = w; } else cur += (cur ? sp : 0) + w; }); return n; };
      let w = Math.ceil(Math.max(...ww)) + 4;
      while (lines(w) > 2) w++;
      return w + 16 + 8;
    };
    colX = []; colW = []; totalW = 0;
    let i = 0;
    while (i < model.points.length) {
      const stage = stageOf(model.points[i]);
      let n = 0;
      while (i + n < model.points.length && stageOf(model.points[i + n]) === stage) n++;
      const need = zoom >= .8 ? Math.ceil(ctx.measureText(stage.toUpperCase()).width + stage.length * .4 + 24) : 0;
      // Kroki: nazwa ma się zmieścić w max 2 liniach, więc krok dostaje tyle miejsca, ile trzeba (od 80% powiększenia).
      const runs = [];
      for (let k = 0; k < n; k++) {
        const st = model.points[i + k].step, last = runs[runs.length - 1];
        if (last && last.step === st) last.n++; else runs.push({ step: st, n: 1 });
      }
      runs.forEach(r => { r.w = Math.round(r.n * PW * zoom); if (zoom >= .8) r.w = Math.max(r.w, stepNeed(r.step)); });
      const sum = runs.reduce((a, r) => a + r.w, 0), extra = Math.max(0, need - sum);
      runs.forEach(r => {
        const total = r.w + Math.round(extra * r.n / n), each = Math.floor(total / r.n);
        for (let k = 0; k < r.n; k++) { const w = k === r.n - 1 ? total - each * (r.n - 1) : each; colX.push(totalW); colW.push(w); totalW += w; }
      });
      i += n;
    }
  }
  const colAt = px => { let i = colX.findIndex((x, k) => px >= x && px < x + colW[k]); return i; };

  function chart() {
    const pts = model.points, width = totalW, svg = $('chart');
    svg.replaceChildren(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`); svg.setAttribute('width', width); svg.setAttribute('height', HEIGHT);
    svg.firstChild.textContent = 'Poziom emocji klienta (−5 do +5) w punktach styku podróży.';
    const x = i => colX[i] + colW[i] / 2;
    // Pasy etapów i separatory kroków.
    for (const stage of cj.stages) {
      const idx = pts.map((t, i) => i).filter(i => cj.steps.find(s => s.nr === pts[i].step).stage === stage.name);
      if (!idx.length) continue;
      svg.append(el('rect', { x: colX[idx[0]], y: 0, width: colX[idx[idx.length - 1]] + colW[idx[idx.length - 1]] - colX[idx[0]], height: HEIGHT, class: 'cj-band', 'data-stage': stage.name, style: 'fill:' + stage.color }));
    }
    pts.forEach((t, i) => { if (i && t.step !== pts[i - 1].step) svg.append(el('line', { x1: colX[i], x2: colX[i], y1: 0, y2: HEIGHT, class: 'cj-sep' })); });
    for (let v = MIN; v <= MAX; v++) svg.append(el('line', { x1: 0, x2: width, y1: y(v), y2: y(v), class: v === 0 ? 'cj-zero' : 'cj-grid' }));
    hoverEl = el('rect', { y: 0, width: PW, height: HEIGHT, class: 'cj-hover', visibility: 'hidden' });
    svg.append(hoverEl);
    seriesDots = [];
    // Krzywe: przerwa przy braku wartości.
    for (const h of core.HORIZONS) {
      const group = el('g', { class: 'cj-series hz-' + h.key, 'data-h': h.key });
      let d = '', pen = false;
      model.series[h.key].forEach((v, i) => { if (v === null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i) + ' ' + y(v).toFixed(1) + ' '; pen = true; });
      group.append(el('path', { d, class: 'cj-line' }));
      model.series[h.key].forEach((v, i) => {
        if (v !== null) { const c = el('circle', { cx: x(i), cy: y(v), r: 4.5, class: 'cj-pt' }); group.append(c); seriesDots.push({ i, c }); }
        else if (h.key === 'now') { const c = el('circle', { cx: x(i), cy: HEIGHT - 12, r: 4, class: 'cj-nodata' }); c.append(el('title', {}, 'brak danych')); group.append(c); seriesDots.push({ i, c }); }
      });
      svg.append(group);
    }
    dots = pts.map((t, i) => {
      const g = el('g', { class: 'cj-mark ' + ppClass(t.painPoint), 'data-i': i });
      g.append(el('rect', { x: colX[i] + 4, y: 0, width: colW[i] - 8, height: HEIGHT, class: 'cj-hit' }));
      svg.append(g);
      return g;
    });
    const axis = $('axis');
    axis.replaceChildren();
    axis.setAttribute('viewBox', `0 0 ${GUTTER} ${HEIGHT}`); axis.setAttribute('width', GUTTER); axis.setAttribute('height', HEIGHT);
    axis.append(el('text', { transform: `translate(${(GUTTER - 30) / 2} ${HEIGHT / 2}) rotate(-90)`, class: 'cj-axis-title', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'Poziom emocji klienta (−5 do +5)'));
    for (let v = MIN; v <= MAX; v++) axis.append(el('text', { x: GUTTER - 8, y: y(v) + 4, class: 'cj-axis-label', 'text-anchor': 'end' }, v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0'));
  }

  // Wiersze pod wykresem mają stałe wysokości (zmienne CSS), a komórki po jednej na punkt, więc etap, krok, pain point i punkt styku są w równych liniach.
  function stepsList() {
    const pts = model.points, stepOf = t => cj.steps.find(s => s.nr === t.step);
    const runs = key => {
      const out = [];
      pts.forEach((t, i) => { const k = key(t), last = out[out.length - 1]; if (last && last.key === k) last.n++; else out.push({ key: k, n: 1, first: i, t }); });
      return out;
    };
    const stageStart = new Set(runs(t => stepOf(t).stage).map(r => r.first)), stepStart = new Set(runs(t => t.step).map(r => r.first));
    const edge = i => (stageStart.has(i) ? ' stage-start' : stepStart.has(i) ? ' step-start' : '');
    const rowW = r => colW.slice(r.first, r.first + r.n).reduce((a, b) => a + b, 0);
    const colorOf = name => (cj.stages.find(s => s.name === name) || {}).color || '#999';
    $('stageRow').innerHTML = runs(t => stepOf(t).stage).map(r => `<div class="cj-cell stage-start" data-stage="${esc(stepOf(r.t).stage)}" style="width:${rowW(r)}px;--stage:${esc(colorOf(stepOf(r.t).stage))}"><span title="${esc(stepOf(r.t).stage)}">${esc(stepOf(r.t).stage)}</span></div>`).join('');
    // Średnia emocji (poziom obecny) po etapie; punkty bez wartości pomijane, brak wartości = „brak”.
    const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',');
    $('avgRow').innerHTML = runs(t => stepOf(t).stage).map(r => {
      const vals = model.series.now.slice(r.first, r.first + r.n).filter(v => v !== null), avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, name = stepOf(r.t).stage;
      return `<div class="cj-cell stage-start" data-stage="${esc(name)}" style="width:${rowW(r)}px;--stage:${esc(colorOf(name))}"><button type="button" class="em cj-avg ${emClass(avg)}" data-stage="${esc(name)}" aria-pressed="false" title="Średnia emocji klienta w etapie „${esc(name)}” (${vals.length} z ${r.n} punktów ma wartość). Kliknij, by podświetlić etap.">${avg === null ? 'brak' : fmt(avg)}</button></div>`;
    }).join('');
    $('stepRow').innerHTML = runs(t => t.step).map(r => `<div class="cj-cell${edge(r.first)}" data-stage="${esc(stepOf(r.t).stage)}" style="width:${rowW(r)}px;--stage:${esc(colorOf(stepOf(r.t).stage))}"><span title="${esc(r.t.step + '. ' + stepOf(r.t).name)}"><b>${esc(r.t.step)}</b> <em class="sn">${esc(stepOf(r.t).name)}</em></span></div>`).join('');
    $('ppRow').innerHTML = pts.map((t, i) => `<div class="cj-cell pp-cell ${ppClass(t.painPoint)}${edge(i)}" data-i="${i}" data-stage="${esc(stepOf(t).stage)}" style="width:${colW[i]}px;--stage:${esc(colorOf(stepOf(t).stage))}">${t.painPoint ? `<i class="dot" aria-hidden="true"></i><b class="badge" title="${esc((cj.painPoints.find(p => p.id === t.painPoint) || {}).name || t.painPoint)}">${esc(t.painPoint)}</b><span class="ppname">${esc((cj.painPoints.find(p => p.id === t.painPoint) || {}).name || '')}</span>` : '<i class="none" title="Brak pain pointu w danych">–</i>'}</div>`).join('');
    $('steps').innerHTML = pts.map((t, i) => `<button type="button" class="cj-tp ${ppClass(t.painPoint)}${t.title ? '' : ' unnamed'}${edge(i)}" data-i="${i}" data-stage="${esc(stepOf(t).stage)}" style="width:${colW[i]}px;--stage:${esc(colorOf(stepOf(t).stage))}" aria-pressed="false" title="${esc(title(t))}" aria-label="${esc(title(t) + ', emocja ' + level(t.emotionValue) + (t.painPoint ? ', pain point ' + t.painPoint : ''))}"><span>${esc(title(t))}</span></button>`).join('');
    pointEls = [...$('steps').querySelectorAll('.cj-tp')];
    ppCells = [...$('ppRow').querySelectorAll('.pp-cell')];
    $('stickyTrack').innerHTML = `<div class="cj-row cj-stage-row">${$('stageRow').innerHTML}</div><div class="cj-row cj-step-row">${$('stepRow').innerHTML}</div><div class="cj-row cj-tp-row">${$('steps').innerHTML}</div>`;
    stickyTps = [...$('stickyTrack').querySelectorAll('.cj-tp')];
    stickyTps.forEach(b => b.setAttribute('tabindex', '-1'));
    markStage();
  }

  // Ostrzeżenia danych i przycisk prognozy (reszta dawnego podsumowania zastąpiona pigułkami średnich nad etapami).
  function summary() {
    $('sumWarn').innerHTML = cj.warnings && cj.warnings.length ? `<button type="button" class="chip sum-warn" id="warnBtn" aria-expanded="false" aria-controls="warnings">Jakość danych: ${cj.warnings.length}</button>` : '';
    $('fcBtn').hidden = !core.HORIZONS.some(h => h.key !== 'now' && model.hasForecast(h.key));
  }

  // Podświetlenie etapu wybranego pigułką: wszystkie elementy z data-stage tego etapu zostają, reszta jest przygaszona.
  function markStage() {
    $('chartPanel').classList.toggle('hl-on', !!hlStage);
    document.querySelectorAll('#chartPanel [data-stage]').forEach(e => { const on = e.dataset.stage === hlStage; e.classList.toggle('hl', on); if (e.classList.contains('cj-avg')) e.setAttribute('aria-pressed', String(on)); });
  }

  function treeSvg() {
    const svg = $('tree'), ROW = 54, W = 1040, colX = [0, 360, 720], BW = 300, BH = 42;
    const rows = Math.max(cj.painPoints.length, cj.rootCauses.length, cj.initiatives.length);
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${rows * ROW + 30}`); svg.setAttribute('width', W); svg.setAttribute('height', rows * ROW + 30);
    ['Pain pointy', 'Przyczyny źródłowe (Root Causes)', 'Inicjatywy'].forEach((h, c) => svg.append(el('text', { x: colX[c], y: 14, class: 'cj-tree-head' }, h)));
    const pos = { pp: new Map(), rc: new Map(), in: new Map() };
    const lists = [['pp', cj.painPoints], ['rc', cj.rootCauses], ['in', cj.initiatives]];
    const links = el('g'); svg.append(links);
    treeNodes = [];
    lists.forEach(([kind, list], c) => list.forEach((item, r) => {
      const gy = 26 + r * ROW;
      pos[kind].set(item.id, { x: colX[c], y: gy });
      const g = el('g', { class: 'cj-node cj-node-' + kind + (kind === 'pp' ? ' ' + ppClass(item.id) : ''), tabindex: 0, role: 'button', 'data-kind': kind, 'data-id': item.id, 'aria-pressed': 'false' });
      g.append(el('rect', { x: colX[c], y: gy, width: BW, height: BH, class: 'box' }), el('text', { x: colX[c] + 10, y: gy + 17, class: 'id' }, item.id + (kind === 'in' ? ' · ' + item.type : '')),
        el('text', { x: colX[c] + 10, y: gy + 33, class: 'name' }, (item.name.length > 44 ? item.name.slice(0, 43) + '…' : item.name)));
      g.append(el('title', {}, item.name + (item.description ? ': ' + item.description : '')));
      svg.append(g); treeNodes.push(g);
    }));
    const edge = (a, b, k) => { const p = pos[a[0]].get(a[1]), q = pos[b[0]].get(b[1]); if (p && q) links.append(el('path', { d: `M${p.x + BW} ${p.y + BH / 2} C${p.x + BW + 30} ${p.y + BH / 2} ${q.x - 30} ${q.y + BH / 2} ${q.x} ${q.y + BH / 2}`, class: 'cj-edge', 'data-a': a[1], 'data-b': b[1] })); };
    cj.painRoot.forEach(([p, r]) => edge(['pp', p], ['rc', r]));
    cj.rootInitiative.forEach(([r, i]) => edge(['rc', r], ['in', i]));
  }

  function apply() {
    rel = core.related(cj, sel);
    const active = sel !== null;
    document.querySelector('.cj-panel').classList.toggle('has-sel', active);
    model.points.forEach((t, i) => {
      const on = rel.tp.has(t.id), filtered = painFilter.size && !painFilter.has(t.painPoint);
      const classes = (el) => { el.classList.toggle('on', on); el.classList.toggle('off', (active && !on) || !!filtered); };
      classes(dots[i]); classes(pointEls[i]); classes(ppCells[i]); if (stickyTps[i]) classes(stickyTps[i]);
      // Wykres: punkty spoza zaznaczenia lub filtra pain pointów są przygaszone na krzywych.
      seriesDots.filter(d => d.i === i).forEach(d => d.c.classList.toggle('off', (active && !on) || !!filtered));
      pointEls[i].setAttribute('aria-pressed', String(sel && sel.kind === 'tp' && sel.id === t.id));
      if (stickyTps[i]) stickyTps[i].setAttribute('aria-pressed', pointEls[i].getAttribute('aria-pressed'));
    });
    treeNodes.forEach(g => {
      const kind = g.dataset.kind, id = g.dataset.id, on = rel[kind].has(id);
      g.classList.toggle('on', on); g.classList.toggle('off', active && !on);
      g.setAttribute('aria-pressed', String(!!sel && sel.kind === kind && sel.id === id));
    });
    document.querySelectorAll('.cj-edge').forEach(e => {
      const a = e.dataset.a, b = e.dataset.b;
      const on = active && (rel.pp.has(a) || rel.rc.has(a)) && (rel.rc.has(b) || rel.in.has(b));
      e.classList.toggle('on', on); e.classList.toggle('off', active && !on);
    });
    document.querySelectorAll('.cj-series').forEach(g => g.classList.toggle('hidden', !shown.has(g.dataset.h)));
    $('horizons').querySelectorAll('.hz').forEach(b => b.setAttribute('aria-pressed', String(shown.has(b.dataset.h))));
    document.querySelectorAll('#pains .pp').forEach(b => b.setAttribute('aria-pressed', String(painFilter.has(b.dataset.pp))));
    const forecasts = core.HORIZONS.filter(h => h.key !== 'now' && model.hasForecast(h.key)), count = painFilter.size;
    if ($('fcBtn')) { const on = forecasts.every(h => shown.has(h.key)); $('fcBtn').setAttribute('aria-pressed', String(on)); $('fcBtn').textContent = on ? 'Ukryj prognozę' : 'Pokaż prognozę'; }
    $('filtersClear').hidden = !count;
    $('filtersCount').hidden = !count; $('filtersCount').textContent = count;
    detail();
    if (window.CX.cjViz) window.CX.cjViz.update();
  }

  // Ikony nagłówków pól w drawerze (inline SVG, kolory z CSS: .ico-*).
  const ICONS = {
    warn: '<path d="M0-9.5 10 8H-10Z" class="f"/><path d="M0-3.5v6" class="s"/><circle cx="0" cy="5.2" r="1.1" class="f2"/>',
    pain: '<circle r="10.5" class="r r1"/><circle r="7.5" class="r r2"/><circle r="4.5" class="r r3"/><circle r="2.6" class="f"/>',
    root: '<circle r="6.4" class="s"/><circle r="8.6" class="s g" stroke-dasharray="1.6 2.2"/><path d="M-2-1.6a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.5" class="s"/><circle cx="0" cy="3.6" r=".9" class="f"/>',
    init: '<path d="M-3.8 3.2C-6.2 1.6-7 -.4-7-2.4A7 7 0 0 1 7-2.4C7-.4 6.2 1.6 3.8 3.2Z" class="s"/><path d="M-2.8 6.3h5.6M-1.6 8.8h3.2" class="s"/><path d="M-1.6 3.2V-.6L0-1.8l1.6 1.2v3.8" class="s"/>'
  };

  const drawerBelow = window.matchMedia('(max-width: 850px)');

  function detail() {
    const box = $('detail');
    box.hidden = !sel;
    // Miejsce po prawej na drawer, żeby skrajne punkty dało się przewinąć na lewo od niego.
    $('inner').style.paddingRight = sel && !drawerBelow.matches ? box.offsetWidth + 16 + 'px' : '';
    document.body.classList.toggle('drawer-open', !!sel && !drawerBelow.matches);
    if (!sel) return;
    const named = (list, id) => (list.find(i => i.id === id) || {}).name || id;
    const close = '<button type="button" class="det-close" aria-label="Zamknij szczegóły" title="Zamknij (Esc)">×</button>';
    const row = (label, value) => value ? `<p><b>${esc(label)}:</b> ${esc(value)}</p>` : '';
    if (sel.kind === 'tp') {
      const t = cj.touchpoints.find(x => x.id === sel.id), f = t.forecast, stp = cj.steps.find(s => s.nr === t.step);
      // Stały układ: każda sekcja ma zawsze te same pola i wysokość (brak danych = „—”), żeby przy przełączaniu punktów szukać w tym samym miejscu.
      const na = '<span class="na">—</span>';
      const val = v => v ? esc(v) : na;
      const meta = (label, v, cls) => `<div class="m ${cls || ''}"><span class="det-label">${esc(label)}</span><span class="mv" title="${esc(v || '')}">${val(v)}</span></div>`;
      const chip = (v) => `<span class="em ${emClass(v)}">${esc(level(v))}</span>`;
      const step = (cls, label, text, v) => `<li class="tl ${cls}${text ? '' : ' empty'}"><span class="tl-head"><b>${esc(label)}</b>${v === undefined ? '' : chip(v)}</span><span class="tl-text" title="${esc(text || '')}">${val(text)}</span></li>`;
      const tl = [step('qw', 'Quick Win', t.quickWin, f ? f.qw : undefined), step('mid', 'Mid Term', t.midTerm, f ? f.mid : undefined), step('long', 'Long Term', t.longTerm, f ? f.long : undefined)].join('');
      const field = (label, value, icon, cls, link) => { const rid = Array.isArray(value), text = rid ? value.join(' ') : value, html = rid ? `<span class="rid">${esc(value[0])}</span> ${esc(value[1])}` : esc(value); return `<dt>${icon ? `<svg class="ico ico-${icon}" viewBox="-12 -12 24 24" aria-hidden="true">${ICONS[icon]}</svg>` : ''}${esc(label)}</dt><dd class="${cls}" title="${esc(text || '')}">${value && link ? `<button type="button" class="det-link" data-kind="${link[0]}" data-id="${esc(link[1])}">${html}</button>` : value ? html : na}</dd>`; };
      const withName = (id, list) => id ? [id, named(list, id)] : '';
      box.innerHTML = `<section class="det-head"><h3 title="${esc(title(t))}">${esc(title(t))} <small class="rid">${esc(t.id)}</small></h3><div class="det-meta">`
        + meta('Etap', stp.stage, 'row') + meta('Krok', t.step + '. ' + stp.name, 'row') + meta('Kanał', t.channel, 'row') + '<div class="owners">' + meta('Właściciel', t.owner, 'inline') + meta('Współwłaściciel', t.coOwner, 'inline') + '</div></div></section>'
        + `<section class="det-emotion"><span class="det-label">Emocja</span> ${chip(t.emotionValue)} <span class="ev">${val(t.emotion)}</span>`
        + `<span class="why" title="${esc(t.justification || '')}">${t.justification ? esc(t.justification) : ''}</span></section>`
        + '<dl class="det-fields">' + field('Problem', t.problem, 'warn', 'c-problem') + field('Pain point', withName(t.painPoint, cj.painPoints), 'pain', 'c-pp', ['pp', t.painPoint])
        + field('Root cause', withName(t.rootCause, cj.rootCauses), 'root', 'c-rc', ['rc', t.rootCause]) + field('Inicjatywa', withName(t.initiative, cj.initiatives), 'init', 'c-in') + '</dl>'
        + `<section class="det-plan"><h4 class="det-label">Plan działań${f && cj.forecastStatus ? ' · prognoza (' + esc(cj.forecastStatus) + ')' : ''}</h4><div class="recommend"><span class="det-label">Rekomendowany kierunek</span><span class="rec-text" title="${esc(t.recommendation || '')}">${val(t.recommendation)}</span></div><ol class="timeline">${tl}</ol></section>`
        + close;
    } else {
      const list = { pp: cj.painPoints, rc: cj.rootCauses, in: cj.initiatives }[sel.kind], item = list.find(i => i.id === sel.id);
      const icon = { pp: 'pain', rc: 'root', in: 'init' }[sel.kind], kindName = { pp: 'Pain point', rc: 'Root cause', in: 'Inicjatywa' }[sel.kind];
      const tps = model.points.filter(t => rel.tp.has(t.id));
      const li = t => `<li><button type="button" class="rel-tp" data-id="${esc(t.id)}" title="${esc(title(t))}"><span class="rel-step">${esc(t.step)}</span><span class="rel-name">${esc(title(t))}<small>${esc(cj.steps.find(s => s.nr === t.step).stage)} · <span class="rid">${esc(t.id)}</span></small></span><span class="em ${emClass(t.emotionValue)}">${esc(level(t.emotionValue))}</span></button></li>`;
      box.innerHTML = `<section class="det-head"><span class="det-kind"><svg class="ico ico-${icon}" viewBox="-12 -12 24 24" aria-hidden="true">${ICONS[icon]}</svg><span class="det-label">${kindName}${item.type ? ' · ' + esc(item.type) : ''}</span></span>`
        + `<h3 title="${esc(item.name)}">${esc(item.name)} <small class="rid">${esc(item.id)}</small></h3>${item.description ? `<p class="det-desc">${esc(item.description)}</p>` : ''}</section>`
        + `<section class="det-plan det-related"><h4 class="det-label">Powiązane punkty styku (${tps.length})</h4>${tps.length ? `<ul class="rel-list">${tps.map(li).join('')}</ul>` : '<p class="na">Brak powiązanych punktów styku.</p>'}</section>${close}`;
    }
  }

  function select(next) {
    sel = sel && next && sel.kind === next.kind && sel.id === next.id ? null : next;
    apply();
    // Wybór pain pointu, przyczyny lub inicjatywy (np. linkiem z drawera) rozwija drzewo i pokazuje jego gałąź.
    if (sel && sel.kind !== 'tp') {
      const tree = $('treePanel');
      tree.open = true;
      tree.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    if (sel && sel.kind === 'tp') {
      const i = model.points.findIndex(t => t.id === sel.id), scroll = $('scroll'), x = colX[i];
      const sr = scroll.getBoundingClientRect(), visible = drawerBelow.matches ? scroll.clientWidth : Math.max(120, Math.min(scroll.clientWidth, $('detail').getBoundingClientRect().left - sr.left));
      // Przesuwamy minimalnie: punkt ma się zmieścić w widocznej części (z zapasem 74 px), bez centrowania.
      if (x < scroll.scrollLeft) glideTo(scroll, Math.max(0, x - 74));
      else if (x + colW[i] > scroll.scrollLeft + visible) glideTo(scroll, x + colW[i] - visible + 74);
    }
  }

  // Płynne przesunięcie wykresu do punktu (1 s); wheel/dotyk/przeciąganie je przerywa.
  let glideId = 0;
  function glideTo(el, to) {
    cancelAnimationFrame(glideId);
    const from = el.scrollLeft, max = el.scrollWidth - el.clientWidth;
    to = Math.min(to, max);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(to - from) < 2) { el.scrollLeft = to; return; }
    const t0 = performance.now(), stop = () => cancelAnimationFrame(glideId);
    ['wheel', 'pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, stop, { once: true, passive: true }));
    const step = now => {
      const k = Math.min(1, (now - t0) / 1000);
      el.scrollLeft = from + (to - from) * (1 - Math.pow(1 - k, 3));
      if (k < 1) glideId = requestAnimationFrame(step);
    };
    glideId = requestAnimationFrame(step);
  }

  function init() {
    if (!core) throw Error('Brak js/cj-core.js.');
    core.validate(cj);
    model = core.model(cj);
    shown = new Set(['now']);
    cj.painPoints.forEach((p, i) => ppIndex.set(p.id, i));
    $('demoPill').hidden = !demo && !/DEMO/.test(cj.forecastStatus || '');
    $('demoPill').textContent = demo ? 'DANE DEMO' : 'PROGNOZA DEMO';
    const dataSel = $('dataSelect');
    dataSel.value = demo ? 'demo' : 'prod';
    if (!hasProd) { dataSel.options[0].disabled = true; dataSel.title = 'Brak macierz_CX.xlsx i data/cj.js: uruchom 2-przebuduj-dane po dodaniu pliku produkcyjnego'; }
    dataSel.addEventListener('change', () => { location.search = '?dane=' + dataSel.value; });
    if (cj.warnings && cj.warnings.length) {
      $('warnings').innerHTML = `<b>Uwagi do danych</b><ul>${cj.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
      $('sumWarn').addEventListener('click', e => { if (!e.target.closest('#warnBtn')) return; const open = $('warnings').hidden; $('warnings').hidden = !open; $('warnBtn').setAttribute('aria-expanded', String(open)); });
    }
    layout(); toolbar(); chart(); stepsList(); treeSvg(); summary();
    $('helpText').textContent = 'Powiększanie: przyciski nad wykresem albo Ctrl/⌘ + kółko myszy; „Cały przebieg” pokazuje całą podróż naraz. Skala emocji klienta od −5 do +5. Brak wartości w danych oznacza przerwę w krzywej. Krzywe po Quick Wins, Mid i Long Term pochodzą z kolumn prognozy w zakładce Macierz CX'
      + (cj.forecastStatus ? ' (status: ' + cj.forecastStatus + ', wartości przykładowe do czasu uzupełnienia przez eksperta).' : '.');
    $('horizons').addEventListener('click', e => { const b = e.target.closest('.hz'); if (!b || b.disabled) return; shown.has(b.dataset.h) ? shown.delete(b.dataset.h) : shown.add(b.dataset.h); apply(); });
    const pickPain = e => { const b = e.target.closest('.pp'); if (!b) return; painFilter.has(b.dataset.pp) ? painFilter.delete(b.dataset.pp) : painFilter.add(b.dataset.pp); apply(); };
    $('pains').addEventListener('click', pickPain);
    $('fcBtn').addEventListener('click', () => {
      const fc = core.HORIZONS.filter(h => h.key !== 'now' && model.hasForecast(h.key)), on = fc.every(h => shown.has(h.key));
      fc.forEach(h => on ? shown.delete(h.key) : shown.add(h.key)); apply();
    });
    $('avgRow').addEventListener('click', e => { const b = e.target.closest('.cj-avg'); if (!b) return; hlStage = hlStage === b.dataset.stage ? null : b.dataset.stage; markStage(); });
    $('stageRow').addEventListener('click', e => { const c = e.target.closest('[data-stage]'); if (!c) return; hlStage = hlStage === c.dataset.stage ? null : c.dataset.stage; markStage(); });
    const treePanel = $('treePanel');
    try { treePanel.open = sessionStorage.getItem('cj-tree-open') === '1'; } catch (e) { /* brak storage: domyślnie zwinięte */ }
    treePanel.addEventListener('toggle', () => { try { sessionStorage.setItem('cj-tree-open', treePanel.open ? '1' : '0'); } catch (e) { /* ignoruj */ } });
    $('detail').addEventListener('click', e => { if (e.target.closest('.det-close')) select(sel); const l = e.target.closest('.det-link'); if (l) select({ kind: l.dataset.kind, id: l.dataset.id }); const r = e.target.closest('.rel-tp'); if (r) select({ kind: 'tp', id: r.dataset.id }); });
    $('inner').addEventListener('click', e => { const b = e.target.closest('.cj-tp, .pp-cell'); if (b) select({ kind: 'tp', id: model.points[Number(b.dataset.i)].id }); });
    $('chart').addEventListener('click', e => { const g = e.target.closest('.cj-mark'); if (g) select({ kind: 'tp', id: model.points[Number(g.dataset.i)].id }); });
    const node = e => { const g = e.target.closest('.cj-node'); if (g) select({ kind: g.dataset.kind, id: g.dataset.id }); };
    $('tree').addEventListener('click', node);
    $('tree').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); node(e); } });
    // Powiększanie: ponowne rozmieszczenie kolumn (wysokość i czcionki bez zmian). Przy małej szerokości kolumn nazwy się chowają, zostaje krzywa, kolory etapów i pain pointów.
    const scroll2 = $('scroll');
    const MAXZ = 1.8, fitZoom = () => Math.max(.1, Math.min(1, (scroll2.clientWidth - 2) / (model.points.length * PW)));
    // Przyklejony nagłówek: po przewinięciu strony pod filtrami zostaje nazwa etapu, a niżej także nazwa kroku (kopie wierszy przesuwane razem z poziomym przewijaniem).
    const STICKY_TP = 64, sticky = $('stickyHead'), toolbarEl = document.querySelector('.matrix-toolbar');
    const syncSticky = () => {
      const top = toolbarEl && getComputedStyle(toolbarEl).position === 'sticky' ? toolbarEl.offsetHeight : 0;
      sticky.style.setProperty('--sticky-top', top + 'px');
      const stageH = $('stageRow').offsetHeight, step = $('stepRow').getBoundingClientRect().top < top + stageH, tp = $('steps').getBoundingClientRect().top < top + stageH + $('stepRow').offsetHeight;
      const room = document.querySelector('.cj-chart-row').getBoundingClientRect().bottom - top > stageH + (step ? $('stepRow').offsetHeight : 0) + (tp ? STICKY_TP : 0) + 40;
      sticky.classList.toggle('s-stage', room && $('stageRow').getBoundingClientRect().top < top);
      sticky.classList.toggle('s-step', step);
      sticky.classList.toggle('s-tp', tp);
      $('stickyTrack').style.transform = `translateX(${-$('scroll').scrollLeft}px)`;
    };
    window.addEventListener('scroll', syncSticky, { passive: true }); window.addEventListener('resize', syncSticky); $('scroll').addEventListener('scroll', syncSticky, { passive: true });
    $('stickyTrack').addEventListener('click', e => { const b = e.target.closest('.cj-tp'); if (b) { select({ kind: 'tp', id: model.points[Number(b.dataset.i)].id }); return; } const c = e.target.closest('[data-stage]'); if (!c) return; hlStage = hlStage === c.dataset.stage ? null : c.dataset.stage; markStage(); });
    const render = () => {
      hideTip(); layout(); chart(); stepsList();
      document.querySelector('.cj-chart-row').parentNode.classList.toggle('compact', PW * zoom < 60);
      $('zoomLevel').textContent = Math.round(zoom * 100) + '%';
      apply(); syncSticky();
    };
    const setZoom = (next, anchor) => {
      next = Math.min(MAXZ, Math.max(fitZoom(), next));
      if (Math.abs(next - zoom) < .001) return;
      const ax = anchor === undefined ? scroll2.clientWidth / 2 : anchor, frac = (scroll2.scrollLeft + ax) / totalW;
      zoom = next; render();
      scroll2.scrollLeft = frac * totalW - ax;
    };
    // Druk / PDF: na czas drukowania wykres jest dopasowany do szerokości strony A4 (poziomej), potem wraca poprzednie powiększenie.
    let printZoom = null;
    window.addEventListener('beforeprint', () => { if ($('chartPanel').hidden) return; printZoom = zoom; zoom = Math.min(zoom, 880 / (model.points.length * PW)); render(); });
    window.addEventListener('afterprint', () => { if (printZoom === null) return; zoom = printZoom; printZoom = null; render(); });
    $('zoomIn').addEventListener('click', () => !document.body.classList.contains('view-viz') && setZoom(zoom * 1.25));
    $('zoomOut').addEventListener('click', () => !document.body.classList.contains('view-viz') && setZoom(zoom / 1.25));
    $('zoomFit').addEventListener('click', () => !document.body.classList.contains('view-viz') && setZoom(fitZoom()));
    $('zoomReset').addEventListener('click', () => !document.body.classList.contains('view-viz') && setZoom(1));
    window.addEventListener('cj-zoom-label', () => { $('zoomLevel').textContent = Math.round(zoom * 100) + '%'; });
    scroll2.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - scroll2.getBoundingClientRect().left); }, { passive: false });
    scroll2.addEventListener('keydown', e => { if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25); else if (e.key === '-') setZoom(zoom / 1.25); else if (e.key === '0') setZoom(1); else return; e.preventDefault(); });
    window.addEventListener('resize', () => { if (zoom < fitZoom()) setZoom(fitZoom()); });
    // Filtry w małym panelu rozwijanym w dół; Escape najpierw zamyka panel, potem czyści zaznaczenie i podświetlenie etapu.
    const panel = $('filtersPanel'), btn = $('filtersBtn');
    const toggleFilters = open => { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', () => toggleFilters(panel.hidden));
    $('filtersClose').addEventListener('click', () => { toggleFilters(false); btn.focus(); });
    $('filtersClear').addEventListener('click', () => { painFilter.clear(); apply(); });
    // Menu „Więcej widoków”: lista pod przyciskiem; Escape albo kliknięcie poza nią zamyka ją.
    const moreBtn = $('navMore'), moreList = $('navMoreList');
    const toggleMore = open => {
      moreList.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open));
      if (open) { const r = moreBtn.getBoundingClientRect(), s = moreBtn.closest('.app-shell').getBoundingClientRect(); moreList.style.left = Math.max(0, r.left - s.left) + 'px'; moreList.style.top = r.bottom - s.top + 8 + 'px'; }
    };
    moreBtn.addEventListener('click', () => toggleMore(moreList.hidden));
    document.addEventListener('click', e => { if (!moreList.hidden && !moreList.contains(e.target) && e.target !== moreBtn) toggleMore(false); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || window.CX.cjViz.playing()) return;
      if (!moreList.hidden) { toggleMore(false); moreBtn.focus(); return; }
      if (!panel.hidden) { toggleFilters(false); btn.focus(); return; }
      if (sel) select(sel);
      if (hlStage) { hlStage = null; markStage(); }
    });
    // Przesuwanie wykresu: przeciąganie myszą, przyciski ‹ › (strzałki i dotyk działają natywnie; przewijanie boczne bywa niewidoczne).
    const scroll = $('scroll');
    let drag = null, moved = false;
    scroll.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { drag = { x: e.clientX, left: scroll.scrollLeft }; moved = false; } });
    scroll.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) > 5) { moved = true; scroll.classList.add('dragging'); scroll.setPointerCapture(e.pointerId); }
      if (moved) scroll.scrollLeft = drag.left - dx;
    });
    const end = () => { drag = null; scroll.classList.remove('dragging'); };
    scroll.addEventListener('pointerup', end); scroll.addEventListener('pointercancel', end);
    scroll.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    const pan = dir => scroll.scrollBy({ left: dir * scroll.clientWidth * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('panLeft').addEventListener('click', () => pan(-1));
    $('panRight').addEventListener('click', () => pan(1));
    // Dymek przy najechaniu: krok, punkt, emocja i poziom obecny oraz po wdrożeniu (wartości z danych, prognoza z oznaczeniem statusu).
    const tip = $('tip');
    const tipHtml = t => {
      const f = t.forecast, step = cj.steps.find(s => s.nr === t.step), st = cj.forecastStatus ? ' (' + esc(cj.forecastStatus) + ')' : '';
      return `<b>${esc(title(t))}</b><span class="tip-step">Krok ${esc(t.step)}: ${esc(step.name)}</span>`
        + `<span>Emocja: <b>${esc(t.emotion || 'brak danych')}</b></span><span>Poziom obecnie: <b>${esc(level(t.emotionValue))}</b></span>`
        + (f ? `<span class="tip-fc">Po wdrożeniu${st}:</span><span>Quick Wins <b>${esc(level(f.qw))}</b> · Mid <b>${esc(level(f.mid))}</b> · Long <b>${esc(level(f.long))}</b></span>` : '<span class="tip-fc">Po wdrożeniu: brak prognozy</span>')
        + (t.painPoint ? `<span>Pain point: ${esc(t.painPoint)}</span>` : '');
    };
    let tipIndex = -1;
    let hoverIndex = -1;
    const setHover = i => {
      if (i === hoverIndex) return;
      if (hoverIndex >= 0) { pointEls[hoverIndex].classList.remove('hover'); ppCells[hoverIndex].classList.remove('hover'); }
      hoverIndex = i;
      if (i >= 0) { pointEls[i].classList.add('hover'); ppCells[i].classList.add('hover'); hoverEl.setAttribute('x', colX[i]); hoverEl.setAttribute('width', colW[i]); }
      hoverEl.setAttribute('visibility', i >= 0 ? 'visible' : 'hidden');
    };
    const hideTip = () => { tip.hidden = true; tipIndex = -1; setHover(-1); };
    // Dymek tylko przy najechaniu na punkt krzywej (promień 12 px); nad resztą wykresu świeci sama kolumna.
    const nearDot = (i, px, py) => [...shown].some(key => { const v = model.series[key][i]; return v !== null && Math.hypot(px - (colX[i] + colW[i] / 2), py - y(v)) <= 12; });
    const showTip = (e, i) => {
      if (i !== tipIndex) { tip.innerHTML = tipHtml(model.points[i]); tipIndex = i; }
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - w - 8)) + 'px';
      tip.style.top = (e.clientY + 18 + h > window.innerHeight ? e.clientY - h - 12 : e.clientY + 18) + 'px';
    };
    const moveTip = e => {
      if (drag || e.pointerType !== 'mouse') return hideTip();
      const chart = $('chart').getBoundingClientRect();
      const cell = e.target.closest('[data-i]');
      const i = e.target.closest('#chart') ? colAt(e.clientX - chart.left) : cell ? Number(cell.dataset.i) : -1;
      if (i < 0 || i >= model.points.length) return hideTip();
      setHover(i);
      if (!e.target.closest('#chart') || !nearDot(i, e.clientX - chart.left, e.clientY - chart.top)) { tip.hidden = true; tipIndex = -1; return; }
      showTip(e, i);
    };
    $('inner').addEventListener('pointermove', moveTip);
    $('inner').addEventListener('pointerleave', hideTip);
    scroll.addEventListener('scroll', hideTip);
    // Widoki Orbita i Krajobraz (js/cj-viz.js) korzystają z tego samego zaznaczenia, filtra pain pointów i dymka.
    if (fitZoom() >= .2) setZoom(fitZoom());
    window.CX.cjViz.init({ cj, core, model, $, el, esc, title, level, emClass, ppClass, select, showTip, hideTip, state: () => ({ sel, rel, painFilter }) });
    apply();
  }

  try { init(); } catch (error) { showError(error.message || String(error)); }
})();
