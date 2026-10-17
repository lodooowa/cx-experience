(() => {
  'use strict';

  // Mapa przepływu: tory, walidacja relacji i przypadków. Bez DOM. Zakłada, że dane macierzy przeszły walidację CX.mx.
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const fail = text => { throw Error('data/flow.js: ' + text); };

  // Tor punktu: jawne nadpisanie albo macierz/podtyp. Liczba i kolejność torów wynikają z danych.
  const laneOf = tp => tp.lane || (tp.subtype ? tp.matrix + '/' + tp.subtype : tp.matrix);

  function laneLabel(matrix, flow, tp) {
    const id = laneOf(tp);
    if (own(flow.labels.lane, id)) return flow.labels.lane[id];
    if (tp.lane) fail('tor "' + id + '" nie ma etykiety w labels.lane (' + tp.id + ')');
    return tp.subtype ? matrix.labels.subtype[tp.subtype] : matrix.labels.matrix[tp.matrix];
  }

  // Tory wymienione w labels.lane idą pierwsze (w tej kolejności), pozostałe wg pierwszego wystąpienia w danych.
  function lanes(matrix, flow) {
    const found = new Map();
    for (const tp of matrix.touchpoints) {
      const id = laneOf(tp);
      if (!found.has(id)) found.set(id, { id, label: laneLabel(matrix, flow, tp) });
    }
    const listed = Object.keys(flow.labels.lane).filter(id => found.has(id));
    return [...listed, ...[...found.keys()].filter(id => !listed.includes(id))].map(id => found.get(id));
  }

  function cycles(edges) {
    const next = new Map();
    for (const e of edges) (next.get(e.from) || next.set(e.from, []).get(e.from)).push(e.to);
    const state = new Map();
    const found = [];
    const stack = [];
    const visit = id => {
      state.set(id, 1);
      stack.push(id);
      for (const to of next.get(id) || []) {
        if (state.get(to) === 1) found.push(stack.slice(stack.indexOf(to)).concat(to));
        else if (!state.has(to)) visit(to);
      }
      stack.pop();
      state.set(id, 2);
    };
    for (const id of next.keys()) if (!state.has(id)) visit(id);
    return found;
  }

  // Błędy rzuca jako Error z nazwą pliku i ID; zwraca ostrzeżenia (cykle, kroki przypadku bez krawędzi w mapie).
  function validate(matrix, flow) {
    if (!flow || !Array.isArray(flow.edges) || !Array.isArray(flow.cases) || !flow.labels || !flow.labels.lane || !flow.labels.state) {
      fail('brak window.CX_FLOW z polami labels (lane, state), edges, cases.');
    }
    const ids = new Set(matrix.touchpoints.map(tp => tp.id));
    const edgeKeys = new Set();
    for (const e of flow.edges) {
      for (const key of ['from', 'to']) if (!ids.has(e[key])) fail('krawędź wskazuje nieistniejący punkt "' + e[key] + '"');
      if (e.from === e.to) fail('krawędź z punktu do niego samego (' + e.from + ')');
      const key = e.from + '>' + e.to;
      if (edgeKeys.has(key)) fail('powtórzona krawędź ' + e.from + ' → ' + e.to);
      edgeKeys.add(key);
    }
    lanes(matrix, flow);
    const caseIds = new Set();
    const warnings = [];
    for (const c of flow.cases) {
      if (!c.id || !c.name || caseIds.has(c.id)) fail('brak nazwy lub powtórzone ID przypadku: ' + c.id);
      caseIds.add(c.id);
      if (!Array.isArray(c.steps) || !c.steps.length) fail('przypadek ' + c.id + ' nie ma kroków');
      const numbers = new Set();
      c.steps.forEach((step, i) => {
        if (!Number.isInteger(step.n) || numbers.has(step.n)) fail('przypadek ' + c.id + ': brak lub powtórzone n kroku ' + step.n);
        numbers.add(step.n);
        if (i && step.n < c.steps[i - 1].n) fail('przypadek ' + c.id + ': kroki nie są uporządkowane wg n (' + step.n + ')');
        if (!ids.has(step.touchpointId)) fail('przypadek ' + c.id + ', krok ' + step.n + ': nieistniejący punkt "' + step.touchpointId + '"');
        if (!own(flow.labels.state, step.state)) fail('przypadek ' + c.id + ', krok ' + step.n + ': nieznany stan "' + step.state + '"');
        const prev = c.steps[i - 1];
        if (prev && prev.touchpointId !== step.touchpointId && !edgeKeys.has(prev.touchpointId + '>' + step.touchpointId)) {
          warnings.push('Przypadek ' + c.id + ': krok ' + prev.n + ' → ' + step.n + ' (' + prev.touchpointId + ' → ' + step.touchpointId + ') nie ma krawędzi w mapie.');
        }
      });
    }
    const loops = cycles(flow.edges);
    if (loops.length) warnings.push('Mapa ma ' + loops.length + ' pętli (krawędzie wstecz), np. ' + loops[0].join(' → ') + '.');
    return warnings;
  }

  window.CX = window.CX || {};
  window.CX.flowCore = { laneOf, lanes, validate };
})();
