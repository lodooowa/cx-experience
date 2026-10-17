(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const data = window.CX_MATRIX;
  const marks = { niezaopiekowany: '!', do_poprawy: '▲', ok: '✓', brak_oceny: '–' };
  const levels = ['niski', 'średni', 'wysoki'];
  const queueRatings = ['niezaopiekowany', 'do_poprawy'];
  const state = { matrix: 'all', ratings: new Set(), selected: null, queue: null, pos: 0 };
  let ratingKeys = [], matrixKeys = [], tpIndex = new Map(), order = new Map();

  function showError(message) {
    $('app').hidden = true;
    $('errorScreen').hidden = false;
    $('errorText').textContent = message;
  }

  function validate() {
    if (!data || !Array.isArray(data.touchpoints) || !Array.isArray(data.features) || !Array.isArray(data.actions) || !Array.isArray(data.processes) || !data.labels) {
      throw Error('data/matrix.js: brak window.CX_MATRIX z polami labels, processes, touchpoints, features, actions.');
    }
    for (const group of ['matrix', 'rating', 'monitoring', 'featureType', 'actionKind']) {
      if (!data.labels[group] || typeof data.labels[group] !== 'object') throw Error('data/matrix.js: brak słownika labels.' + group);
    }
    const known = (group, key) => Object.prototype.hasOwnProperty.call(data.labels[group], key);
    const ids = new Set();
    for (const tp of data.touchpoints) {
      if (!tp.id || !tp.title || ids.has(tp.id)) throw Error('data/matrix.js: brak lub powtórzone ID punktu: ' + tp.id);
      ids.add(tp.id);
      if (!known('matrix', tp.matrix)) throw Error('data/matrix.js: nieznana macierz "' + tp.matrix + '" (' + tp.id + ')');
      if (!known('rating', tp.rating)) throw Error('data/matrix.js: nieznana ocena "' + tp.rating + '" (' + tp.id + ')');
      if (!data.processes.includes(tp.process)) throw Error('data/matrix.js: proces "' + tp.process + '" spoza listy processes (' + tp.id + ')');
      if (tp.emotionValue !== null && tp.emotionValue !== undefined && !(Number.isInteger(tp.emotionValue) && tp.emotionValue >= 1 && tp.emotionValue <= 5)) throw Error('data/matrix.js: emocja musi być 1–5 lub null (' + tp.id + ')');
    }
    const itemIds = new Set();
    for (const item of [...data.features, ...data.actions]) {
      if (!item.id || itemIds.has(item.id)) throw Error('data/matrix.js: brak lub powtórzone ID cechy/akcji: ' + item.id);
      itemIds.add(item.id);
    }
    for (const item of data.features) {
      if (!ids.has(item.touchpointId)) throw Error('data/matrix.js: cecha ' + item.id + ' wskazuje nieistniejący punkt ' + item.touchpointId);
      if (!known('featureType', item.type)) throw Error('data/matrix.js: nieznany typ cechy "' + item.type + '" (' + item.id + ')');
    }
    for (const item of data.actions) {
      if (!ids.has(item.touchpointId)) throw Error('data/matrix.js: akcja ' + item.id + ' wskazuje nieistniejący punkt ' + item.touchpointId);
      if (!known('actionKind', item.kind)) throw Error('data/matrix.js: nieznany rodzaj akcji "' + item.kind + '" (' + item.id + ')');
      if (!Number.isFinite(item.weeks) || item.weeks < 0) throw Error('data/matrix.js: weeks musi być liczbą tygodni (' + item.id + ')');
      for (const key of ['cost', 'risk', 'gain']) if (!levels.includes(item[key])) throw Error('data/matrix.js: ' + key + ' musi być: ' + levels.join(', ') + ' (' + item.id + ')');
    }
  }

  const ratingLabel = key => data.labels.rating[key];
  const matrixLabel = key => data.labels.matrix[key];
  const emotionText = tp => tp.emotionValue ? `${tp.emotion ? tp.emotion + ' ' : ''}(${tp.emotionValue}/5)` : 'brak danych';

  function inMatrix(tp) { return state.matrix === 'all' || tp.matrix === state.matrix; }
  function visible() { return data.touchpoints.filter(tp => inMatrix(tp) && state.ratings.has(tp.rating)); }

  function tileHtml(tp) {
    const bar = tp.emotionValue
      ? `<span class="emo-bar" role="img" aria-label="Emocja klienta ${tp.emotionValue} z 5">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= tp.emotionValue ? 'on' : ''}"></i>`).join('')}</span>`
      : '<span class="emo-none">brak emocji</span>';
    const label = `${tp.title}. ${tp.process}. ${ratingLabel(tp.rating)}.`;
    return `<button type="button" class="tile rating-${esc(tp.rating)}" data-id="${esc(tp.id)}" title="${esc(label)}" aria-label="${esc(label)}">
      <span class="tile-title">${esc(tp.title)}</span>
      <span class="tile-foot"><span class="mark" aria-hidden="true">${esc(marks[tp.rating] || '')}</span>${bar}</span></button>`;
  }

  function renderGrid() {
    const shown = new Set(visible().map(tp => tp.id));
    const cols = matrixKeys.filter(key => state.matrix === 'all' || key === state.matrix);
    const rows = data.processes.filter(process => data.touchpoints.some(tp => tp.process === process && shown.has(tp.id)));
    let html = `<div class="grid-head"></div>${cols.map(key => `<div class="grid-head">${esc(matrixLabel(key))}</div>`).join('')}`;
    for (const process of rows) {
      html += `<div class="grid-process">${esc(process)}</div>`;
      for (const key of cols) {
        const items = data.touchpoints.filter(tp => tp.process === process && tp.matrix === key && shown.has(tp.id));
        html += `<div class="grid-cell"><span class="cell-label">${esc(matrixLabel(key))}</span>${items.length ? items.map(tileHtml).join('') : '<span class="cell-empty" aria-label="brak punktów">—</span>'}</div>`;
      }
    }
    const grid = $('matrixGrid');
    grid.style.setProperty('--cols', cols.length);
    grid.innerHTML = rows.length ? html : '<p class="cell-empty" style="grid-column:1/-1;padding:24px">Brak punktów dla wybranych filtrów.</p>';
    syncClasses();
  }

  function syncClasses() {
    const queueIds = new Set(state.queue ? state.queue.map(tp => tp.id) : []);
    const spot = state.queue ? state.queue[state.pos].id : null;
    $('gridPanel').classList.toggle('is-discussing', !!state.queue);
    document.querySelectorAll('.tile').forEach(tile => {
      tile.classList.toggle('is-selected', tile.dataset.id === state.selected);
      tile.classList.toggle('in-queue', queueIds.has(tile.dataset.id));
      tile.classList.toggle('is-spot', tile.dataset.id === spot);
    });
  }

  function renderChips() {
    const pool = data.touchpoints.filter(inMatrix);
    $('chips').innerHTML = ratingKeys.map(key => `<button type="button" class="chip rating-${esc(key)}" data-rating="${esc(key)}" aria-pressed="${state.ratings.has(key)}"><span class="mark" aria-hidden="true">${esc(marks[key] || '')}</span>${esc(ratingLabel(key))} <b>${pool.filter(tp => tp.rating === key).length}</b></button>`).join('');
    $('legend').innerHTML = ratingKeys.map(key => `<span>${esc(marks[key] || '')} ${esc(ratingLabel(key))}</span>`).join('') + '<span>Pasek: emocja klienta (1–5), tylko gdy podana w danych</span>';
    refreshDiscussButton();
  }

  function buildQueue() {
    return visible().filter(tp => queueRatings.includes(tp.rating))
      .sort((a, b) => queueRatings.indexOf(a.rating) - queueRatings.indexOf(b.rating) || order.get(a.id) - order.get(b.id));
  }
  function refreshDiscussButton() {
    const empty = !buildQueue().length;
    $('discuss').disabled = empty && !state.queue;
    $('discuss').title = empty ? 'Brak punktów do omówienia w bieżących filtrach' : '';
  }

  function section(title, body) { return `<section class="detail-section"><h3>${esc(title)}</h3>${body}</section>`; }

  function renderDetails(tp) {
    const features = data.features.filter(f => f.touchpointId === tp.id);
    const actions = data.actions.filter(a => a.touchpointId === tp.id);
    const demo = data.status === 'DEMO';
    let html = `<div class="detail-kicker">${esc(matrixLabel(tp.matrix))} · ${esc(tp.process)}</div><h2>${esc(tp.title)}</h2>
      <span class="rating-pill rating-${esc(tp.rating)}"><span aria-hidden="true">${esc(marks[tp.rating] || '')}</span>${esc(ratingLabel(tp.rating))}</span>
      <div class="detail-meta"><span>Emocja klienta: <b>${esc(emotionText(tp))}</b></span>${tp.emotionImpact ? `<span>${esc(tp.emotionImpact)}</span>` : ''}<span>Właściciel: <b>${esc(tp.owner || 'brak danych')}</b></span><span>Monitoring: <b>${esc(data.labels.monitoring[tp.monitoring] || 'brak danych')}</b></span></div>`;
    for (const type of Object.keys(data.labels.featureType)) {
      const items = features.filter(f => f.type === type);
      if (!items.length) continue;
      html += section(data.labels.featureType[type], type === 'zrodlo'
        ? `<div class="detail-tags">${items.map(f => `<span>${esc(f.text)}</span>`).join('')}</div>`
        : `<ul class="detail-list ${type === 'dobra_praktyka' ? '' : 'avoid'}">${items.map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>`);
    }
    if (actions.length) {
      html += section('Akcje naprawcze', actions.map(a => `<div class="action-card"><strong>${esc(data.labels.actionKind[a.kind])}</strong><p>${esc(a.text)}</p>
        <div class="detail-tags"><span>Koszt: ${esc(a.cost)}</span><span>Ryzyko: ${esc(a.risk)}</span><span>Zysk: ${esc(a.gain)}</span><span>ok. ${esc(a.weeks)} tyg.${demo ? ' (DEMO)' : ''}</span></div>
        ${a.implementationRisks ? `<p>Ryzyka wdrożenia: ${esc(a.implementationRisks)}</p>` : ''}</div>`).join(''));
    }
    if (!features.length && !actions.length) html += section('Szczegóły', '<p>Brak danych szczegółowych dla tego punktu.</p>');
    $('detailBody').innerHTML = html;
  }

  function select(id, { scroll = false } = {}) {
    const tp = tpIndex.get(id);
    state.selected = id;
    renderDetails(tp);
    $('detailDrawer').hidden = false;
    $('workspace').classList.add('has-drawer');
    syncClasses();
    const tile = document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
    if (tile && scroll) {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      tile.scrollIntoView({ block: 'center', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    }
    return tile;
  }

  function closeDetails() {
    const id = state.selected;
    state.selected = null;
    $('detailDrawer').hidden = true;
    $('workspace').classList.remove('has-drawer');
    syncClasses();
    const tile = id && document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
    if (tile) tile.focus({ preventScroll: true });
  }

  function spotlight(pos) {
    const queue = state.queue;
    state.pos = (pos + queue.length) % queue.length;
    const tp = queue[state.pos];
    $('spotCount').textContent = `${state.pos + 1} / ${queue.length}`;
    $('live').textContent = `${state.pos + 1} z ${queue.length}: ${tp.title}, ${ratingLabel(tp.rating)}`;
    const tile = select(tp.id, { scroll: true });
    if (tile) tile.focus({ preventScroll: true });
  }

  function startDiscuss() {
    const queue = buildQueue();
    if (!queue.length) return;
    state.queue = queue;
    $('discussBar').hidden = false;
    $('discuss').hidden = true;
    spotlight(0);
  }

  function endDiscuss() {
    state.queue = null;
    $('discussBar').hidden = true;
    $('discuss').hidden = false;
    closeDetails();
    refreshDiscussButton();
  }

  function refilter() {
    const focusId = document.activeElement && document.activeElement.id;
    if (state.queue) endDiscuss();
    if (state.selected && !visible().some(tp => tp.id === state.selected)) closeDetails();
    renderChips();
    renderGrid();
    if (focusId && $(focusId)) $(focusId).focus();
  }

  function bind() {
    $('matrixSelect').addEventListener('change', event => { state.matrix = event.target.value; refilter(); });
    $('chips').addEventListener('click', event => {
      const chip = event.target.closest('[data-rating]');
      if (!chip) return;
      const key = chip.dataset.rating;
      state.ratings.has(key) ? state.ratings.delete(key) : state.ratings.add(key);
      refilter();
      const again = document.querySelector(`.chip[data-rating="${CSS.escape(key)}"]`);
      if (again) again.focus();
    });
    $('onlyRed').addEventListener('click', () => { state.ratings = new Set(['niezaopiekowany']); refilter(); });
    $('allRatings').addEventListener('click', () => { state.ratings = new Set(ratingKeys); refilter(); });
    $('matrixGrid').addEventListener('click', event => {
      const tile = event.target.closest('.tile');
      if (!tile) return;
      if (state.queue) {
        const at = state.queue.findIndex(tp => tp.id === tile.dataset.id);
        if (at >= 0) { spotlight(at); return; }
        endDiscuss();
      }
      select(tile.dataset.id);
    });
    $('discuss').addEventListener('click', startDiscuss);
    $('spotPrev').addEventListener('click', () => spotlight(state.pos - 1));
    $('spotNext').addEventListener('click', () => spotlight(state.pos + 1));
    $('spotEnd').addEventListener('click', endDiscuss);
    $('closeDetails').addEventListener('click', () => state.queue ? endDiscuss() : closeDetails());
    document.addEventListener('keydown', event => {
      const inSelect = event.target.tagName === 'SELECT';
      if (event.key === 'Escape') {
        if (inSelect) return;
        if (state.queue) endDiscuss();
        else if (state.selected) closeDetails();
      } else if (state.queue && (event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !inSelect) {
        event.preventDefault();
        spotlight(state.pos + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
  }

  function init() {
    validate();
    ratingKeys = Object.keys(data.labels.rating);
    matrixKeys = Object.keys(data.labels.matrix);
    state.ratings = new Set(ratingKeys);
    data.touchpoints.forEach((tp, index) => { tpIndex.set(tp.id, tp); order.set(tp.id, data.processes.indexOf(tp.process) * 100000 + index); });
    $('demoPill').hidden = data.status !== 'DEMO';
    $('matrixSelect').innerHTML = `<option value="all">Obie macierze</option>` + matrixKeys.map(key => `<option value="${esc(key)}">${esc(matrixLabel(key))}</option>`).join('');
    renderChips();
    renderGrid();
    bind();
  }

  try { init(); } catch (error) { showError(error.message || String(error)); }
})();
