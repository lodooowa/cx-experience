(() => {
  'use strict';

  const mx = window.CX_MX;
  const { $, esc, data, marks, tpIndex } = mx;
  const R_IN = 150, R_OUT = 450, GAP = 12, LABEL_R = 478, ZOOM = 340, AUTO_MS = 7000;
  const overview = { x: -560, y: -560, w: 1120, h: 1120 };
  const state = { ratings: new Set(), selected: null, queue: null, pos: 0, auto: null };
  const pos = new Map();
  const discussHint = $('discuss').title;
  let svg, view = { ...overview }, raf = 0;

  const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
  const num = n => n.toFixed(1);

  function sectorPath(r0, r1, a0, a1) {
    const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${num(x0)} ${num(y0)}A${r1} ${r1} 0 ${large} 1 ${num(x1)} ${num(y1)}L${num(x2)} ${num(y2)}A${r0} ${r0} 0 ${large} 0 ${num(x3)} ${num(y3)}Z`;
  }

  function build() {
    const P = data.processes.length, M = mx.matrixKeys.length, span = 360 / P, band = (R_OUT - R_IN) / M;
    const bandOf = key => { const m = mx.matrixKeys.indexOf(key), outer = R_OUT - m * band; return [outer - band + GAP, outer]; };
    let html = `<defs><linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5fd0ff" stop-opacity="0"/><stop offset="1" stop-color="#5fd0ff" stop-opacity=".16"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    html += [150, 250, 350, 450].map(r => `<circle class="guide" r="${r}"/>`).join('');
    html += `<g class="sweep"><path d="${sectorPath(0, R_OUT + 20, -40, 0)}" fill="url(#sweepGrad)"/></g>`;
    data.processes.forEach((process, p) => {
      const a0 = -90 + p * span, a1 = a0 + span, mid = (a0 + a1) / 2;
      mx.matrixKeys.forEach(key => { const [r0, r1] = bandOf(key); html += `<path class="sector" data-p="${p}" data-m="${esc(key)}" d="${sectorPath(r0, r1, a0 + .4, a1 - .4)}"/>`; });
      const [lx, ly] = polar(LABEL_R, mid), c = Math.cos(mid * Math.PI / 180);
      html += `<text class="plabel" x="${num(lx)}" y="${num(ly)}" dy=".35em" text-anchor="${c > .25 ? 'start' : c < -.25 ? 'end' : 'middle'}">${esc(process)}</text>`;
    });
    html += `<circle class="hub" r="${R_IN - GAP - 6}"/><text class="hub-text" y="-4">KLIENT</text><text class="hub-sub" y="18">w centrum</text>`;
    data.processes.forEach((process, p) => mx.matrixKeys.forEach(key => {
      const items = data.touchpoints.filter(tp => tp.process === process && tp.matrix === key);
      const [r0, r1] = bandOf(key), mid = (r0 + r1) / 2, a0 = -90 + p * span;
      const rows = Math.ceil(items.length / 3), cols = Math.ceil(items.length / rows);
      items.forEach((tp, i) => {
        const row = i % rows, col = Math.floor(i / rows);
        const angle = a0 + span * (col + .5 + (row % 2 ? .22 : 0)) / (cols + (rows > 1 ? .22 : 0)), radius = mid + (row - (rows - 1) / 2) * 28;
        const [x, y] = polar(radius, angle);
        pos.set(tp.id, [x, y]);
        const text = `${tp.title}. ${process}. ${mx.matrixLabel(key)}. ${mx.ratingLabel(tp.rating)}.`;
        html += `<g class="node rating-${esc(tp.rating)}" data-id="${esc(tp.id)}" tabindex="0" role="button" aria-label="${esc(text)}" transform="translate(${num(x)} ${num(y)})"><title>${esc(text)}</title>
          ${tp.rating === 'niezaopiekowany' ? '<circle class="pulse" r="10"/>' : ''}<circle class="dot" r="10"/><text class="mark" y="3.5" aria-hidden="true">${esc(marks[tp.rating] || '')}</text>
          <text class="label" y="-22" text-anchor="middle" aria-hidden="true">${esc(tp.title)}</text></g>`;
      });
    }));
    svg.innerHTML = html;
  }

  const visible = () => data.touchpoints.filter(tp => state.ratings.has(tp.rating));

  function refresh() {
    const shown = new Set(visible().map(tp => tp.id));
    const queueIds = new Set(state.queue ? state.queue.map(tp => tp.id) : []);
    const spot = state.queue ? state.queue[state.pos].id : null;
    $('stage').classList.toggle('is-discussing', !!state.queue);
    svg.querySelectorAll('.node').forEach(node => {
      const id = node.dataset.id;
      node.classList.toggle('is-off', !shown.has(id));
      node.classList.toggle('in-queue', queueIds.has(id));
      node.classList.toggle('is-spot', id === spot);
      node.classList.toggle('is-selected', id === state.selected);
    });
    svg.querySelectorAll('.sector').forEach(sector => {
      const items = data.touchpoints.filter(tp => tp.process === data.processes[sector.dataset.p] && tp.matrix === sector.dataset.m && shown.has(tp.id));
      const heat = !items.length ? 'none' : items.some(tp => tp.rating === 'niezaopiekowany') ? 'crit' : items.some(tp => tp.rating === 'do_poprawy') ? 'warn' : items.some(tp => tp.rating === 'ok') ? 'ok' : 'none';
      sector.setAttribute('class', 'sector heat-' + heat);
    });
    const pool = data.touchpoints;
    $('chips').innerHTML = mx.chipsHtml(state.ratings, pool);
    const empty = !mx.sortQueue(visible()).length;
    $('discuss').disabled = empty && !state.queue;
    $('discuss').title = empty ? 'Brak punktów do przelotu w bieżących filtrach' : discussHint;
  }

  function fly(target) {
    cancelAnimationFrame(raf);
    const apply = v => { view = v; svg.setAttribute('viewBox', `${num(v.x)} ${num(v.y)} ${num(v.w)} ${num(v.h)}`); };
    if (mx.reducedMotion()) return apply({ ...target });
    const from = { ...view }, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 900), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      apply({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function select(id) {
    state.selected = id;
    $('detailBody').innerHTML = mx.detailsHtml(tpIndex.get(id));
    $('detailDrawer').hidden = false;
    $('workspace').classList.add('has-drawer');
    refresh();
  }

  function closeDetails() {
    const id = state.selected;
    state.selected = null;
    $('detailDrawer').hidden = true;
    $('workspace').classList.remove('has-drawer');
    refresh();
    const node = id && svg.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
    if (node) node.focus({ preventScroll: true });
  }

  function spotlight(at) {
    const queue = state.queue;
    state.pos = (at + queue.length) % queue.length;
    const tp = queue[state.pos], [x, y] = pos.get(tp.id);
    $('spotCount').textContent = `${state.pos + 1} / ${queue.length}`;
    $('live').textContent = `${state.pos + 1} z ${queue.length}: ${tp.title}, ${mx.ratingLabel(tp.rating)}`;
    select(tp.id);
    fly({ x: x - ZOOM / 2, y: y - ZOOM / 2, w: ZOOM, h: ZOOM });
  }

  function setAuto(on) {
    clearInterval(state.auto);
    state.auto = on ? setInterval(() => spotlight(state.pos + 1), AUTO_MS) : null;
    $('spotAuto').setAttribute('aria-pressed', String(on));
    $('spotAuto').textContent = on ? 'Auto ❚❚' : 'Auto ▶';
  }

  function startDiscuss() {
    const queue = mx.sortQueue(visible());
    if (!queue.length) return;
    state.queue = queue;
    $('discussBar').hidden = false;
    $('discuss').hidden = true;
    spotlight(0);
  }

  function endDiscuss() {
    setAuto(false);
    state.queue = null;
    $('discussBar').hidden = true;
    $('discuss').hidden = false;
    fly(overview);
    closeDetails();
  }

  function refilter() {
    const focusId = document.activeElement && document.activeElement.id;
    if (state.queue) endDiscuss();
    if (state.selected && !visible().some(tp => tp.id === state.selected)) closeDetails();
    refresh();
    if (focusId && $(focusId)) $(focusId).focus();
  }

  function countUp(el, to) {
    if (mx.reducedMotion() || !to) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function renderStats() {
    const key = mx.queueRatings[0];
    $('stats').innerHTML = mx.matrixKeys.map(m => {
      const all = data.touchpoints.filter(tp => tp.matrix === m);
      return `<div class="stat"><b data-to="${all.filter(tp => tp.rating === key).length}">0</b><span>${esc(mx.matrixLabel(m))}</span><small>${esc(mx.ratingLabel(key).toLowerCase())} z ${all.length} punktów</small></div>`;
    }).join('');
    $('stats').querySelectorAll('b').forEach(el => countUp(el, +el.dataset.to));
    $('legend').textContent = mx.matrixKeys.map((m, i) => `${i ? 'Kolejny' : 'Zewnętrzny'} pierścień: ${mx.matrixLabel(m)}`).join(' · ') + '. Wycinek to proces, jego barwa wskazuje najgorszą ocenę w wybranych filtrach.' + (data.status === 'DEMO' ? ' Dane DEMO.' : '');
  }

  function bind() {
    $('chips').addEventListener('click', event => {
      const chip = event.target.closest('[data-rating]');
      if (!chip) return;
      const key = chip.dataset.rating;
      state.ratings.has(key) ? state.ratings.delete(key) : state.ratings.add(key);
      refilter();
      const again = document.querySelector(`.chip[data-rating="${CSS.escape(key)}"]`);
      if (again) again.focus();
    });
    const activate = node => {
      if (node.classList.contains('is-off')) return;
      if (state.queue) {
        const at = state.queue.findIndex(tp => tp.id === node.dataset.id);
        if (at >= 0) { spotlight(at); return; }
        endDiscuss();
      }
      select(node.dataset.id);
    };
    svg.addEventListener('click', event => { const node = event.target.closest('.node'); if (node) activate(node); });
    svg.addEventListener('keydown', event => {
      const node = event.target.closest('.node');
      if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activate(node); }
    });
    $('discuss').addEventListener('click', startDiscuss);
    $('spotPrev').addEventListener('click', () => spotlight(state.pos - 1));
    $('spotNext').addEventListener('click', () => spotlight(state.pos + 1));
    $('spotAuto').addEventListener('click', () => setAuto(!state.auto));
    $('spotEnd').addEventListener('click', endDiscuss);
    $('closeDetails').addEventListener('click', () => state.queue ? endDiscuss() : closeDetails());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (state.queue) endDiscuss();
        else if (state.selected) closeDetails();
      } else if (state.queue && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        spotlight(state.pos + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
  }

  function init() {
    mx.init();
    svg = $('radar');
    state.ratings = new Set(mx.ratingKeys);
    build();
    renderStats();
    refresh();
    bind();
  }

  try { init(); } catch (error) { mx.showError(error.message || String(error)); }
})();
