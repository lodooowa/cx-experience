(() => {
  'use strict';

  const mx = window.CX_MX;
  const { $, esc, data, marks, tpIndex } = mx;
  const NS = 'http://www.w3.org/2000/svg';
  const MIN_K = 0.5, MAX_K = 8;
  const view = { k: 1, x: 0, y: 0 };
  const state = { lanes: new Set(), selected: null };
  let allLanes = [], layout = null, svg, root, viewport, dragged = false;

  const laneLabel = id => (allLanes.find(lane => lane.id === id) || {}).label || id;
  const nodeLabel = (tp, id) => `${tp.title}. Tor: ${laneLabel(id)}. Proces: ${tp.process}. ${mx.ratingLabel(tp.rating)}.`;
  const el = (name, attrs = {}, text) => {
    const node = document.createElementNS(NS, name);
    for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const clip = (text, max) => text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;

  function compute() {
    const lanes = allLanes.map(lane => lane.id).filter(id => state.lanes.has(id));
    layout = window.CX_FLOW_LAYOUT.compute(data, window.CX_FLOW, { lanes });
  }

  function renderMap() {
    svg.textContent = '';
    root = el('g', { class: 'flow-root' });
    svg.appendChild(root);
    const { width, height } = layout;
    const body = el('g');
    const D = window.CX_FLOW_LAYOUT.DEFAULTS;
    const bands = el('g'), heads = el('g'), edges = el('g', { class: 'flow-edges' }), nodes = el('g', { class: 'flow-nodes' });
    layout.lanes.forEach((lane, i) => {
      bands.appendChild(el('rect', { class: 'lane-band' + (i % 2 ? ' alt' : ''), x: 0, y: lane.y, width, height: lane.h }));
      const label = el('text', { class: 'lane-label', x: 10, y: lane.y + 24 });
      const words = laneLabel(lane.id).split(/\s+/);
      let line = '', row = 0;
      const flush = () => { if (line) { label.appendChild(el('tspan', { x: 10, dy: row++ ? 14 : 0 }, line)); line = ''; } };
      for (const word of words) { if (line && (line + ' ' + word).length > 15) flush(); line = line ? line + ' ' + word : word; }
      flush();
      bands.appendChild(label);
    });
    for (const col of layout.columns) {
      const head = el('text', { class: 'col-head', x: col.x + col.w / 2, y: D.headerH - 14, 'text-anchor': 'middle' }, clip(col.process, Math.floor(col.w / 6.5)));
      head.appendChild(el('title', {}, col.process));
      heads.appendChild(head);
    }
    for (const e of layout.edges) {
      const path = el('path', { class: 'flow-edge' + (e.optional ? ' optional' : '') + (e.backward ? ' backward' : ''), d: e.d, 'data-from': e.from, 'data-to': e.to });
      edges.appendChild(path);
      if (e.label && e.labelX !== undefined) edges.appendChild(el('text', { class: 'edge-label', x: e.labelX, y: e.labelY, 'text-anchor': 'middle' }, e.label));
    }
    const laneIndex = new Map(layout.lanes.map((lane, i) => [lane.id, i]));
    const ordered = layout.nodes.map((n, i) => ({ n, i })).sort((a, b) => a.n.col - b.n.col || laneIndex.get(a.n.lane) - laneIndex.get(b.n.lane) || a.i - b.i);
    for (const { n } of ordered) {
      const tp = tpIndex.get(n.id);
      const g = el('g', { class: `flow-node rating-${tp.rating}`, transform: `translate(${n.x} ${n.y})`, tabindex: 0, role: 'button', 'data-id': n.id, 'aria-label': nodeLabel(tp, n.lane) });
      g.appendChild(el('title', {}, nodeLabel(tp, n.lane)));
      g.appendChild(el('rect', { class: 'node-card', width: n.w, height: n.h }));
      g.appendChild(el('rect', { class: 'node-bar', y: n.h - 5, width: n.w, height: 5 }));
      const fo = el('foreignObject', { x: 0, y: 0, width: n.w, height: n.h - 5, 'pointer-events': 'none' });
      const text = document.createElement('div');
      text.className = 'node-text';
      text.textContent = tp.title;
      fo.appendChild(text);
      g.appendChild(fo);
      nodes.appendChild(g);
    }
    body.append(bands, heads, edges, nodes);
    root.appendChild(body);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    syncSelected();
  }

  function renderList() {
    const shown = data.touchpoints.filter(tp => state.lanes.has(window.CX_FLOW_CORE.laneOf(tp)));
    let html = '';
    for (const lane of allLanes.filter(l => state.lanes.has(l.id))) {
      html += `<h2 class="list-lane">${esc(lane.label)}</h2>`;
      for (const process of data.processes) {
        const items = shown.filter(tp => tp.process === process && window.CX_FLOW_CORE.laneOf(tp) === lane.id);
        if (!items.length) continue;
        html += `<h3 class="list-process">${esc(process)}</h3>` + items.map(tp => `<button type="button" class="flow-item rating-${esc(tp.rating)}" data-id="${esc(tp.id)}" aria-label="${esc(nodeLabel(tp, lane.id))}"><span class="mark" aria-hidden="true">${esc(marks[tp.rating] || '')}</span>${esc(tp.title)}</button>`).join('');
      }
    }
    $('flowList').innerHTML = html;
  }

  // Widok: transform w jednostkach viewBox; k = 1 to „dopasuj” (cała mapa w kontenerze).
  function metrics() {
    const box = svg.viewBox.baseVal, rect = viewport.getBoundingClientRect();
    const base = Math.min(rect.width / box.width, rect.height / box.height);
    return { box, rect, base };
  }
  function apply() {
    root.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  }
  function fit() { view.k = 1; view.x = 0; view.y = 0; apply(); }
  // 100% = jednostka SVG to piksel ekranu
  function reset() { const { base } = metrics(); view.k = base > 0 ? 1 / base : 1; view.x = 0; view.y = 0; apply(); }
  function zoom(factor) {
    const { rect, base } = metrics();
    const k = Math.min(MAX_K, Math.max(MIN_K, view.k * factor));
    const cx = rect.width / base / 2, cy = rect.height / base / 2;
    view.x = cx - (cx - view.x) * (k / view.k);
    view.y = cy - (cy - view.y) * (k / view.k);
    view.k = k;
    apply();
  }
  function pan(dx, dy) { view.x += dx; view.y += dy; apply(); }

  function syncSelected() {
    if (!root) return;
    root.querySelectorAll('.flow-node').forEach(node => node.classList.toggle('is-selected', node.dataset.id === state.selected));
  }
  function highlight(id) {
    svg.classList.toggle('has-hl', !!id);
    root.querySelectorAll('.flow-node').forEach(node => node.classList.toggle('is-hl', !!id && node.dataset.id === id));
    root.querySelectorAll('.flow-edge').forEach(edge => edge.classList.toggle('is-hl', !!id && (edge.dataset.from === id || edge.dataset.to === id)));
    if (id) {
      const linked = new Set([id]);
      root.querySelectorAll('.flow-edge.is-hl').forEach(edge => { linked.add(edge.dataset.from); linked.add(edge.dataset.to); });
      root.querySelectorAll('.flow-node').forEach(node => node.classList.toggle('is-linked', linked.has(node.dataset.id)));
    } else root.querySelectorAll('.flow-node.is-linked').forEach(node => node.classList.remove('is-linked'));
  }

  function select(id) {
    state.selected = id;
    $('detailBody').innerHTML = mx.detailsHtml(tpIndex.get(id));
    $('detailDrawer').hidden = false;
    $('workspace').classList.add('has-drawer');
    syncSelected();
  }
  function closeDetails() {
    const id = state.selected;
    state.selected = null;
    $('detailDrawer').hidden = true;
    $('workspace').classList.remove('has-drawer');
    syncSelected();
    const node = id && (document.querySelector(`.flow-node[data-id="${CSS.escape(id)}"]`) || document.querySelector(`.flow-item[data-id="${CSS.escape(id)}"]`));
    if (node) node.focus({ preventScroll: true });
  }

  function renderChips() {
    $('lanes').innerHTML = allLanes.map(lane => `<button type="button" class="chip chip-lane" data-lane="${esc(lane.id)}" aria-pressed="${state.lanes.has(lane.id)}">${esc(lane.label)} <b>${data.touchpoints.filter(tp => window.CX_FLOW_CORE.laneOf(tp) === lane.id).length}</b></button>`).join('');
  }
  function redraw() {
    if (state.selected && !state.lanes.has(window.CX_FLOW_CORE.laneOf(tpIndex.get(state.selected)))) closeDetails();
    renderChips();
    compute();
    if (root) highlight(null);
    renderMap();
    renderList();
    reset();
  }

  function bind() {
    $('lanes').addEventListener('click', event => {
      const chip = event.target.closest('[data-lane]');
      if (!chip) return;
      const id = chip.dataset.lane;
      if (state.lanes.has(id)) { if (state.lanes.size > 1) state.lanes.delete(id); } else state.lanes.add(id);
      redraw();
      const again = $('lanes').querySelector(`[data-lane="${CSS.escape(id)}"]`);
      if (again) again.focus();
    });
    $('zoomIn').addEventListener('click', () => zoom(1.25));
    $('zoomOut').addEventListener('click', () => zoom(0.8));
    $('zoomFit').addEventListener('click', fit);
    $('zoomReset').addEventListener('click', reset);
    $('closeDetails').addEventListener('click', closeDetails);
    $('flowList').addEventListener('click', event => { const item = event.target.closest('.flow-item'); if (item) select(item.dataset.id); });

    let start = null;
    viewport.addEventListener('pointerdown', event => {
      dragged = false;
      if (event.button !== 0 || event.target.closest('.flow-node')) return;
      start = { x: event.clientX, y: event.clientY };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-panning');
    });
    viewport.addEventListener('pointermove', event => {
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      dragged = true;
      const { base } = metrics();
      pan(dx / base, dy / base);
      start = { x: event.clientX, y: event.clientY };
    });
    const stop = () => { start = null; viewport.classList.remove('is-panning'); };
    viewport.addEventListener('pointerup', stop);
    viewport.addEventListener('pointercancel', stop);
    viewport.addEventListener('click', event => {
      const node = event.target.closest('.flow-node');
      if (node && !dragged) select(node.dataset.id);
    });
    viewport.addEventListener('keydown', event => {
      const node = event.target.closest && event.target.closest('.flow-node');
      if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(node.dataset.id); return; }
      const step = 60;
      const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (moves[event.key]) { event.preventDefault(); pan(...moves[event.key]); }
      else if (event.key === '+' || event.key === '=') zoom(1.25);
      else if (event.key === '-' || event.key === '_') zoom(0.8);
      else if (event.key === '0') fit();
    });
    viewport.addEventListener('mouseover', event => { const node = event.target.closest('.flow-node'); if (node) highlight(node.dataset.id); });
    viewport.addEventListener('mouseout', event => { if (event.target.closest('.flow-node')) highlight(null); });
    viewport.addEventListener('focusin', event => {
      const node = event.target.closest('.flow-node');
      if (!node) return;
      highlight(node.dataset.id);
      // fokus klawiaturą nie może zostać poza widocznym obszarem
      const a = node.getBoundingClientRect(), b = viewport.getBoundingClientRect();
      const dx = a.left < b.left ? b.left - a.left + 16 : a.right > b.right ? b.right - a.right - 16 : 0;
      const dy = a.top < b.top ? b.top - a.top + 16 : a.bottom > b.bottom ? b.bottom - a.bottom - 16 : 0;
      if (dx || dy) { const { base } = metrics(); pan(dx / base, dy / base); }
    });
    viewport.addEventListener('focusout', () => highlight(null));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state.selected && event.target.tagName !== 'SELECT') closeDetails();
    });
  }

  function init() {
    mx.init();
    const flow = window.CX_FLOW, core = window.CX_FLOW_CORE;
    if (!core || !window.CX_FLOW_LAYOUT) throw Error('Brak js/flow-core.js lub js/flow-layout.js.');
    core.validate(data, flow).forEach(text => console.warn(text));
    $('demoPill').hidden = !(data.status === 'DEMO' || flow.status === 'DEMO');
    allLanes = core.lanes(data, flow);
    state.lanes = new Set(allLanes.map(lane => lane.id));
    svg = $('flowSvg');
    viewport = $('flowViewport');
    $('legend').innerHTML = '<span>Kolor paska na dole karty: ocena CX (' + mx.ratingKeys.map(key => esc(marks[key] || '') + ' ' + esc(mx.ratingLabel(key))).join(', ') + ')</span><span>Linia przerywana: krok opcjonalny</span><span>Łuk nad kartami: powrót do wcześniejszego etapu</span>';
    bind();
    redraw();
    reset();
  }

  try { init(); } catch (error) { mx.showError(error.message || String(error)); }
})();
