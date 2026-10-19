(() => {
  'use strict';

  // Widok „Orbita”: punkty styku po okręgu (etapy jako sektory), odległość od środka to emocja klienta (−5 na obrzeżu środka, +5 na zewnątrz).
  // Krzywa pokazuje horyzont wybrany w sterowniku, cienki kontur to emocje obecne. Wartości pochodzą wyłącznie z danych; brak wartości to przerwa.
  const R_IN = 96, R_OUT = 330, GAP = 16, VB = 402, SAMPLES = 6;
  const rad = v => R_IN + (v + 5) / 10 * (R_OUT - R_IN);
  const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
  const num = n => n.toFixed(1);
  const pt = p => num(p[0]) + ' ' + num(p[1]);
  const smooth = t => t * t * (3 - 2 * t);
  const kind = v => v < 0 ? 'neg' : v === 0 ? 'zero' : 'pos';

  function sector(r0, r1, a0, a1) {
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${pt(polar(r1, a0))}A${r1} ${r1} 0 ${large} 1 ${pt(polar(r1, a1))}L${pt(polar(r0, a1))}A${r0} ${r0} 0 ${large} 0 ${pt(polar(r0, a0))}Z`;
  }

  function create(host, ctrl, box) {
    const { cj, model, el, esc, title, ppClass } = host, pts = model.points, n = pts.length;
    const ang = i => -90 + GAP / 2 + (i + .5) / n * (360 - GAP), unit = (360 - GAP) / n;
    const stageOf = t => cj.steps.find(s => s.nr === t.step).stage;
    const svg = el('svg', { class: 'orbit', viewBox: `${-VB} ${-VB} ${2 * VB} ${2 * VB}`, role: 'group', 'aria-label': 'Orbita emocji klienta: punkty styku po okręgu, odległość od środka to poziom emocji' });
    let html = `<defs><radialGradient id="oGrad" cx="0" cy="0" r="${R_OUT}" gradientUnits="userSpaceOnUse"><stop offset="${num(R_IN / R_OUT)}" stop-color="#ff5a63"/><stop offset="${num((R_IN + R_OUT) / 2 / R_OUT)}" stop-color="#8fa0b8"/><stop offset="1" stop-color="#3fcf8e"/></radialGradient>
      <linearGradient id="oSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5fd0ff" stop-opacity="0"/><stop offset="1" stop-color="#5fd0ff" stop-opacity=".16"/></linearGradient>
      <filter id="oGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    // Etapy: sektor tła, pasek w kolorze etapu i etykieta po łuku (długie nazwy skracane do długości łuku).
    const runs = [];
    pts.forEach((t, i) => { const s = stageOf(t), last = runs[runs.length - 1]; if (last && last.stage === s) last.i1 = i; else runs.push({ stage: s, i0: i, i1: i }); });
    runs.forEach((r, k) => {
      const color = (cj.stages.find(s => s.name === r.stage) || {}).color || '#999', a0 = ang(r.i0) - unit / 2, a1 = ang(r.i1) + unit / 2, mid = (a0 + a1) / 2;
      const lower = Math.sin(mid * Math.PI / 180) > 0, lr = lower ? 382 : 365, fit = Math.max(0, Math.floor((a1 - a0) * Math.PI / 180 * lr / 9.6));
      const label = fit < 6 ? '' : r.stage.length > fit ? r.stage.slice(0, fit - 1) + '…' : r.stage;
      const [sx, sy] = polar(lr, lower ? a1 - .4 : a0 + .4), [ex, ey] = polar(lr, lower ? a0 + .4 : a1 - .4);
      html += `<path class="o-wedge" d="${sector(R_IN, R_OUT + 8, a0 + .3, a1 - .3)}" style="fill:${esc(color)}"/><path class="o-band" d="${sector(R_OUT + 12, R_OUT + 19, a0 + .3, a1 - .3)}" style="fill:${esc(color)}"><title>${esc(r.stage)}</title></path>`
        + `<path id="oArc${k}" d="M${pt([sx, sy])}A${lr} ${lr} 0 0 ${lower ? 0 : 1} ${pt([ex, ey])}" fill="none"/><text class="o-stage"><title>${esc(r.stage)}</title><textPath href="#oArc${k}" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>`;
    });
    pts.forEach((t, i) => { if (i && t.step !== pts[i - 1].step) { const a = ang(i) - unit / 2; html += `<line class="o-sep" x1="${num(polar(R_IN, a)[0])}" y1="${num(polar(R_IN, a)[1])}" x2="${num(polar(R_OUT + 8, a)[0])}" y2="${num(polar(R_OUT + 8, a)[1])}"/>`; } });
    for (let v = -5; v <= 5; v++) html += `<circle class="${v === 0 ? 'o-zero' : 'o-ring'}" r="${rad(v)}"/>`;
    [-5, 0, 5].forEach(v => { html += `<text class="o-scale" x="0" y="${-rad(v)}" dy=".35em" text-anchor="middle">${v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0'}</text>`; });
    html += '<g class="o-sweep"><path d="' + sector(0, R_OUT + 20, -40, 0) + '" fill="url(#oSweep)"/></g><g class="o-dyn"><path class="o-ghost"/><path class="o-area"/><path class="o-line"/><g class="o-nodes"></g><circle class="o-cursor" r="13" visibility="hidden"/></g>'
      + `<circle class="o-hub" r="${R_IN - 12}"/><text class="o-hub-top" y="-4" text-anchor="middle">KLIENT</text><text class="o-hub-sub" y="26" text-anchor="middle"></text>`;
    svg.innerHTML = html;
    const nodes = svg.querySelector('.o-nodes'), ghost = svg.querySelector('.o-ghost'), area = svg.querySelector('.o-area'), line = svg.querySelector('.o-line'), cursorEl = svg.querySelector('.o-cursor');
    const hubTop = svg.querySelector('.o-hub-top'), hubSub = svg.querySelector('.o-hub-sub');
    const els = pts.map((t, i) => {
      const g = el('g', { class: 'o-node ' + ppClass(t.painPoint), tabindex: 0, role: 'button', 'data-i': i, 'aria-label': title(t) });
      const stem = el('line', { class: 'o-stem' }), pulse = el('circle', { class: 'o-pulse', r: 9 }), dot = el('circle', { class: 'o-dot', r: 6 }), hit = el('circle', { class: 'o-hit', r: 15 });
      g.append(stem, pulse, dot, hit); nodes.append(g);
      return { g, stem, pulse, dot, hit };
    });

    // Odcinki bez przerw: [[indeksy], ...]. Między sąsiednimi punktami promień płynnie (smoothstep) przechodzi od jednej wartości do drugiej.
    const runsOf = arr => { const out = []; let cur = null; arr.forEach((v, i) => { if (v === null) cur = null; else { if (!cur) out.push(cur = []); cur.push(i); } }); return out; };
    const trace = (arr, idx) => {
      const out = [];
      idx.forEach((i, k) => {
        out.push(polar(rad(arr[i]), ang(i)));
        if (k + 1 < idx.length) { const j = idx[k + 1]; for (let s = 1; s < SAMPLES; s++) { const t = s / SAMPLES; out.push(polar(rad(arr[i]) + (rad(arr[j]) - rad(arr[i])) * smooth(t), ang(i) + (ang(j) - ang(i)) * t)); } }
      });
      return out;
    };
    const lineD = arr => runsOf(arr).map(idx => 'M' + trace(arr, idx).map(pt).join('L')).join('');
    const areaD = arr => runsOf(arr).filter(idx => idx.length > 1).map(idx => {
      const a0 = ang(idx[0]), a1 = ang(idx[idx.length - 1]);
      return 'M' + trace(arr, idx).map(pt).join('L') + `L${pt(polar(R_IN, a1))}A${R_IN} ${R_IN} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${pt(polar(R_IN, a0))}Z`;
    }).join('');

    const active = () => { const st = host.state(); return cursorIndex() >= 0 ? cursorIndex() : st.sel && st.sel.kind === 'tp' ? pts.findIndex(t => t.id === st.sel.id) : -1; };
    const cursorIndex = () => ctrl.cursor();
    function hub() {
      const i = active(), vals = ctrl.vals(), hz = host.core.HORIZONS.find(h => h.key === ctrl.horizon());
      if (i < 0 || vals[i] === null) { hubTop.textContent = i < 0 ? 'KLIENT' : 'brak'; hubTop.setAttribute('class', 'o-hub-top'); hubSub.textContent = i < 0 ? hz.label.toUpperCase() : 'brak danych w punkcie'; return; }
      const v = ctrl.shown(vals[i]); hubTop.textContent = host.level(v); hubTop.setAttribute('class', 'o-hub-top big v-' + kind(v)); hubSub.textContent = 'EMOCJA · ' + hz.label.toUpperCase();
    }

    function draw() {
      const vals = ctrl.vals(), base = ctrl.base();
      ghost.setAttribute('d', ctrl.horizon() === 'now' ? '' : lineD(base));
      line.setAttribute('d', lineD(vals)); area.setAttribute('d', areaD(vals));
      pts.forEach((t, i) => {
        const e = els[i], v = vals[i];
        e.g.toggleAttribute('data-empty', v === null);
        e.g.setAttribute('aria-label', title(t) + ', emocja ' + host.level(ctrl.shown(v)) + (t.painPoint ? ', pain point ' + t.painPoint : ''));
        if (v === null) return;
        const [x, y] = polar(rad(v), ang(i)), [sx, sy] = polar(R_IN, ang(i));
        e.stem.setAttribute('x1', num(sx)); e.stem.setAttribute('y1', num(sy)); e.stem.setAttribute('x2', num(x)); e.stem.setAttribute('y2', num(y));
        for (const c of [e.pulse, e.dot, e.hit]) { c.setAttribute('cx', num(x)); c.setAttribute('cy', num(y)); }
        e.g.dataset.v = kind(v); e.g.dataset.pulse = t.painPoint && v < 0 ? '1' : '0';
      });
      moveCursor(); hub();
    }

    function moveCursor() {
      const i = cursorIndex(), v = i >= 0 ? ctrl.vals()[i] : null;
      cursorEl.setAttribute('visibility', i >= 0 && v !== null ? 'visible' : 'hidden');
      if (i >= 0 && v !== null) { const [x, y] = polar(rad(v), ang(i)); cursorEl.setAttribute('cx', num(x)); cursorEl.setAttribute('cy', num(y)); }
      els.forEach((e, k) => e.g.classList.toggle('cur', k === i));
    }

    function update() {
      const st = host.state(), act = st.sel !== null;
      pts.forEach((t, i) => {
        const on = st.rel.tp.has(t.id), filtered = st.painFilter.size && !st.painFilter.has(t.painPoint), g = els[i].g;
        g.classList.toggle('on', on); g.classList.toggle('off', (act && !on) || !!filtered);
        g.classList.toggle('sel', !!st.sel && st.sel.kind === 'tp' && st.sel.id === t.id);
        g.setAttribute('aria-pressed', String(g.classList.contains('sel')));
      });
      moveCursor(); hub();
    }

    const pick = e => { const g = e.target.closest('.o-node'); return g ? Number(g.dataset.i) : -1; };
    svg.addEventListener('click', e => { const i = pick(e); if (i >= 0) host.select({ kind: 'tp', id: pts[i].id }); });
    svg.addEventListener('keydown', e => { const i = pick(e); if (i >= 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); host.select({ kind: 'tp', id: pts[i].id }); } });
    // Wiązka skanu podąża za myszą: kąt liczony względem środka orbity, z wygładzeniem (bez wygładzenia przy reduced motion); poza wykresem znika.
    const sweep = svg.querySelector('.o-sweep');
    let target = -90, shownAngle = -90, sweepRaf = 0;
    const spin = () => {
      const diff = ((target - shownAngle + 540) % 360) - 180;
      shownAngle = ctrl.reduced() || Math.abs(diff) < .3 ? target : shownAngle + diff * .18;
      sweep.style.transform = `rotate(${shownAngle}deg)`;
      sweepRaf = shownAngle === target ? 0 : requestAnimationFrame(spin);
    };
    const aim = e => {
      const m = svg.getScreenCTM(); if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      target = Math.atan2(p.y, p.x) * 180 / Math.PI; sweep.classList.add('aim');
      if (!sweepRaf) sweepRaf = requestAnimationFrame(spin);
    };
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') aim(e); });
    svg.addEventListener('pointerleave', () => sweep.classList.remove('aim'));
    svg.addEventListener('pointermove', e => { const i = pick(e); if (i >= 0 && e.pointerType === 'mouse') host.showTip(e, i); else host.hideTip(); });
    svg.addEventListener('pointerleave', () => host.hideTip());
    box.append(svg);
    return { draw, update, setCursor: () => { moveCursor(); hub(); }, legend: 'Odległość od środka to emocja klienta: −5 przy wewnętrznym pierścieniu, +5 na zewnątrz. Pulsujące punkty to pain pointy z ujemną emocją. Cienki kontur to emocje obecne.' };
  }

  window.CX = window.CX || {};
  (window.CX.cjViews = window.CX.cjViews || {}).orbit = create;
})();
