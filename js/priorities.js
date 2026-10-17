(() => {
  'use strict';

  const mx = window.CX.mx;
  const { $, esc, data, marks, levels, tpIndex } = mx;
  const state = { matrix: 'all', ratings: new Set(mx.queueRatings), kinds: new Set(), subs: new Set(), plan: new Set(), selected: null };
  const rows = ['wysoki', 'średni', 'niski'];
  const cols = ['niski', 'średni', 'wysoki'];
  const horizon = [4, 12, 26, 52];
  let kindKeys = [];

  const tpOf = action => tpIndex.get(action.touchpointId);
  const visible = () => data.actions.filter(a => {
    const tp = tpOf(a);
    return (state.matrix === 'all' || tp.matrix === state.matrix) && state.ratings.has(tp.rating) && state.kinds.has(a.kind) && mx.passSub(tp, state.subs);
  });
  const ringTag = tp => esc(mx.ringOf(tp).label.slice(0, 3).toUpperCase());
  const risk = value => `<span class="risk lvl-${levels.indexOf(value) + 1}" role="img" aria-label="ryzyko: ${esc(value)}"><i></i><i></i><i></i></span>`;

  function actionHtml(a) {
    const tp = tpOf(a);
    const inPlan = state.plan.has(a.id);
    const label = `${tp.title}: ${a.text}. Koszt ${a.cost}, zysk ${a.gain}, ryzyko ${a.risk}, około ${a.weeks} tygodni.`;
    return `<div class="act rating-${esc(tp.rating)} kind-${esc(a.kind)}${inPlan ? ' in-plan' : ''}${tp.id === state.selected ? ' is-selected' : ''}" data-aid="${esc(a.id)}">
      <button type="button" class="act-open" data-open="${esc(tp.id)}" aria-label="${esc(label + ' Pokaż szczegóły.')}" title="${esc(label)}">
        <span class="act-tp"><i class="mark" aria-hidden="true">${esc(marks[tp.rating] || '')}</i><b>${esc(tp.title)}</b><em title="${esc(mx.matrixLabel(tp.matrix) + (tp.subtype ? ', ' + data.labels.subtype[tp.subtype] : ''))}">${ringTag(tp)}</em></span>
        <span class="act-text">${esc(a.text)}</span>
        <span class="act-meta"><span>ok. ${esc(a.weeks)} tyg.</span>${risk(a.risk)}<span class="act-kind">${esc(data.labels.actionKind[a.kind])}</span></span>
      </button>
      <button type="button" class="act-add" data-add="${esc(a.id)}" aria-pressed="${inPlan}" aria-label="Lista robocza: ${esc(tp.title)}, ${esc(a.text)}" title="${inPlan ? 'Usuń z listy roboczej' : 'Dodaj do listy roboczej'}">${inPlan ? '✓' : '+'}</button></div>`;
  }

  function renderBoard() {
    const list = visible().sort((a, b) => mx.queueRatings.concat('ok', 'brak_oceny').indexOf(tpOf(a).rating) - mx.queueRatings.concat('ok', 'brak_oceny').indexOf(tpOf(b).rating) || a.weeks - b.weeks);
    let html = `<div class="axis-corner"></div>${cols.map(c => `<div class="axis axis-x">Koszt: ${esc(c)}</div>`).join('')}`;
    for (const gain of rows) {
      html += `<div class="axis axis-y">Zysk: ${esc(gain)}</div>`;
      for (const cost of cols) {
        const items = list.filter(a => a.gain === gain && a.cost === cost);
        const start = gain === 'wysoki' && cost === 'niski';
        html += `<div class="prio-cell${start ? ' is-start' : ''}" data-cost="${esc(cost)}"><span class="cell-count">${items.length ? items.length : ''}</span>${start ? '<span class="cell-flag">Dobre miejsce na start</span>' : ''}${items.map(actionHtml).join('')}</div>`;
      }
    }
    $('board').innerHTML = html;
    $('prioHelp').textContent = `${list.length} akcji naprawczych dla wybranych punktów. Lewy górny róg to niski koszt i wysoki zysk. Plus dodaje akcję do listy roboczej, a kliknięcie karty pokazuje punkt styku.`;
  }

  function renderChips() {
    const pool = data.actions.map(tpOf).filter(tp => state.matrix === 'all' || tp.matrix === state.matrix);
    $('chips').innerHTML = mx.chipsHtml(state.ratings, pool);
    $('subs').innerHTML = mx.subChipsHtml(state.subs, pool);
    $('kinds').innerHTML = kindKeys.map(key => `<button type="button" class="chip" data-kind="${esc(key)}" aria-pressed="${state.kinds.has(key)}">${esc(data.labels.actionKind[key])} <b>${data.actions.filter(a => a.kind === key && state.ratings.has(tpOf(a).rating) && (state.matrix === 'all' || tpOf(a).matrix === state.matrix)).length}</b></button>`).join('');
  }

  const scale = weeks => Math.sqrt(weeks / mx.maxWeeks) * 100;

  function renderPlan() {
    const items = data.actions.filter(a => state.plan.has(a.id)).sort((a, b) => a.weeks - b.weeks);
    const byMatrix = mx.matrixKeys.map(key => ({ key, n: items.filter(a => tpOf(a).matrix === key).length })).filter(m => m.n);
    $('planSummary').textContent = items.length
      ? `${items.length} akcji · najdłuższa ok. ${items[items.length - 1].weeks} tyg. · ${byMatrix.map(m => `${mx.matrixLabel(m.key)}: ${m.n}`).join(', ')}`
      : 'Lista jest pusta.';
    $('planClear').disabled = !items.length;
    if (!items.length) {
      $('planBody').innerHTML = '<p class="plan-empty">Dodaj akcje plusem na mapie powyżej. Lista nie jest zapisywana: wnioski spisz w osobnym pliku.</p>';
      return;
    }
    const ticks = horizon.filter(t => t <= mx.maxWeeks).map(t => `<span style="left:${scale(t)}%">${t} tyg.</span>`).join('');
    $('planBody').innerHTML = `<div class="plan-axis"><span></span><div class="plan-ticks">${ticks}</div><span></span></div>` + items.map(a => {
      const tp = tpOf(a);
      return `<div class="plan-row rating-${esc(tp.rating)}"><button type="button" class="plan-name" data-open="${esc(tp.id)}"><b>${esc(tp.title)}</b><small>${esc(a.text)}</small></button>
        <div class="plan-track"><i style="width:${Math.max(2, scale(a.weeks)).toFixed(1)}%"></i><span>ok. ${esc(a.weeks)} tyg.</span></div>
        <button type="button" class="plan-remove" data-add="${esc(a.id)}" aria-label="Usuń z listy: ${esc(tp.title)}">×</button></div>`;
    }).join('') + '<p class="plan-note">Słupek pokazuje szacowany czas do wdrożenia każdej akcji, liczony od startu. To nie jest harmonogram. Skala słupków jest pierwiastkowa.</p>';
  }

  function syncSelected() {
    document.querySelectorAll('.act').forEach(el => el.classList.toggle('is-selected', !!state.selected && el.querySelector('.act-open').dataset.open === state.selected));
  }

  function select(id) {
    state.selected = id;
    $('detailBody').innerHTML = mx.detailsHtml(tpIndex.get(id));
    $('detailDrawer').hidden = false;
    $('workspace').classList.add('has-drawer');
    syncSelected();
  }

  function closeDetails() {
    const card = document.querySelector('.act.is-selected .act-open');
    state.selected = null;
    $('detailDrawer').hidden = true;
    $('workspace').classList.remove('has-drawer');
    syncSelected();
    if (card) card.focus({ preventScroll: true });
  }

  function refilter() {
    const focus = document.activeElement && document.activeElement.id;
    renderChips();
    renderBoard();
    if (state.selected && !visible().some(a => a.touchpointId === state.selected)) closeDetails();
    if (focus && $(focus)) $(focus).focus();
  }

  function toggle(set, key) { set.has(key) ? set.delete(key) : set.add(key); }

  function bind() {
    $('matrixSelect').addEventListener('change', event => { state.matrix = event.target.value; refilter(); });
    mx.bindToggle($('chips'), 'rating', state.ratings, refilter);
    mx.bindToggle($('subs'), 'sub', state.subs, refilter);
    mx.bindToggle($('kinds'), 'kind', state.kinds, refilter);
    document.addEventListener('click', event => {
      const add = event.target.closest('[data-add]');
      if (add) {
        const id = add.dataset.add;
        toggle(state.plan, id);
        renderBoard();
        renderPlan();
        const again = document.querySelector(`.act-add[data-add="${CSS.escape(id)}"]`) || document.querySelector('.plan-remove') || document.querySelector('.chip');
        if (again) again.focus();
        return;
      }
      const open = event.target.closest('[data-open]');
      if (open) select(open.dataset.open);
    });
    $('planClear').addEventListener('click', () => { state.plan.clear(); renderBoard(); renderPlan(); });
    $('closeDetails').addEventListener('click', closeDetails);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state.selected && event.target.tagName !== 'SELECT') closeDetails();
    });
  }

  function init() {
    mx.init();
    kindKeys = Object.keys(data.labels.actionKind);
    state.kinds = new Set(kindKeys);
    state.subs = new Set(mx.subtypeKeys);
    $('matrixSelect').innerHTML = `<option value="all">Obie macierze</option>` + mx.matrixKeys.map(key => `<option value="${esc(key)}">${esc(mx.matrixLabel(key))}</option>`).join('');
    $('legend').innerHTML = mx.rings.map(ring => `<span>${esc(ring.label.slice(0, 3).toUpperCase())} = ${esc(ring.label)}</span>`).join('') + '<span>Liczby przy filtrach: akcje naprawcze</span><span>Kolor karty: ocena CX punktu</span><span>Trzy kreski: ryzyko wdrożenia</span><span>Koszt, zysk, ryzyko i czas to szacunki' + (data.status === 'DEMO' ? ' (DEMO)' : '') + '</span>';
    renderChips();
    renderBoard();
    renderPlan();
    bind();
  }

  try { init(); } catch (error) { mx.showError(error.message || String(error)); }
})();
