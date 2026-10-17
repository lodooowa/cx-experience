// Test js/flow-layout.js na data/matrix.js i data/flow.js. Uruchom: node tools/test-flow-layout.js (bez zależności).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/matrix.js', 'data/flow.js', 'js/flow-core.js', 'js/flow-layout.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const { CX_MATRIX: matrix, CX_FLOW: flow, CX_FLOW_CORE: core, CX_FLOW_LAYOUT: layout } = sandbox.window;
const clone = value => JSON.parse(JSON.stringify(value));

const checkLayout = (l, m, f) => {
  const eps = 1e-6;
  for (const n of l.nodes) {
    assert.ok(n.x >= -eps && n.y >= -eps && n.x + n.w <= l.width + eps && n.y + n.h <= l.height + eps, 'węzeł poza granicami: ' + n.id);
    assert.ok(Number.isFinite(n.x + n.y + n.w + n.h), 'NaN w węźle ' + n.id);
  }
  for (let i = 0; i < l.nodes.length; i++) {
    for (let j = i + 1; j < l.nodes.length; j++) {
      const a = l.nodes[i];
      const b = l.nodes[j];
      const overlap = a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
      assert.ok(!overlap, 'nakładanie węzłów ' + a.id + ' i ' + b.id);
    }
  }
  for (const n of l.nodes) {
    const lane = l.lanes.find(x => x.id === n.lane);
    assert.ok(lane && n.y >= lane.y && n.y + n.h <= lane.y + lane.h, 'węzeł poza swoim pasem: ' + n.id);
    assert.ok(l.columns[n.col] && n.x >= l.columns[n.col].x && n.x + n.w <= l.columns[n.col].x + l.columns[n.col].w, 'węzeł poza swoją kolumną: ' + n.id);
  }
  for (const e of l.edges) {
    assert.ok(e.d && !/NaN|undefined|Infinity/.test(e.d), 'zła ścieżka krawędzi ' + e.from + '>' + e.to + ': ' + e.d);
    if (e.label) assert.ok(Number.isFinite(e.labelX) && Number.isFinite(e.labelY), 'brak pozycji etykiety ' + e.from + '>' + e.to);
  }
};

// Liczba krawędzi wstecz liczona niezależnie od układu: kolumna celu < kolumny źródła wg matrix.processes.
const backwardCount = (m, f, laneIds) => {
  const tp = new Map(m.touchpoints.map(t => [t.id, t]));
  const shown = t => !laneIds || laneIds.includes(core.laneOf(t));
  return f.edges.filter(e => shown(tp.get(e.from)) && shown(tp.get(e.to)) &&
    m.processes.indexOf(tp.get(e.to).process) < m.processes.indexOf(tp.get(e.from).process)).length;
};

// Dane DEMO: wszystkie punkty, tory z danych, wszystkie krawędzie.
const full = layout.compute(matrix, flow);
checkLayout(full, matrix, flow);
assert.strictEqual(full.nodes.length, matrix.touchpoints.length);
assert.strictEqual(full.nodes.length, 60);
assert.strictEqual(full.lanes.length, core.lanes(matrix, flow).length);
assert.strictEqual(full.lanes.length, 4);
assert.strictEqual(full.edges.length, flow.edges.length);
assert.strictEqual(full.columns.map(c => c.process).join(), matrix.processes.join());
const backward = full.edges.filter(e => e.backward).length;
assert.ok(backward > 0);
assert.strictEqual(backward, backwardCount(matrix, flow));
assert.strictEqual(full.edges.filter(e => e.optional).length, flow.edges.filter(e => e.optional).length);

// Determinizm.
assert.deepStrictEqual(layout.compute(matrix, flow), full);

// Filtr torów: tylko importer.
{
  const l = layout.compute(matrix, flow, { lanes: ['importer'] });
  checkLayout(l, matrix, flow);
  const expected = matrix.touchpoints.filter(t => core.laneOf(t) === 'importer').length;
  assert.strictEqual(l.nodes.length, expected);
  assert.ok(expected < 60);
  assert.strictEqual(l.lanes.length, 1);
  assert.ok(l.edges.length < flow.edges.length);
  const ids = new Set(l.nodes.map(n => n.id));
  assert.ok(l.edges.every(e => ids.has(e.from) && ids.has(e.to)), 'krawędź do ukrytego węzła');
  assert.strictEqual(l.edges.filter(e => e.backward).length, backwardCount(matrix, flow, ['importer']));
  assert.ok(l.columns.length <= full.columns.length);
}

// Filtr dwóch torów zachowuje kolejność z danych, nie z opts.
{
  const l = layout.compute(matrix, flow, { lanes: ['dealer/serwis', 'importer'] });
  checkLayout(l, matrix, flow);
  assert.strictEqual(l.lanes.map(x => x.id).join(), 'importer,dealer/serwis');
}

// Nowy tor w danych bez zmiany kodu.
{
  const m = clone(matrix);
  const f = clone(flow);
  m.touchpoints[0].lane = 'nowy';
  f.labels.lane.nowy = 'Nowy tor';
  const l = layout.compute(m, f);
  checkLayout(l, m, f);
  assert.strictEqual(l.lanes.length, 5);
  assert.strictEqual(l.lanes[0].id, 'nowy');
  assert.strictEqual(l.nodes.length, 60);
  assert.strictEqual(l.edges.length, f.edges.length);
}

// Opcje wymiarów są respektowane.
{
  const l = layout.compute(matrix, flow, { nodeW: 100, nodeH: 40 });
  checkLayout(l, matrix, flow);
  assert.ok(l.nodes.every(n => n.w === 100 && n.h === 40));
}

console.log('OK: układ DEMO (60 węzłów, 4 pasy), brak nakładania, krawędzie wstecz, filtr torów, nowy tor, determinizm');
