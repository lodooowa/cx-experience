(() => {
  'use strict';

  const mx = window.CX_MX;
  const { $, esc, data, marks, tpIndex } = mx;
  const { ratingLabel, matrixLabel } = mx;
  const state = { matrix: 'all', ratings: new Set(), selected: null, queue: null, pos: 0, subs: new Set() };
  const discussHint = $('discuss').title;
  let ratingKeys = [], matrixKeys = [];

  function inMatrix(tp) { return state.matrix === 'all' || tp.matrix === state.matrix; }
  function visible() { return data.touchpoints.filter(tp => inMatrix(tp) && state.ratings.has(tp.rating) && mx.passSub(tp, state.subs)); }

  function tileHtml(tp) {
    const bar = tp.emotionValue
      ? `<span class="emo-cap" aria-hidden="true">emocja</span><span class="emo-bar" role="img" title="Emocja klienta: ${tp.emotionValue} z 5" aria-label="Emocja klienta ${tp.emotionValue} z 5">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= tp.emotionValue ? 'on' : ''}"></i>`).join('')}</span>`
      : '<span class="emo-none">brak emocji</span>';
    const label = `${tp.title}. ${tp.process}. ${ratingLabel(tp.rating)}.`;
    return `<button type="button" class="tile rating-${esc(tp.rating)}" data-id="${esc(tp.id)}" title="${esc(label)}" aria-label="${esc(label)}">
      ${tp.subtype ? `<span class="tile-sub">${esc(data.labels.subtype[tp.subtype])}</span>` : ''}<span class="tile-title">${esc(tp.title)}</span>
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
    $('chips').innerHTML = mx.chipsHtml(state.ratings, pool);
    $('subs').innerHTML = mx.subChipsHtml(state.subs, pool);
    $('legend').innerHTML = ratingKeys.map(key => `<span>${esc(marks[key] || '')} ${esc(ratingLabel(key))}</span>`).join('') + '<span>Paski na kafelku: emocja klienta, skala 1–5, tylko gdy podana w danych</span>';
    refreshDiscussButton();
  }

  function buildQueue() {
    return mx.sortQueue(visible());
  }
  function refreshDiscussButton() {
    const empty = !buildQueue().length;
    $('discuss').disabled = empty && !state.queue;
    $('discuss').title = empty ? 'Brak punktów do omówienia w bieżących filtrach' : discussHint;
  }

  function renderDetails(tp) { $('detailBody').innerHTML = mx.detailsHtml(tp); }

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
    mx.bindToggle($('chips'), 'rating', state.ratings, refilter);
    mx.bindToggle($('subs'), 'sub', state.subs, refilter);
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
    mx.init();
    ratingKeys = mx.ratingKeys;
    matrixKeys = mx.matrixKeys;
    state.ratings = new Set(ratingKeys);
    state.subs = new Set(mx.subtypeKeys);
    $('matrixSelect').innerHTML = `<option value="all">Obie macierze</option>` + matrixKeys.map(key => `<option value="${esc(key)}">${esc(matrixLabel(key))}</option>`).join('');
    renderChips();
    renderGrid();
    bind();
  }

  try { init(); } catch (error) { mx.showError(error.message || String(error)); }
})();
