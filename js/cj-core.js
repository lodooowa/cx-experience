(() => {
  'use strict';

  // Widok Customer Journey: walidacja, serie emocji i powiązania pain point → root cause → inicjatywa. Bez DOM.
  // Seria "now" to emocje ze źródła, serie qw/mid/long to prognoza z kolumn prognozy zakładki Macierz CX; brak wartości = przerwa (null), nic nie jest dopełniane.
  const fail = text => { throw Error('data/cj.js: ' + text); };
  const HORIZONS = [{ key: 'now', label: 'Obecnie' }, { key: 'qw', label: 'Po Quick Wins' }, { key: 'mid', label: 'Po Mid Term' }, { key: 'long', label: 'Po Long Term' }];
  const isLevel = v => v === null || (typeof v === 'number' && v >= -5 && v <= 5);

  function validate(cj) {
    if (!cj || !['stages', 'steps', 'touchpoints', 'painPoints', 'rootCauses', 'initiatives', 'painRoot', 'rootInitiative'].every(k => Array.isArray(cj[k]))) {
      fail('brak window.CX_CJ z polami stages, steps, touchpoints, painPoints, rootCauses, initiatives, painRoot, rootInitiative.');
    }
    const ids = (list, what) => {
      const set = new Set();
      for (const item of list) {
        if (!item.id || set.has(item.id)) fail('brak lub powtórzone ID (' + what + '): ' + item.id);
        set.add(item.id);
      }
      return set;
    };
    const pp = ids(cj.painPoints, 'pain point'), rc = ids(cj.rootCauses, 'root cause'), inits = ids(cj.initiatives, 'inicjatywa'), tp = ids(cj.touchpoints, 'punkt styku');
    const steps = new Set(cj.steps.map(s => s.nr));
    for (const t of cj.touchpoints) {
      if (!steps.has(t.step)) fail('punkt ' + t.id + ' wskazuje nieistniejący krok ' + t.step);
      if (t.painPoint && !pp.has(t.painPoint)) fail('punkt ' + t.id + ' wskazuje nieistniejący pain point ' + t.painPoint);
      if (t.initiative && !inits.has(t.initiative)) fail('punkt ' + t.id + ' wskazuje nieistniejącą inicjatywę ' + t.initiative);
      if (t.rootCause && !rc.has(t.rootCause)) fail('punkt ' + t.id + ' wskazuje nieistniejący root cause ' + t.rootCause);
      if (!isLevel(t.emotionValue)) fail('emocja poza zakresem -5..+5 (' + t.id + ')');
      for (const key of ['qw', 'mid', 'long']) if (t.forecast && !isLevel(t.forecast[key])) fail('prognoza ' + key + ' poza zakresem -5..+5 (' + t.id + ')');
    }
    for (const [a, b] of cj.painRoot) if (!pp.has(a) || !rc.has(b)) fail('painRoot wskazuje nieistniejące ' + a + ' / ' + b);
    for (const [a, b] of cj.rootInitiative) if (!rc.has(a) || !inits.has(b)) fail('rootInitiative wskazuje nieistniejące ' + a + ' / ' + b);
    return { pp, rc, inits, tp };
  }

  // Punkty w kolejności kroków z zakładki Dane (stabilnie wewnątrz kroku).
  function model(cj) {
    const order = new Map(cj.steps.map((s, i) => [s.nr, i]));
    const points = cj.touchpoints.map((t, i) => ({ t, i })).sort((a, b) => order.get(a.t.step) - order.get(b.t.step) || a.i - b.i).map(({ t }) => t);
    const series = {};
    for (const h of HORIZONS) series[h.key] = points.map(t => h.key === 'now' ? t.emotionValue : t.forecast ? t.forecast[h.key] : null);
    const hasForecast = key => series[key].some(v => v !== null);
    return { points, series, hasForecast };
  }

  // Zbiory powiązane z zaznaczeniem {kind: 'pp'|'rc'|'in'|'tp', id}. Punkty łączy kolumna Pain Point ID / Dominating Root Cause ID.
  function related(cj, sel) {
    const out = { pp: new Set(), rc: new Set(), in: new Set(), tp: new Set() };
    if (!sel) return out;
    const rcOfPp = id => cj.painRoot.filter(p => p[0] === id).map(p => p[1]);
    const ppOfRc = id => cj.painRoot.filter(p => p[1] === id).map(p => p[0]);
    const inOfRc = id => cj.rootInitiative.filter(p => p[0] === id).map(p => p[1]);
    const rcOfIn = id => cj.rootInitiative.filter(p => p[1] === id).map(p => p[0]);
    const add = (set, values) => values.forEach(v => v && set.add(v));
    if (sel.kind === 'pp') {
      out.pp.add(sel.id); add(out.rc, rcOfPp(sel.id)); out.rc.forEach(rc => add(out.in, inOfRc(rc)));
      cj.touchpoints.filter(t => t.painPoint === sel.id).forEach(t => out.tp.add(t.id));
    } else if (sel.kind === 'rc') {
      out.rc.add(sel.id); add(out.pp, ppOfRc(sel.id)); add(out.in, inOfRc(sel.id));
      cj.touchpoints.filter(t => t.rootCause === sel.id).forEach(t => out.tp.add(t.id));
    } else if (sel.kind === 'in') {
      out.in.add(sel.id); add(out.rc, rcOfIn(sel.id));
      const init = cj.initiatives.find(i => i.id === sel.id);
      if (init) { out.pp.add(init.painPoint); out.rc.add(init.rootCause); }
      // Jawne powiązanie punktów z inicjatywą (kolumna Initiative ID) ma pierwszeństwo; bez niego punkty łączy root cause.
      const linked = cj.touchpoints.filter(t => t.initiative === sel.id);
      if (linked.length) linked.forEach(t => out.tp.add(t.id));
      else out.rc.forEach(rc => cj.touchpoints.filter(t => t.rootCause === rc).forEach(t => out.tp.add(t.id)));
    } else {
      const t = cj.touchpoints.find(x => x.id === sel.id);
      if (t) { out.tp.add(t.id); add(out.pp, [t.painPoint]); add(out.rc, [t.rootCause]); if (t.initiative) out.in.add(t.initiative); else out.rc.forEach(rc => add(out.in, inOfRc(rc))); }
    }
    return out;
  }

  window.CX = window.CX || {};
  window.CX.cjCore = { HORIZONS, validate, model, related };
})();
