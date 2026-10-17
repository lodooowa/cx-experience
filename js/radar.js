(() => {
  'use strict';

  const mx = window.CX_MX;
  const { $, esc, data, marks, tpIndex } = mx;
  const R_IN = 175, R_OUT = 510, GAP = 10, LABEL_R = 532, TOP_GAP = 26, NODE_R = 9, STEP = 22, ZOOM = 300, AUTO_MS = 7000;
  const mobileQuery = window.matchMedia('(max-width: 850px)');
  const isMobile = () => mobileQuery.matches;
  const overviewBox = () => ({ x: -585, y: -585, w: 1170, h: 1170 });
  const state = { ratings: new Set(), subs: new Set(), ring: null, selected: null, queue: null, pos: 0, auto: null };
  const pos = new Map();
  const discussHint = $('discuss').title;
  let svg, view = overviewBox(), raf = 0;

  const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
  const num = n => n.toFixed(1);

  function sectorPath(r0, r1, a0, a1) {
    const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${num(x0)} ${num(y0)}A${r1} ${r1} 0 ${large} 1 ${num(x1)} ${num(y1)}L${num(x2)} ${num(y2)}A${r0} ${r0} 0 ${large} 0 ${num(x3)} ${num(y3)}Z`;
  }

  function build() {
    const P = data.processes.length, R = mx.rings.length, span = (360 - TOP_GAP) / P, band = (R_OUT - R_IN) / R, start = -90 + TOP_GAP / 2;
    const bandOf = ring => { const i = mx.rings.indexOf(ring), outer = R_OUT - i * band; return [outer - band + GAP, outer]; };
    let html = `<defs><linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5fd0ff" stop-opacity="0"/><stop offset="1" stop-color="#5fd0ff" stop-opacity=".16"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    html += `<g class="sweep"><path d="${sectorPath(0, R_OUT + 20, -40, 0)}" fill="url(#sweepGrad)"/></g>`;
    mx.rings.forEach(ring => {
      const [r0, r1] = bandOf(ring), m = mx.matrixKeys.indexOf(ring.matrix);
      html += `<circle class="ring-edge m${m}" data-r="${esc(ring.key)}" r="${num(r1)}"/>`;
    });
    data.processes.forEach((process, p) => {
      const a0 = start + p * span, a1 = a0 + span, mid = (a0 + a1) / 2;
      mx.rings.forEach(ring => { const [r0, r1] = bandOf(ring); html += `<path class="sector" data-p="${p}" data-r="${esc(ring.key)}" d="${sectorPath(r0, r1, a0 + .4, a1 - .4)}"/>`; });
      // Etykieta procesu biegnie łukiem nad pierścieniami; w dolnej połowie łuk jest odwrócony, żeby tekst nie był do góry nogami.
      const lower = Math.sin(mid * Math.PI / 180) > 0, lr = lower ? LABEL_R + 18 : LABEL_R;
      const [sx, sy] = polar(lr, lower ? a1 : a0), [ex, ey] = polar(lr, lower ? a0 : a1);
      html += `<path id="lp${p}" d="M${num(sx)} ${num(sy)}A${lr} ${lr} 0 0 ${lower ? 0 : 1} ${num(ex)} ${num(ey)}" fill="none"/><text class="plabel"><textPath href="#lp${p}" startOffset="50%" text-anchor="middle">${esc(process)}</textPath></text>`;
    });
    mx.rings.forEach(ring => {
      const [r0, r1] = bandOf(ring), m = mx.matrixKeys.indexOf(ring.matrix);
      html += `<text class="ring-label m${m}" data-r="${esc(ring.key)}" x="0" y="${num(-(r0 + r1) / 2)}" dy=".35em" text-anchor="middle">${esc(ring.label.toUpperCase())}</text>`;
    });
    html += `<circle class="hub" r="${R_IN - GAP - 8}"/>
      <g class="client" aria-hidden="true"><circle class="client-head" cx="0" cy="-42" r="27"/><path class="client-body" d="M-62 40C-62 -2 -34 -10 0 -10S62 -2 62 40Z"/></g>
      <text class="hub-text" y="76">KLIENT</text>`;
    data.processes.forEach((process, p) => mx.rings.forEach(ring => {
      const items = data.touchpoints.filter(tp => tp.process === process && mx.ringKey(tp) === ring.key);
      if (!items.length) return;
      const [r0, r1] = bandOf(ring), mid = (r0 + r1) / 2, a0 = start + p * span;
      const cap = Math.max(1, Math.floor((span * Math.PI / 180 * mid - 8) / STEP)), maxRows = Math.max(1, Math.floor((r1 - r0 - 4) / STEP));
      const rows = Math.min(maxRows, Math.ceil(items.length / cap)), cols = Math.ceil(items.length / rows);
      items.forEach((tp, i) => {
        const row = i % rows, col = Math.floor(i / rows);
        const angle = a0 + span * (col + .5 + (row % 2 ? .25 : 0)) / (cols + (rows > 1 ? .25 : 0)), radius = mid + (row - (rows - 1) / 2) * STEP;
        const [x, y] = polar(radius, angle);
        pos.set(tp.id, [x, y]);
        const text = `${tp.title}. ${process}. ${ring.label}. ${mx.ratingLabel(tp.rating)}.`;
        html += `<g class="node rating-${esc(tp.rating)}" data-id="${esc(tp.id)}" tabindex="0" role="button" aria-label="${esc(text)}" transform="translate(${num(x)} ${num(y)})">
          ${tp.rating === 'niezaopiekowany' ? `<circle class="pulse" r="${NODE_R}"/>` : ''}<circle class="dot" r="${NODE_R}"/><text class="mark" y="3.5" aria-hidden="true">${esc(marks[tp.rating] || '')}</text></g>`;
      });
    }));
    html += '<g class="tag" id="tag" hidden><rect/><text/></g>';
    svg.innerHTML = html;
  }

  // Jedna etykieta nad wszystkimi punktami: nie nakłada się na sąsiadów, ma tło i stały rozmiar na ekranie.
  function scale() { return Math.min(svg.clientWidth / view.w, svg.clientHeight / view.h) || 1; }
  function showTag(id) {
    const tag = $('tag');
    if (!id || !pos.has(id)) { tag.setAttribute('hidden', ''); return; }
    const tp = tpIndex.get(id), k = 1 / scale(), [x, y] = pos.get(id);
    const text = tag.querySelector('text'), rect = tag.querySelector('rect');
    tag.removeAttribute('hidden');
    text.textContent = tp.title;
    text.setAttribute('style', `font-size:${num(14 * k)}px`);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('x', 0); text.setAttribute('y', 0);
    const box = text.getBBox(), padX = 8 * k, padY = 4 * k;
    rect.setAttribute('x', num(box.x - padX)); rect.setAttribute('y', num(box.y - padY));
    rect.setAttribute('width', num(box.width + 2 * padX)); rect.setAttribute('height', num(box.height + 2 * padY));
    tag.setAttribute('transform', `translate(${num(x)} ${num(y - NODE_R * 1.6 - 12 * k - box.height / 2 - padY)})`);
  }
  const currentTag = () => state.queue ? state.queue[state.pos].id : state.selected;

  const visible = () => data.touchpoints.filter(tp => state.ratings.has(tp.rating) && mx.passSub(tp, state.subs));

  function refresh() {
    const shown = new Set(visible().map(tp => tp.id));
    const queueIds = new Set(state.queue ? state.queue.map(tp => tp.id) : []);
    const spot = state.queue ? state.queue[state.pos].id : null;
    $('stage').classList.toggle('is-discussing', !!state.queue);
    document.body.classList.toggle('is-discussing-page', !!state.queue);
    $('stage').classList.toggle('has-ring', !!state.ring);
    svg.querySelectorAll('[data-r]').forEach(el => el.classList.toggle('ring-hit', el.dataset.r === state.ring));
    $('ringPick').querySelectorAll('[data-ring]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ring === state.ring)));
    svg.querySelectorAll('.node').forEach(node => {
      const id = node.dataset.id;
      node.classList.toggle('ring-dim', !!state.ring && mx.ringKey(tpIndex.get(id)) !== state.ring);
      node.classList.toggle('is-off', !shown.has(id));
      node.setAttribute('tabindex', shown.has(id) ? '0' : '-1');
      node.toggleAttribute('aria-disabled', !shown.has(id));
      node.classList.toggle('in-queue', queueIds.has(id));
      node.classList.toggle('is-spot', id === spot);
      node.classList.toggle('is-selected', id === state.selected);
    });
    svg.querySelectorAll('.sector').forEach(sector => {
      const items = data.touchpoints.filter(tp => tp.process === data.processes[sector.dataset.p] && mx.ringKey(tp) === sector.dataset.r && shown.has(tp.id));
      const heat = !items.length ? 'none' : items.some(tp => tp.rating === 'niezaopiekowany') ? 'crit' : items.some(tp => tp.rating === 'do_poprawy') ? 'warn' : items.some(tp => tp.rating === 'ok') ? 'ok' : 'none';
      sector.setAttribute('class', 'sector heat-' + heat + (sector.dataset.r === state.ring ? ' ring-hit' : ''));
    });
    showTag(currentTag());
    const empty = !mx.sortQueue(visible()).length;
    $('discuss').disabled = empty && !state.queue;
    $('discuss').title = empty ? 'Brak punktów do przelotu w bieżących filtrach' : discussHint;
  }

  function fly(target) {
    cancelAnimationFrame(raf);
    const apply = v => { view = v; svg.setAttribute('viewBox', `${num(v.x)} ${num(v.y)} ${num(v.w)} ${num(v.h)}`); showTag(currentTag()); };
    if (mx.reducedMotion()) return apply({ ...target });
    const from = { ...view }, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 900), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      apply({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function select(id, { open = true } = {}) {
    state.selected = id;
    $('detailBody').innerHTML = mx.detailsHtml(tpIndex.get(id));
    $('detailDrawer').hidden = !open;
    $('workspace').classList.toggle('has-drawer', open && !isMobile());
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
    select(tp.id, { open: !isMobile() });
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
    closeMenu();
    if (!isMobile()) $('stage').scrollIntoView({ block: 'start', behavior: mx.reducedMotion() ? 'auto' : 'smooth' });
    spotlight(0);
  }

  function endDiscuss() {
    setAuto(false);
    state.queue = null;
    $('discussBar').hidden = true;
    $('discuss').hidden = false;
    fly(overviewBox());
    closeDetails();
  }

  const renderChips = () => {
    $('chips').innerHTML = mx.chipsHtml(state.ratings, data.touchpoints);
    $('subs').innerHTML = mx.subChipsHtml(state.subs, data.touchpoints);
  };

  function refilter() {
    const focusId = document.activeElement && document.activeElement.id;
    if (state.queue) endDiscuss();
    if (state.selected && !visible().some(tp => tp.id === state.selected)) closeDetails();
    renderChips();
    refresh();
    if (isMobile()) closeMenu();
    else if (focusId && $(focusId)) $(focusId).focus();
  }

  function renderKey() {
    $('legend').textContent = 'Pierścienie od zewnątrz: ' + mx.rings.map(r => r.label).join(', ') + '. Wycinek to proces, jego barwa wskazuje najgorszą ocenę w wybranych filtrach.' + (data.status === 'DEMO' ? ' Dane DEMO.' : '');
    $('ringKey').innerHTML = mx.matrixKeys.map((m, i) => {
      const rings = mx.rings.filter(r => r.matrix === m);
      return `<div class="key-group m${i}"><b>${esc(mx.matrixLabel(m))}</b>${rings.length > 1 ? `<span>${rings.map(r => esc(r.label)).join(' · ')}</span>` : ''}</div>`;
    }).join('');
  }

  // Na wąskim ekranie filtry są szufladą z boku, zamykaną po zastosowaniu filtra; wybór pierścienia przechodzi do niej.
  function openMenu() {
    $('menu').classList.add('is-open');
    $('scrim').hidden = false;
    $('menuOpen').setAttribute('aria-expanded', 'true');
    $('menuClose').focus();
  }

  function closeMenu(restoreFocus = true) {
    if (!$('menu').classList.contains('is-open')) return;
    $('menu').classList.remove('is-open');
    $('scrim').hidden = true;
    $('menuOpen').setAttribute('aria-expanded', 'false');
    if (restoreFocus && isMobile()) setTimeout(() => $('menuOpen').focus(), 0);
  }

  function layoutForViewport() {
    (isMobile() ? $('ringSlot') : $('stage')).insertBefore($('ringPick'), isMobile() ? null : $('stage').firstChild);
    closeMenu(false);
    if (!state.queue) { cancelAnimationFrame(raf); view = overviewBox(); svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); showTag(currentTag()); }
    document.documentElement.style.setProperty('--top-h', document.querySelector('.topbar').offsetHeight + 'px');
  }

  function bind() {
    $('ringPick').addEventListener('click', event => {
      const button = event.target.closest('[data-ring]');
      if (!button) return;
      state.ring = state.ring === button.dataset.ring ? null : button.dataset.ring;
      refresh();
      if (isMobile()) closeMenu();
    });
    mx.bindToggle($('chips'), 'rating', state.ratings, refilter);
    mx.bindToggle($('subs'), 'sub', state.subs, refilter);
    const activate = node => {
      if (node.classList.contains('is-off')) return;
      if (state.queue) {
        const at = state.queue.findIndex(tp => tp.id === node.dataset.id);
        if (at >= 0) { spotlight(at); return; }
        endDiscuss();
      }
      select(node.dataset.id);
    };
    svg.addEventListener('pointerover', event => { const node = event.target.closest('.node'); if (node) showTag(node.dataset.id); });
    svg.addEventListener('pointerout', event => { if (event.target.closest('.node')) showTag(currentTag()); });
    svg.addEventListener('focusin', event => { const node = event.target.closest('.node'); if (node) showTag(node.dataset.id); });
    svg.addEventListener('focusout', () => showTag(currentTag()));
    window.addEventListener('resize', () => showTag(currentTag()));
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
    $('closeDetails').addEventListener('click', () => {
      if (state.queue && isMobile()) $('detailDrawer').hidden = true;
      else if (state.queue) endDiscuss();
      else closeDetails();
    });
    $('spotDetails').addEventListener('click', () => { $('detailDrawer').hidden = false; });
    $('menuOpen').addEventListener('click', openMenu);
    $('menuClose').addEventListener('click', () => closeMenu());
    $('scrim').addEventListener('click', () => closeMenu());
    mobileQuery.addEventListener('change', layoutForViewport);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if ($('menu').classList.contains('is-open')) closeMenu();
        else if (isMobile() && state.queue && !$('detailDrawer').hidden) $('detailDrawer').hidden = true;
        else if (state.queue) endDiscuss();
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
    state.subs = new Set(mx.subtypeKeys);
    build();
    renderKey();
    $('ringPick').innerHTML = '<span class="ring-pick-label">Podświetl pierścień</span>' + mx.rings.map(ring => `<button type="button" class="chip ring-btn m${mx.matrixKeys.indexOf(ring.matrix)}" data-ring="${esc(ring.key)}" aria-pressed="false">${esc(ring.label)}</button>`).join('');
    renderChips();
    refresh();
    bind();
    layoutForViewport();
    window.addEventListener('resize', () => document.documentElement.style.setProperty('--top-h', document.querySelector('.topbar').offsetHeight + 'px'));
  }

  try { init(); } catch (error) { mx.showError(error.message || String(error)); }
})();
