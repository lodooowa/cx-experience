(() => {
  'use strict';

  // Mapa przepływu (swimlane): układ węzłów i krawędzi w jednostkach SVG. Bez DOM i CSS, wynik deterministyczny.
  // Kolumna = proces (kolejność matrix.processes), pas = tor (CX_FLOW_CORE.lanes). Liczby torów, kolumn i krawędzi wynikają z danych.
  const DEFAULTS = {
    nodeW: 208,
    nodeH: 30,
    gapX: 72,      // odstęp poziomy między kartami sąsiednich kolumn
    gapY: 8,       // odstęp pionowy kart w jednej komórce (tor x proces)
    padY: 28,      // margines pionowy wewnątrz pasa (kanał dla tras powrotnych)
    padX: 24,      // margines po prawej stronie ostatniej kolumny
    labelW: 120,   // szerokość kolumny etykiet torów po lewej
    headerH: 44    // wysokość nagłówka kolumn (pasy zaczynają się od y = headerH)
  };

  const r = n => Math.round(n * 100) / 100;
  const pt = (x, y) => r(x) + ' ' + r(y);
  const cubic = (a, c1, c2, b) => 'M' + pt(a[0], a[1]) + ' C' + pt(c1[0], c1[1]) + ', ' + pt(c2[0], c2[1]) + ', ' + pt(b[0], b[1]);
  // Łamana z zaokrąglonymi narożnikami (promień ograniczony długością odcinków).
  const rounded = (pts, rad) => {
    let d = 'M' + pt(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]];
      const lenIn = Math.hypot(c[0] - p[0], c[1] - p[1]), lenOut = Math.hypot(n[0] - c[0], n[1] - c[1]);
      const k = Math.min(rad, lenIn / 2, lenOut / 2);
      const from = [c[0] + (p[0] - c[0]) * k / (lenIn || 1), c[1] + (p[1] - c[1]) * k / (lenIn || 1)];
      const to = [c[0] + (n[0] - c[0]) * k / (lenOut || 1), c[1] + (n[1] - c[1]) * k / (lenOut || 1)];
      d += ' L' + pt(from[0], from[1]) + ' Q' + pt(c[0], c[1]) + ' ' + pt(to[0], to[1]);
    }
    return d + ' L' + pt(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  };
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
    const routed = [];
    for (const e of flow.edges) {
      const s = byId.get(e.from);
      const t = byId.get(e.to);
      if (!s || !t) continue;
      const out = { from: e.from, to: e.to, optional: !!e.optional, backward: t.col < s.col };
      if (e.label) out.label = e.label;
      if (t.col > s.col) {
        // w przód: z prawego boku źródła do lewego boku celu
        const a = [s.x + s.w, s.y + s.h / 2];
        const b = [t.x, t.y + t.h / 2];
        const k = Math.max(24, (b[0] - a[0]) / 2);
        const c1 = [a[0] + k, a[1]];
        const c2 = [b[0] - k, b[1]];
        out.d = cubic(a, c1, c2, b);
        if (e.label) { out.labelX = r(mid(a, c1, c2, b, 0)); out.labelY = r(mid(a, c1, c2, b, 1)); }
      } else if (t.col === s.col && Math.abs(t.y - s.y) <= o.nodeH + o.gapY + 1) {
        // sąsiednie karty w jednej komórce: krótki pionowy łącznik
        const down = t.y >= s.y;
        const a = [s.x + s.w / 2, down ? s.y + s.h : s.y];
        const b = [t.x + t.w / 2, down ? t.y : t.y + t.h];
        const k = Math.max(12, Math.abs(b[1] - a[1]) / 2);
        const c1 = [a[0], a[1] + (down ? k : -k)];
        const c2 = [b[0], b[1] + (down ? -k : k)];
        out.d = cubic(a, c1, c2, b);
        if (e.label) { out.labelX = r(mid(a, c1, c2, b, 0)); out.labelY = r(mid(a, c1, c2, b, 1)); }
      } else {
        // powrót lub odległa karta w tej samej kolumnie: wyjście z prawej, wejście z lewej, trasa prostokątna
        routed.push({ out, s, t });
      }
      edges.push(out);
    }

    // Trasy prostokątne: pion w korytarzach między kolumnami, poziom w kanale u góry wyższego z dwóch torów.
    // Pasma kanałów i przesunięcia w korytarzach przydzielane zachłannie, żeby trasy się nie nakładały.
    const STEP = 3.5;
    const half = o.gapX / 2 - 8;
    const spread = (list, key) => {
      const groups = new Map();
      for (const item of list) (groups.get(item[key]) || groups.set(item[key], []).get(item[key])).push(item);
      for (const group of groups.values()) group.forEach((item, i) => { item[key + 'Off'] = Math.max(-half, Math.min(half, (i - (group.length - 1) / 2) * STEP)); });
    };
    for (const item of routed) {
      item.leave = 'r' + item.s.col;                   // korytarz za kolumną źródła
      item.enter = 'l' + item.t.col;                   // korytarz przed kolumną celu
      item.laneTop = Math.min(laneIndex.get(item.s.lane), laneIndex.get(item.t.lane));
    }
    spread(routed, 'leave');
    spread(routed, 'enter');
    const tracks = new Map();
    const usedUntil = new Map();
    const bySpan = routed.slice().sort((p, q) => Math.min(p.t.x, p.s.x + p.s.w) - Math.min(q.t.x, q.s.x + q.s.w));
    for (const item of bySpan) {
      const x1 = item.t.x - o.gapX / 2 + item.enterOff;
      const x2 = item.s.x + item.s.w + o.gapX / 2 + item.leaveOff;
      const ends = usedUntil.get(item.laneTop) || usedUntil.set(item.laneTop, []).get(item.laneTop);
      let k = ends.findIndex(end => end < Math.min(x1, x2) - 6);
      if (k < 0) k = ends.length;
      ends[k] = Math.max(x1, x2);
      item.track = k;
    }
    const maxTrack = Math.floor((o.padY - 6) / STEP);
    for (const item of routed) {
      const { out, s, t } = item;
      const yTrack = lanes[item.laneTop].y + 3 + Math.min(item.track, maxTrack) * STEP;
      const xl = item.s.x + item.s.w + o.gapX / 2 + item.leaveOff;
      const xe = item.t.x - o.gapX / 2 + item.enterOff;
      const pts = [[s.x + s.w, s.y + s.h / 2], [xl, s.y + s.h / 2], [xl, yTrack], [xe, yTrack], [xe, t.y + t.h / 2], [t.x, t.y + t.h / 2]];
      out.d = rounded(pts, 5);
      if (out.label) { out.labelX = r((xl + xe) / 2); out.labelY = r(yTrack - 2); }
    }

    return { width: r(o.labelW + processes.length * colW + o.padX), height: r(y), lanes, columns, nodes, edges };
  }

  window.CX_FLOW_LAYOUT = { compute, DEFAULTS };
})();
