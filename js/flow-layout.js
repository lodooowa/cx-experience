(() => {
  'use strict';

  // Mapa przepływu (swimlane): układ węzłów i krawędzi w jednostkach SVG. Bez DOM i CSS, wynik deterministyczny.
  // Kolumna = proces (kolejność matrix.processes), pas = tor (CX_FLOW_CORE.lanes). Liczby torów, kolumn i krawędzi wynikają z danych.
  const DEFAULTS = {
    nodeW: 208,
    nodeH: 30,
    gapX: 72,      // odstęp poziomy między kartami sąsiednich kolumn (procesów)
    maxSub: 3,     // maksymalna liczba podkolumn w procesie (głębsze kroki układają się w ostatniej)
    subGap: 40,    // odstęp poziomy między podkolumnami w obrębie procesu
    gapY: 8,       // odstęp pionowy kart w jednej komórce (tor x proces)
    padY: 28,      // margines pionowy wewnątrz pasa (kanał dla tras powrotnych)
    padX: 24,      // margines po prawej stronie ostatniej kolumny
    labelW: 120,   // szerokość kolumny etykiet torów po lewej
    headerH: 44    // wysokość nagłówka kolumn (pasy zaczynają się od y = headerH)
  };

  const LEAD = 12; // prosty odcinek przed wejściem do karty
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
    const order = new Map(matrix.touchpoints.map((tp, i) => [tp.id, i]));

    // Podkolumny: kroki jednego procesu połączone krawędziami "do przodu" (wg kolejności danych) idą jeden za drugim
    // (głębokość = najdłuższa ścieżka), więc przejścia wewnątrz procesu biegną w prawo, a nie w pionie.
    const visibleIds = new Set(visible.map(tp => tp.id));
    const sub = new Map();
    for (const tp of visible.slice().sort((p, q) => order.get(p.id) - order.get(q.id))) sub.set(tp.id, 0);
    for (const tp of visible.slice().sort((p, q) => order.get(p.id) - order.get(q.id))) {
      for (const e of flow.edges) {
        if (e.to !== tp.id || !visibleIds.has(e.from)) continue;
        const from = matrix.touchpoints[order.get(e.from)];
        if (from.process === tp.process && order.get(e.from) < order.get(tp.id)) sub.set(tp.id, Math.min(o.maxSub - 1, Math.max(sub.get(tp.id), sub.get(e.from) + 1)));
      }
    }
    const subCount = processes.map(p => 1 + Math.max(0, ...visible.filter(tp => tp.process === p).map(tp => sub.get(tp.id))));
    const colWidth = i => subCount[i] * o.nodeW + (subCount[i] - 1) * o.subGap + o.gapX;
    let colX = o.labelW;
    const columns = processes.map((process, i) => { const col = { process, x: colX, w: colWidth(i) }; colX += col.w; return col; });

    // Komórki (tor x proces x podkolumna): stos pionowy w kolejności z matrix.touchpoints.
    const cells = new Map();
    for (const tp of visible) {
      const key = laneIndex.get(core.laneOf(tp)) + '|' + colIndex.get(tp.process) + '|' + sub.get(tp.id);
      (cells.get(key) || cells.set(key, []).get(key)).push(tp);
    }
    const stackH = n => n * o.nodeH + (n - 1) * o.gapY;
    const lanes = [];
    let y = o.headerH;
    laneList.forEach((l, li) => {
      let most = 1;
      for (const [key, list] of cells) if (Number(key.split('|')[0]) === li) most = Math.max(most, list.length);
      const h = stackH(most) + 2 * o.padY;
      lanes.push({ id: l.id, label: l.label, y, h });
      y += h;
    });

    const nodes = [];
    const byId = new Map();
    for (const [key, list] of cells) {
      const [li, ci, si] = key.split('|').map(Number);
      const lane = lanes[li];
      // Stos wyśrodkowany w pasie.
      const top = lane.y + (lane.h - stackH(list.length)) / 2;
      list.forEach((tp, i) => {
        const n = { id: tp.id, x: columns[ci].x + o.gapX / 2 + si * (o.nodeW + o.subGap), y: top + i * (o.nodeH + o.gapY), w: o.nodeW, h: o.nodeH, lane: lanes[li].id, col: ci, sub: si };
        nodes.push(n);
        byId.set(tp.id, n);
      });
    }
    // Kolejność wyniku: po kolumnach, potem po torach, potem wg danych.
    nodes.sort((a, b) => a.col - b.col || laneIndex.get(a.lane) - laneIndex.get(b.lane) || order.get(a.id) - order.get(b.id));

    const edges = [];
    const routed = [];
    for (const e of flow.edges) {
      const s = byId.get(e.from);
      const t = byId.get(e.to);
      if (!s || !t) continue;
      const out = { from: e.from, to: e.to, optional: !!e.optional, backward: t.col < s.col || (t.col === s.col && t.sub < s.sub) };
      if (e.label) out.label = e.label;
      if (t.col > s.col || (t.col === s.col && t.sub > s.sub)) {
        // w przód: z prawego boku źródła do lewego boku celu
        // ostatnie LEAD jednostek poziomo, żeby grot strzałki leżał prosto
        const a = [s.x + s.w, s.y + s.h / 2];
        const end = [t.x, t.y + t.h / 2];
        const b = [end[0] - LEAD, end[1]];
        const k = Math.max(16, (b[0] - a[0]) / 2);
        const c1 = [a[0] + k, a[1]];
        const c2 = [b[0] - k, b[1]];
        out.d = cubic(a, c1, c2, b) + ' L' + pt(end[0], end[1]);
        if (e.label) { out.labelX = r(mid(a, c1, c2, b, 0)); out.labelY = r(mid(a, c1, c2, b, 1)); }
      } else if (t.col === s.col && t.sub === s.sub && Math.abs(t.y - s.y) <= o.nodeH + o.gapY + 1) {
        // sąsiednie karty w jednej komórce: krótki pionowy łącznik
        const down = t.y >= s.y;
        const a = [s.x + s.w / 2, down ? s.y + s.h : s.y];
        const b = [t.x + t.w / 2, down ? t.y : t.y + t.h];
        out.d = 'M' + pt(a[0], a[1]) + ' L' + pt(b[0], b[1]);
        const c1 = a, c2 = b;
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
    const half = Math.min(o.gapX, o.subGap) / 2 - 8;
    // Przesunięcie w korytarzu zależy od węzła (nie od krawędzi): trasy do tego samego celu (lub z tego samego źródła) łączą się w jedną linię.
    const spread = (list, key, nodeOf) => {
      const groups = new Map();
      for (const item of list) {
        const nodeIds = groups.get(item[key]) || groups.set(item[key], []).get(item[key]);
        if (!nodeIds.includes(nodeOf(item).id)) nodeIds.push(nodeOf(item).id);
      }
      for (const item of list) {
        const nodeIds = groups.get(item[key]);
        item[key + 'Off'] = Math.max(-half, Math.min(half, (nodeIds.indexOf(nodeOf(item).id) - (nodeIds.length - 1) / 2) * STEP));
      }
    };
    for (const item of routed) {
      item.leave = 'r' + item.s.col + '.' + item.s.sub;  // korytarz za kartą źródła
      item.enter = 'l' + item.t.col + '.' + item.t.sub;  // korytarz przed kartą celu
      item.gapL = (item.s.sub === subCount[item.s.col] - 1 ? o.gapX : o.subGap) / 2;
      item.gapE = (item.t.sub === 0 ? o.gapX : o.subGap) / 2;
      item.laneTop = Math.min(laneIndex.get(item.s.lane), laneIndex.get(item.t.lane));
    }
    spread(routed, 'leave', item => item.s);
    spread(routed, 'enter', item => item.t);
    const tracks = new Map();
    const usedUntil = new Map();
    const bySpan = routed.slice().sort((p, q) => Math.min(p.t.x, p.s.x + p.s.w) - Math.min(q.t.x, q.s.x + q.s.w));
    for (const item of bySpan) {
      const x1 = item.t.x - item.gapE + item.enterOff;
      const x2 = item.s.x + item.s.w + item.gapL + item.leaveOff;
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
      const xl = item.s.x + item.s.w + item.gapL + item.leaveOff;
      const xe = item.t.x - item.gapE + item.enterOff;
      const pts = [[s.x + s.w, s.y + s.h / 2], [xl, s.y + s.h / 2], [xl, yTrack], [xe, yTrack], [xe, t.y + t.h / 2], [t.x, t.y + t.h / 2]];
      out.d = rounded(pts, 5);
      if (out.label) { out.labelX = r((xl + xe) / 2); out.labelY = r(yTrack - 2); }
    }

    return { width: r(colX + o.padX), height: r(y), lanes, columns, nodes, edges };
  }

  window.CX_FLOW_LAYOUT = { compute, DEFAULTS };
})();
