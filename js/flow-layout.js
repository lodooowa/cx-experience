(() => {
  'use strict';

  // Mapa przepływu (swimlane): układ węzłów i krawędzi w jednostkach SVG. Bez DOM i CSS, wynik deterministyczny.
  // Kolumna = proces (kolejność matrix.processes), pas = tor (CX_FLOW_CORE.lanes). Liczby torów, kolumn i krawędzi wynikają z danych.
  const DEFAULTS = {
    nodeW: 208,
    nodeH: 30,
    gapX: 72,      // odstęp poziomy między kartami sąsiednich kolumn
    gapY: 8,       // odstęp pionowy kart w jednej komórce (tor x proces)
    padY: 32,      // margines pionowy wewnątrz pasa (miejsce na łuki wstecz)
    padX: 24,      // margines po prawej stronie ostatniej kolumny
    labelW: 120,   // szerokość kolumny etykiet torów po lewej
    headerH: 44,   // wysokość nagłówka kolumn (pasy zaczynają się od y = headerH)
    arcBase: 18,   // minimalne wzniesienie łuku wstecz nad węzłem
    arcPerCol: 12, // dodatkowe wzniesienie na każdą kolumnę rozpiętości
    arcMax: 64     // limit wzniesienia łuku
  };

  const r = n => Math.round(n * 100) / 100;
  const pt = (x, y) => r(x) + ' ' + r(y);
  const cubic = (a, c1, c2, b) => 'M' + pt(a[0], a[1]) + ' C' + pt(c1[0], c1[1]) + ', ' + pt(c2[0], c2[1]) + ', ' + pt(b[0], b[1]);
  const mid = (a, c1, c2, b, i) => (a[i] + 3 * c1[i] + 3 * c2[i] + b[i]) / 8; // punkt krzywej Béziera dla t = 0.5

  function compute(matrix, flow, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const core = window.CX_FLOW_CORE;
    const allLanes = core.lanes(matrix, flow);
    let laneList = allLanes;
    if (Array.isArray(o.lanes)) {
      const picked = allLanes.filter(l => o.lanes.includes(l.id));
      if (picked.length) laneList = picked;
    }
    const laneIndex = new Map(laneList.map((l, i) => [l.id, i]));
    const visible = matrix.touchpoints.filter(tp => laneIndex.has(core.laneOf(tp)));

    // Kolumny: tylko procesy z widocznym węzłem, w kolejności matrix.processes.
    const used = new Set(visible.map(tp => tp.process));
    const processes = matrix.processes.filter(p => used.has(p));
    const colIndex = new Map(processes.map((p, i) => [p, i]));
    const colW = o.nodeW + o.gapX;
    const columns = processes.map((process, i) => ({ process, x: o.labelW + i * colW, w: colW }));

    // Komórki (tor x proces): stos pionowy w kolejności z matrix.touchpoints.
    const cells = new Map();
    for (const tp of visible) {
      const key = laneIndex.get(core.laneOf(tp)) + '|' + colIndex.get(tp.process);
      (cells.get(key) || cells.set(key, []).get(key)).push(tp);
    }
    const stackH = n => n * o.nodeH + (n - 1) * o.gapY;
    const lanes = [];
    let y = o.headerH;
    laneList.forEach((l, li) => {
      let most = 1;
      for (let ci = 0; ci < processes.length; ci++) most = Math.max(most, (cells.get(li + '|' + ci) || []).length);
      const h = stackH(most) + 2 * o.padY;
      lanes.push({ id: l.id, label: l.label, y, h });
      y += h;
    });

    const nodes = [];
    const byId = new Map();
    for (const [key, list] of cells) {
      const [li, ci] = key.split('|').map(Number);
      const lane = lanes[li];
      // Stos wyśrodkowany w pasie.
      const top = lane.y + (lane.h - stackH(list.length)) / 2;
      list.forEach((tp, i) => {
        const n = { id: tp.id, x: columns[ci].x + o.gapX / 2, y: top + i * (o.nodeH + o.gapY), w: o.nodeW, h: o.nodeH, lane: lanes[li].id, col: ci };
        nodes.push(n);
        byId.set(tp.id, n);
      });
    }
    // Kolejność wyniku: po kolumnach, potem po torach, potem wg danych.
    const order = new Map(matrix.touchpoints.map((tp, i) => [tp.id, i]));
    nodes.sort((a, b) => a.col - b.col || laneIndex.get(a.lane) - laneIndex.get(b.lane) || order.get(a.id) - order.get(b.id));

    const edges = [];
    for (const e of flow.edges) {
      const s = byId.get(e.from);
      const t = byId.get(e.to);
      if (!s || !t) continue;
      const out = { from: e.from, to: e.to, optional: !!e.optional, backward: t.col < s.col };
      if (e.label) out.label = e.label;
      let a, c1, c2, b;
      if (t.col > s.col) {
        a = [s.x + s.w, s.y + s.h / 2];
        b = [t.x, t.y + t.h / 2];
        const k = Math.max(24, (b[0] - a[0]) / 2);
        c1 = [a[0] + k, a[1]];
        c2 = [b[0] - k, b[1]];
      } else if (t.col === s.col) {
        const down = t.y >= s.y;
        a = [s.x + s.w / 2, down ? s.y + s.h : s.y];
        b = [t.x + t.w / 2, down ? t.y : t.y + t.h];
        const k = Math.max(12, Math.abs(b[1] - a[1]) / 2);
        c1 = [a[0], a[1] + (down ? k : -k)];
        c2 = [b[0], b[1] + (down ? -k : k)];
      } else {
        const lift = Math.min(o.arcMax, o.arcBase + o.arcPerCol * (s.col - t.col));
        const peak = Math.max(2, Math.min(s.y, t.y) - lift);
        a = [s.x + s.w / 2, s.y];
        b = [t.x + t.w / 2, t.y];
        c1 = [a[0], peak];
        c2 = [b[0], peak];
      }
      out.d = cubic(a, c1, c2, b);
      if (e.label) {
        out.labelX = r(mid(a, c1, c2, b, 0));
        out.labelY = r(mid(a, c1, c2, b, 1));
      }
      edges.push(out);
    }

    return { width: r(o.labelW + processes.length * colW + o.padX), height: r(y), lanes, columns, nodes, edges };
  }

  window.CX_FLOW_LAYOUT = { compute, DEFAULTS };
})();
