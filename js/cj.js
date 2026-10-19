(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const NS = 'http://www.w3.org/2000/svg';
  const GUTTER = 96, PW = 92, HEIGHT = 330, TOP = 14, BOTTOM = 14, MIN = -5, MAX = 5;
  const cj = window.CX_CJ, core = window.CX.cjCore;
  let model, sel = null, rel = null, shown = new Set(['now']), painFilter = new Set();
  let zoom = 1;
  let seriesDots = [], colX = [], colW = [], totalW = 0;
  let dots = [], pointEls = [], ppCells = [], hoverEl = null, ppIndex = new Map(), treeNodes = [];

  const el = (name, attrs = {}, text) => {
    const node = document.createElementNS(NS, name);
    for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const showError = message => { $('app').hidden = true; $('errorScreen').hidden = false; $('errorText').textContent = message; };
  const title = t => t.title || '(bez nazwy) ' + t.id;
  const level = v => v === null || v === undefined ? 'brak danych' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  const ppClass = id => ppIndex.has(id) ? 'pp-' + (ppIndex.get(id) % 6) : 'pp-none';
  const y = v => TOP + (MAX - v) / (MAX - MIN) * (HEIGHT - TOP - BOTTOM);

  function toolbar() {
    $('horizons').innerHTML = core.HORIZONS.map(h => {
      const ok = h.key === 'now' || model.hasForecast(h.key);
      return `<button type="button" class="chip hz hz-${h.key}" data-h="${h.key}" aria-pressed="${shown.has(h.key)}"${ok && h.key !== 'now' ? '' : h.key === 'now' ? ' disabled' : ' disabled title="Brak wartości w zakładce Prognoza"'}><i class="sw"></i>${esc(h.label)}${h.key !== 'now' && cj.forecastStatus ? ' (' + esc(cj.forecastStatus) + ')' : ''}</button>`;
    }).join('');
    $('pains').innerHTML = cj.painPoints.map(p => `<button type="button" class="chip pp ${ppClass(p.id)}" data-pp="${esc(p.id)}" aria-pressed="${painFilter.has(p.id)}" title="${esc(p.description)}"><i class="sw"></i>${esc(p.name)}</button>`).join('');
  }

  // Szerokość kolumny punktu: PW * powiększenie; od 80% etap dostaje dodatkowo tyle miejsca, żeby jego nazwa zmieściła się w jednej linii (po równo na jego punkty).
  function layout() {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '800 10px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const stageOf = t => cj.steps.find(s => s.nr === t.step).stage;
    colX = []; colW = []; totalW = 0;
    let i = 0;
    while (i < model.points.length) {
      const stage = stageOf(model.points[i]);
      let n = 0;
      while (i + n < model.points.length && stageOf(model.points[i + n]) === stage) n++;
      const need = zoom >= .8 ? Math.ceil(ctx.measureText(stage.toUpperCase()).width + stage.length * .4 + 24) : 0;
      const total = Math.max(Math.round(n * PW * zoom), need), each = Math.floor(total / n);
      for (let k = 0; k < n; k++) { const w = k === n - 1 ? total - each * (n - 1) : each; colX.push(totalW); colW.push(w); totalW += w; }
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
      svg.append(el('rect', { x: colX[idx[0]], y: 0, width: colX[idx[idx.length - 1]] + colW[idx[idx.length - 1]] - colX[idx[0]], height: HEIGHT, class: 'cj-band', style: 'fill:' + stage.color }));
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
      model.series[h.key].forEach((v, i) => { if (v !== null) { const c = el('circle', { cx: x(i), cy: y(v), r: 4.5, class: 'cj-pt' }); group.append(c); seriesDots.push({ i, c }); } });
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
    axis.append(el('text', { transform: `translate(14 ${HEIGHT / 2}) rotate(-90)`, class: 'cj-axis-title', 'text-anchor': 'middle' }, 'Poziom emocji klienta (−5 do +5)'));
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
    $('stageRow').innerHTML = runs(t => stepOf(t).stage).map(r => `<div class="cj-cell stage-start" style="width:${rowW(r)}px;--stage:${esc(colorOf(stepOf(r.t).stage))}"><span title="${esc(stepOf(r.t).stage)}">${esc(stepOf(r.t).stage)}</span></div>`).join('');
    $('stepRow').innerHTML = runs(t => t.step).map(r => `<div class="cj-cell${edge(r.first)}" style="width:${rowW(r)}px"><span title="${esc(r.t.step + '. ' + stepOf(r.t).name)}"><b>${esc(r.t.step)}</b> <em class="sn">${esc(stepOf(r.t).name)}</em></span></div>`).join('');
    $('ppRow').innerHTML = pts.map((t, i) => `<div class="cj-cell pp-cell ${ppClass(t.painPoint)}${edge(i)}" data-i="${i}" style="width:${colW[i]}px">${t.painPoint ? `<i class="dot" aria-hidden="true"></i><b class="badge" title="${esc((cj.painPoints.find(p => p.id === t.painPoint) || {}).name || t.painPoint)}">${esc(t.painPoint)}</b>` : '<i class="none" title="Brak pain pointu w danych">–</i>'}</div>`).join('');
    $('steps').innerHTML = pts.map((t, i) => `<button type="button" class="cj-tp ${ppClass(t.painPoint)}${t.title ? '' : ' unnamed'}${edge(i)}" data-i="${i}" style="width:${colW[i]}px" aria-pressed="false" title="${esc(title(t))}" aria-label="${esc(title(t) + ', emocja ' + level(t.emotionValue) + (t.painPoint ? ', pain point ' + t.painPoint : ''))}"><span>${esc(title(t))}</span></button>`).join('');
    pointEls = [...document.querySelectorAll('.cj-tp')];
    ppCells = [...document.querySelectorAll('.pp-cell')];
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
      classes(dots[i]); classes(pointEls[i]); classes(ppCells[i]);
      // Wykres: punkty spoza zaznaczenia lub filtra pain pointów są przygaszone na krzywych.
      seriesDots.filter(d => d.i === i).forEach(d => d.c.classList.toggle('off', (active && !on) || !!filtered));
      pointEls[i].setAttribute('aria-pressed', String(sel && sel.kind === 'tp' && sel.id === t.id));
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
    $('pains').querySelectorAll('.pp').forEach(b => b.setAttribute('aria-pressed', String(painFilter.has(b.dataset.pp))));
    const count = painFilter.size + (shown.size < core.HORIZONS.filter(h => h.key === 'now' || model.hasForecast(h.key)).length ? 1 : 0);
    $('filtersCount').hidden = !count; $('filtersCount').textContent = count;
    detail();
  }

  function detail() {
    const box = $('detail');
    box.hidden = !sel;
    if (!sel) return;
    const named = (list, id) => (list.find(i => i.id === id) || {}).name || id;
    const row = (label, value) => value ? `<p><b>${esc(label)}:</b> ${esc(value)}</p>` : '';
    if (sel.kind === 'tp') {
      const t = cj.touchpoints.find(x => x.id === sel.id), f = t.forecast;
      box.innerHTML = `<h3>${esc(title(t))} <small>${esc(t.id)}</small></h3>`
        + row('Krok', t.step + '. ' + cj.steps.find(s => s.nr === t.step).name) + row('Kanał', t.channel) + row('Właściciel', t.owner) + row('Współwłaściciel', t.coOwner)
        + `<p><b>Emocja:</b> ${esc(t.emotion || 'brak danych')}, poziom ${esc(level(t.emotionValue))}</p>` + row('Uzasadnienie z danych', t.justification)
        + row('Pain point', t.painPoint ? t.painPoint + ' ' + named(cj.painPoints, t.painPoint) : '') + row('Root cause', t.rootCause ? t.rootCause + ' ' + named(cj.rootCauses, t.rootCause) : '')
        + row('Inicjatywa', t.initiative ? t.initiative + ' ' + named(cj.initiatives, t.initiative) : '')
        + row('Problem', t.problem) + row('Rekomendowany kierunek', t.recommendation)
        + row('Quick Win', t.quickWin) + row('Mid Term', t.midTerm) + row('Long Term', t.longTerm)
        + (f ? `<p><b>Prognoza${cj.forecastStatus ? ' (' + esc(cj.forecastStatus) + ')' : ''}:</b> po QW ${esc(level(f.qw))}, po Mid ${esc(level(f.mid))}, po Long ${esc(level(f.long))}</p>` : '')
        + '<small>Escape zamyka.</small>';
    } else {
      const list = { pp: cj.painPoints, rc: cj.rootCauses, in: cj.initiatives }[sel.kind], item = list.find(i => i.id === sel.id);
      box.innerHTML = `<h3>${esc(item.name)} <small>${esc(item.id)}</small></h3>${row('Opis', item.description)}${row('Typ', item.type)}`
        + `<p><b>Powiązane punkty styku:</b> ${rel.tp.size ? [...rel.tp].map(id => esc(title(cj.touchpoints.find(t => t.id === id)))).join(', ') : 'brak'}</p><small>Escape zamyka.</small>`;
    }
  }

  function select(next) {
    sel = sel && next && sel.kind === next.kind && sel.id === next.id ? null : next;
    apply();
    if (sel && sel.kind === 'tp') {
      const i = model.points.findIndex(t => t.id === sel.id), scroll = $('scroll'), x = colX[i];
      if (x < scroll.scrollLeft || x + colW[i] > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 2);
    }
  }

  function init() {
    if (!core) throw Error('Brak js/cj-core.js.');
    core.validate(cj);
    model = core.model(cj);
    shown = new Set(core.HORIZONS.filter(h => h.key === 'now' || model.hasForecast(h.key)).map(h => h.key));
    cj.painPoints.forEach((p, i) => ppIndex.set(p.id, i));
    $('demoPill').hidden = !/DEMO/.test(cj.forecastStatus || '');
    if (cj.warnings && cj.warnings.length) {
      $('warnings').hidden = false;
      $('warnings').innerHTML = `<summary>Uwagi do danych: ${cj.warnings.length}</summary><ul>${cj.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
    }
    layout(); toolbar(); chart(); stepsList(); treeSvg();
    $('note').textContent = 'Powiększanie: przyciski nad wykresem albo Ctrl/⌘ + kółko myszy; „Cały przebieg” pokazuje całą podróż naraz. Skala emocji klienta od −5 do +5. Brak wartości w danych oznacza przerwę w krzywej. Krzywe po Quick Wins, Mid i Long Term pochodzą z zakładki Prognoza'
      + (cj.forecastStatus ? ' (status: ' + cj.forecastStatus + ', wartości przykładowe do czasu uzupełnienia przez eksperta).' : ' (brak wartości).');
    $('horizons').addEventListener('click', e => { const b = e.target.closest('.hz'); if (!b || b.disabled) return; shown.has(b.dataset.h) ? shown.delete(b.dataset.h) : shown.add(b.dataset.h); apply(); });
    $('pains').addEventListener('click', e => { const b = e.target.closest('.pp'); if (!b) return; painFilter.has(b.dataset.pp) ? painFilter.delete(b.dataset.pp) : painFilter.add(b.dataset.pp); apply(); });
    $('inner').addEventListener('click', e => { const b = e.target.closest('.cj-tp, .pp-cell'); if (b) select({ kind: 'tp', id: model.points[Number(b.dataset.i)].id }); });
    $('chart').addEventListener('click', e => { const g = e.target.closest('.cj-mark'); if (g) select({ kind: 'tp', id: model.points[Number(g.dataset.i)].id }); });
    const node = e => { const g = e.target.closest('.cj-node'); if (g) select({ kind: g.dataset.kind, id: g.dataset.id }); };
    $('tree').addEventListener('click', node);
    $('tree').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); node(e); } });
    // Powiększanie: ponowne rozmieszczenie kolumn (wysokość i czcionki bez zmian). Przy małej szerokości kolumn nazwy się chowają, zostaje krzywa, kolory etapów i pain pointów.
    const scroll2 = $('scroll');
    const MAXZ = 1.8, fitZoom = () => Math.max(.1, Math.min(1, (scroll2.clientWidth - 2) / (model.points.length * PW)));
    const render = () => {
      hideTip(); layout(); chart(); stepsList();
      document.querySelector('.cj-chart-row').parentNode.classList.toggle('compact', PW * zoom < 60);
      $('zoomLevel').textContent = Math.round(zoom * 100) + '%';
      apply();
    };
    const setZoom = (next, anchor) => {
      next = Math.min(MAXZ, Math.max(fitZoom(), next));
      if (Math.abs(next - zoom) < .001) return;
      const ax = anchor === undefined ? scroll2.clientWidth / 2 : anchor, frac = (scroll2.scrollLeft + ax) / totalW;
      zoom = next; render();
      scroll2.scrollLeft = frac * totalW - ax;
    };
    $('zoomIn').addEventListener('click', () => setZoom(zoom * 1.25));
    $('zoomOut').addEventListener('click', () => setZoom(zoom / 1.25));
    $('zoomFit').addEventListener('click', () => setZoom(fitZoom()));
    $('zoomReset').addEventListener('click', () => setZoom(1));
    scroll2.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - scroll2.getBoundingClientRect().left); }, { passive: false });
    scroll2.addEventListener('keydown', e => { if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25); else if (e.key === '-') setZoom(zoom / 1.25); else if (e.key === '0') setZoom(1); else return; e.preventDefault(); });
    window.addEventListener('resize', () => { if (zoom < fitZoom()) setZoom(fitZoom()); });
    // Pain pointy pod nazwami punktów: domyślnie zwinięty pasek z kropkami, po rozwinięciu plakietki z kodem.
    $('ppToggle').addEventListener('click', () => {
      const open = $('ppRow').classList.toggle('collapsed') === false;
      $('ppToggle').setAttribute('aria-expanded', String(open)); $('ppToggle').querySelector('i').textContent = open ? '▾' : '▸';
      $('gutterPp').classList.toggle('collapsed', !open);
    });
    // Filtry w małym panelu rozwijanym w dół; Escape najpierw zamyka panel, potem zaznaczenie.
    const panel = $('filtersPanel'), btn = $('filtersBtn');
    const toggleFilters = open => { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', () => toggleFilters(panel.hidden));
    $('filtersClose').addEventListener('click', () => { toggleFilters(false); btn.focus(); });
    $('filtersClear').addEventListener('click', () => { painFilter.clear(); apply(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!panel.hidden) { toggleFilters(false); btn.focus(); } else if (sel) select(sel);
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
    const moveTip = e => {
      if (drag || e.pointerType !== 'mouse') return hideTip();
      const chart = $('chart').getBoundingClientRect();
      const cell = e.target.closest('[data-i]');
      const i = e.target.closest('#chart') ? colAt(e.clientX - chart.left) : cell ? Number(cell.dataset.i) : -1;
      if (i < 0 || i >= model.points.length) return hideTip();
      setHover(i);
      if (!e.target.closest('#chart') || !nearDot(i, e.clientX - chart.left, e.clientY - chart.top)) { tip.hidden = true; tipIndex = -1; return; }
      if (i !== tipIndex) { tip.innerHTML = tipHtml(model.points[i]); tipIndex = i; }
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - w - 8)) + 'px';
      tip.style.top = (e.clientY + 18 + h > window.innerHeight ? e.clientY - h - 12 : e.clientY + 18) + 'px';
    };
    $('inner').addEventListener('pointermove', moveTip);
    $('inner').addEventListener('pointerleave', hideTip);
    scroll.addEventListener('scroll', hideTip);
    apply();
  }

  try { init(); } catch (error) { showError(error.message || String(error)); }
})();
