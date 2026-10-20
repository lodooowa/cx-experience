(() => {
  'use strict';

  // Mapa przepływu z danych macierzy CX (data/cj.js lub data/cj-demo.js): ustawia window.CX_MATRIX i window.CX_FLOW w kształcie, który rozumieją
  // matrix-core.js i flow-*.js. Ładować przed matrix-core.js. Nie wymyśla ocen ani emocji: punkty mają ocenę "brak oceny".
  const hasProd = !!window.CX_CJ;
  const demo = new URLSearchParams(location.search).get('dane') === 'demo' || !hasProd;
  const cj = demo ? window.CX_CJ_DEMO : window.CX_CJ;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  if (!cj || !Array.isArray(cj.steps) || !Array.isArray(cj.touchpoints)) {
    window.CX_MATRIX = null;
    return;
  }

  const stepIndex = new Map(cj.steps.map((step, i) => [step.nr, i]));
  const processOf = step => step.nr + ' ' + step.name;
  const processes = cj.steps.map(processOf);
  // Kolejność punktów = kolejność kroków (układ mapy liczy "do przodu" po indeksie), w kroku wg wierszy macierzy.
  const sorted = cj.touchpoints.map((tp, i) => ({ tp, i })).sort((a, b) => stepIndex.get(a.tp.step) - stepIndex.get(b.tp.step) || a.i - b.i).map(item => item.tp);
  const laneOf = tp => tp.owner || tp.channel || 'Brak właściciela';
  const touchpoints = sorted.map(tp => ({
    id: tp.id, title: tp.title || tp.id, matrix: 'cj', process: processOf(cj.steps[stepIndex.get(tp.step)]), rating: 'brak_oceny', lane: laneOf(tp),
    channel: tp.channel, owner: tp.owner, coOwner: tp.coOwner, problem: tp.problem, recommendation: tp.recommendation
  }));
  const lane = {};
  touchpoints.forEach(tp => { lane[tp.lane] = tp.lane; });

  const flow = cj.flow;
  const all = flow ? flow.edges : [];
  const scenarios = flow ? flow.scenarios : [];
  const state = { scenario: '' };
  const visible = () => all.filter(e => !state.scenario || !e.scenarios.length || e.scenarios.includes(state.scenario)).map(e => ({ from: e.from, to: e.to, label: e.label || undefined, optional: e.optional }));

  const detailsHtml = tp => {
    const row = (name, value) => value ? `<p><b>${esc(name)}:</b> ${esc(value)}</p>` : '';
    const owners = [tp.owner, tp.coOwner].filter(Boolean).join(' / ');
    return `<div class="detail-kicker">${esc(tp.process)}</div><h2>${esc(tp.title)}</h2>`
      + `<section class="detail-section">${row('Kanał', tp.channel)}${row('Właściciel', owners)}${row('Zidentyfikowane problemy', tp.problem)}${row('Rekomendowany kierunek zmian', tp.recommendation)}</section>`;
  };

  window.CX_MATRIX = {
    status: demo ? 'DEMO' : '',
    processes, touchpoints, features: [], actions: [],
    labels: { matrix: { cj: 'Customer Journey' }, rating: { brak_oceny: 'Brak oceny' }, monitoring: {}, featureType: {}, actionKind: {} }
  };
  window.CX_FLOW = {
    status: demo ? 'DEMO' : '',
    labels: { lane, state: {} },
    edges: visible(), cases: [], detailsHtml,
    note: all.length ? '' : 'Brak połączeń: dodaj zakładkę „Przepływ” poleceniem python3 tools/add-flow-sheet.py (jeśli jej nie ma) i wypełnij ją przejściami między punktami.'
  };
  window.CX = window.CX || {};
  window.CX.cjFlow = {
    demo, scenarios,
    setScenario: name => { state.scenario = name; window.CX_FLOW.edges = visible(); }
  };
})();
