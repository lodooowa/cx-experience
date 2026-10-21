(() => {
  'use strict';

  // Widok „Krajobraz”: emocja klienta jako profil terenu (dolina = niska emocja). Teren to emocje obecne, „woda” to krzywa wybranego horyzontu
  // (widać ją tylko tam, gdzie wychodzi ponad teren, czyli gdzie prognoza jest wyższa niż obecnie). Brak wartości w danych to przerwa.
  const COL = 70, H = 460, PLOT_T = 70, PLOT_B = 390, LANE = 430, STRIP = 28;
  const y = v => PLOT_T + (5 - v) / 10 * (PLOT_B - PLOT_T);
  const num = n => n.toFixed(1);
  const kind = v => v < 0 ? 'neg' : v === 0 ? 'zero' : 'pos';

  function create(host, ctrl, box) {
    const { cj, model, el, esc, title, level, ppClass } = host, pts = model.points, n = pts.length, W = n * COL;
    const x = i => COL * (i + .5);
    const stageOf = t => cj.steps.find(s => s.nr === t.step).stage;
    const axis = el('svg', { class: 'land-axis', width: 46, height: H, viewBox: `0 0 46 ${H}`, 'aria-hidden': 'true' });
    for (let v = -5; v <= 5; v++) axis.append(el('text', { x: 40, y: y(v) + 4, class: 'l-axis-label', 'text-anchor': 'end' }, v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0'));
    const scroller = document.createElement('div');
    scroller.className = 'land-scroll'; scroller.tabIndex = 0; scroller.setAttribute('role', 'group'); scroller.setAttribute('aria-label', 'Krajobraz emocji. Przewijaj poziomo strzałkami.');
    let zoom = 1;
    const svg = el('svg', { class: 'land', width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    let html = `<defs><linearGradient id="lTerrain" gradientUnits="userSpaceOnUse" x1="0" y1="${y(5)}" x2="0" y2="${y(-5)}"><stop offset="0" stop-color="#3fcf8e"/><stop offset=".5" stop-color="#6f86a6"/><stop offset="1" stop-color="#ff5a63"/></linearGradient>
      <linearGradient id="lWater" gradientUnits="userSpaceOnUse" x1="0" y1="${y(5)}" x2="0" y2="${y(-5)}"><stop offset="0" stop-color="#8fe6ff" stop-opacity=".85"/><stop offset="1" stop-color="#2f6fdd" stop-opacity=".45"/></linearGradient>
      <mask id="lMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path class="l-mask-terrain" fill="#000"/></mask></defs>`;
    // Pasy etapów z nazwą (zagnieżdżony svg przycina długą nazwę do szerokości etapu), granice kroków z numerem kroku u dołu.
    const runs = [];
    pts.forEach((t, i) => { const s = stageOf(t), last = runs[runs.length - 1]; if (last && last.stage === s) last.i1 = i; else runs.push({ stage: s, i0: i, i1: i }); });
    runs.forEach(r => {
      const color = (cj.stages.find(s => s.name === r.stage) || {}).color || '#999', x0 = r.i0 * COL, w = (r.i1 - r.i0 + 1) * COL;
      html += `<rect class="l-stage-bg" x="${x0}" y="0" width="${w}" height="${H}" style="fill:${esc(color)}"/><rect x="${x0}" y="0" width="${w}" height="4" style="fill:${esc(color)}"/>`
        + `<svg x="${x0}" y="6" width="${w}" height="${STRIP}"><text class="l-stage" x="8" y="14"><title>${esc(r.stage)}</title>${esc(r.stage)}</text></svg>`;
    });
    const stepAt = [];
    pts.forEach((t, i) => { if (!i || t.step !== pts[i - 1].step) stepAt.push(i); });
    stepAt.forEach(i => { html += `<line class="l-sep" x1="${i * COL}" y1="${STRIP + 8}" x2="${i * COL}" y2="${H}"/><text class="l-step" x="${i * COL + 6}" y="${PLOT_B + 22}">${esc(pts[i].step)}</text>`; });
    for (let v = -5; v <= 5; v++) html += `<line class="${v === 0 ? 'l-zero' : 'l-grid'}" x1="0" y1="${y(v)}" x2="${W}" y2="${y(v)}"/>`;
    html += '<path class="l-terrain"/><path class="l-terrain-glow"/><path class="l-terrain-line"/><g mask="url(#lMask)"><path class="l-water"/></g><path class="l-water-glow"/><path class="l-water-line"/><g class="l-nodes"></g><g class="l-trav" visibility="hidden"><circle r="16" class="l-trav-halo"/><circle r="6" class="l-trav-core"/></g>';
    svg.innerHTML = html;
    const terrain = svg.querySelector('.l-terrain'), terrainLine = svg.querySelector('.l-terrain-line'), terrainGlow = svg.querySelector('.l-terrain-glow'), waterGlow = svg.querySelector('.l-water-glow'), maskTerrain = svg.querySelector('.l-mask-terrain'), water = svg.querySelector('.l-water'), waterLine = svg.querySelector('.l-water-line');
    const nodes = svg.querySelector('.l-nodes'), trav = svg.querySelector('.l-trav');
    const els = pts.map((t, i) => {
      const g = el('g', { class: 'l-node ' + ppClass(t.painPoint), tabindex: 0, role: 'button', 'data-i': i, 'aria-label': title(t) });
      const hit = el('rect', { class: 'l-hit', x: i * COL, y: 0, width: COL, height: H });
      const flag = el('line', { class: 'l-flag', x1: x(i), x2: x(i), y2: LANE - 11 }), pulse = el('circle', { class: 'l-pulse', cx: x(i), r: 11 }), dot = el('circle', { class: 'l-dot', cx: x(i), r: 5 });
      const pill = el('g', { class: 'l-pill' });
      if (t.painPoint) pill.append(el('rect', { x: x(i) - 21, y: LANE - 10, width: 42, height: 20, rx: 10 }), el('text', { x: x(i), y: LANE + 4, 'text-anchor': 'middle' }, t.painPoint));
      g.append(hit, flag, pulse, dot, pill); nodes.append(g);
      return { g, flag, pulse, dot };
    });

    // Odcinki bez przerw i gładka krzywa: styczne poziome w każdym punkcie, więc krzywa przechodzi dokładnie przez dane i nie wychodzi poza ich zakres.
    const runsOf = arr => { const out = []; let cur = null; arr.forEach((v, i) => { if (v === null) cur = null; else { if (!cur) out.push(cur = []); cur.push(i); } }); return out; };
    const bez = (arr, idx) => idx.map((i, k) => { if (!k) return `M${x(i)} ${num(y(arr[i]))}`; const p = idx[k - 1], m = (x(p) + x(i)) / 2; return `C${m} ${num(y(arr[p]))} ${m} ${num(y(arr[i]))} ${x(i)} ${num(y(arr[i]))}`; }).join('');
    const lineD = arr => runsOf(arr).map(idx => bez(arr, idx)).join('');
    const areaD = arr => runsOf(arr).filter(idx => idx.length > 1).map(idx => bez(arr, idx) + `L${x(idx[idx.length - 1])} ${y(-5)}L${x(idx[0])} ${y(-5)}Z`).join('');
    const base = ctrl.base();
    terrain.setAttribute('d', areaD(base)); maskTerrain.setAttribute('d', areaD(base)); terrainLine.setAttribute('d', lineD(base)); terrainGlow.setAttribute('d', lineD(base));

    const cursorIndex = () => ctrl.cursor();
    function draw() {
      const vals = ctrl.vals(), shown = ctrl.horizon() !== 'now';
      water.setAttribute('d', shown ? areaD(vals) : ''); { const d = shown ? lineD(vals) : ''; waterLine.setAttribute('d', d); waterGlow.setAttribute('d', d); }
      pts.forEach((t, i) => {
        const e = els[i], v = vals[i];
        e.g.toggleAttribute('data-empty', v === null);
        e.g.setAttribute('aria-label', title(t) + ', emocja ' + level(ctrl.shown(v)) + (t.painPoint ? ', pain point ' + t.painPoint : ''));
        if (v === null) return;
        e.dot.setAttribute('cy', num(y(v))); e.pulse.setAttribute('cy', num(y(v))); e.flag.setAttribute('y1', num(y(v)));
        e.g.dataset.v = kind(v); e.g.dataset.pulse = t.painPoint && v < 0 ? '1' : '0';
      });
      moveCursor();
    }

    function moveCursor() {
      const i = cursorIndex(), v = i >= 0 ? ctrl.vals()[i] : null;
      trav.setAttribute('visibility', i >= 0 ? 'visible' : 'hidden');
      if (i >= 0) {
        trav.style.transform = `translate(${x(i)}px, ${y(v === null ? 0 : v)}px)`;
        trav.classList.toggle('empty', v === null);
        scroller.scrollTo({ left: Math.max(0, x(i) * zoom - scroller.clientWidth / 2), behavior: ctrl.reduced() ? 'auto' : 'smooth' });
      }
      els.forEach((e, k) => e.g.classList.toggle('cur', k === i));
    }

    let lastSel = null;
    function update() {
      const st = host.state(), act = st.sel !== null;
      pts.forEach((t, i) => {
        const on = st.rel.tp.has(t.id), filtered = st.painFilter.size && !st.painFilter.has(t.painPoint), g = els[i].g;
        g.classList.toggle('on', on); g.classList.toggle('off', (act && !on) || !!filtered);
        g.classList.toggle('sel', !!st.sel && st.sel.kind === 'tp' && st.sel.id === t.id);
        g.setAttribute('aria-pressed', String(g.classList.contains('sel')));
      });
      const key = st.sel && st.sel.kind === 'tp' ? st.sel.id : null;
      if (key && key !== lastSel) {
        const i = pts.findIndex(t => t.id === key);
        if (x(i) * zoom < scroller.scrollLeft + COL * zoom || x(i) * zoom > scroller.scrollLeft + scroller.clientWidth - COL * zoom) scroller.scrollTo({ left: Math.max(0, x(i) * zoom - scroller.clientWidth / 2), behavior: ctrl.reduced() ? 'auto' : 'smooth' });
      }
      lastSel = key;
    }

    const pick = e => { const g = e.target.closest('.l-node'); return g ? Number(g.dataset.i) : -1; };
    svg.addEventListener('click', e => { const i = pick(e); if (i >= 0) host.select({ kind: 'tp', id: pts[i].id }); });
    svg.addEventListener('keydown', e => { const i = pick(e); if (i >= 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); host.select({ kind: 'tp', id: pts[i].id }); } });
    svg.addEventListener('pointermove', e => { const i = pick(e); if (i >= 0 && e.pointerType === 'mouse') host.showTip(e, i); else host.hideTip(); });
    svg.addEventListener('pointerleave', () => host.hideTip());
    scroller.addEventListener('scroll', () => host.hideTip());
    // Powiększenie jak na wykresie: te same przyciski, skala jednolita (osie i teksty rosną razem z terenem).
    const MAXZ = 1.8, fitZoom = () => Math.max(.1, Math.min(1, (scroller.clientWidth - 2) / W)), $ = host.$;
    const active = () => document.body.classList.contains('view-landscape');
    function setZoom(next, anchor) {
      next = Math.min(MAXZ, Math.max(fitZoom(), next));
      const ax = anchor === undefined ? scroller.clientWidth / 2 : anchor, frac = (scroller.scrollLeft + ax) / (W * zoom);
      zoom = next;
      svg.setAttribute('width', W * zoom); svg.setAttribute('height', H * zoom);
      axis.setAttribute('width', 46 * zoom); axis.setAttribute('height', H * zoom); axis.style.flexBasis = 46 * zoom + 'px';
      $('zoomLevel').textContent = Math.round(zoom * 100) + '%';
      scroller.scrollLeft = frac * W * zoom - ax;
    }
    const on = (id, fn) => $(id).addEventListener('click', () => { if (active()) fn(); });
    on('zoomIn', () => setZoom(zoom * 1.25)); on('zoomOut', () => setZoom(zoom / 1.25));
    on('zoomFit', () => setZoom(fitZoom())); on('zoomReset', () => setZoom(1));
    scroller.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - scroller.getBoundingClientRect().left); }, { passive: false });
    scroller.addEventListener('keydown', e => { if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25); else if (e.key === '-') setZoom(zoom / 1.25); else if (e.key === '0') setZoom(1); else return; e.preventDefault(); });
    window.addEventListener('resize', () => { if (active() && zoom < fitZoom()) setZoom(fitZoom()); });
    scroller.append(svg);
    const wrap = document.createElement('div');
    wrap.className = 'land-wrap'; wrap.append(axis, scroller);
    box.append(wrap);
    return { draw, update, activate: () => { setZoom(zoom); }, setCursor: moveCursor, legend: 'Teren to emocje obecne: dolina oznacza niską emocję, szczyt wysoką. Błękitna „woda” pokazuje wybrany horyzont tam, gdzie prognoza jest wyższa niż obecnie. Pulsujące punkty to pain pointy z ujemną emocją, pod terenem widać kod pain pointu.' };
  }

  window.CX = window.CX || {};
  (window.CX.cjViews = window.CX.cjViews || {}).landscape = create;
})();
