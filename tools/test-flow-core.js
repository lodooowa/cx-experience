// Test js/flow-core.js na data/matrix.js i data/flow.js. Uruchom: node tools/test-flow-core.js (bez zależności).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/matrix.js', 'data/flow.js', 'js/flow-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const core = sandbox.window.CX_FLOW_CORE;
const clone = value => JSON.parse(JSON.stringify(value));
const matrix = sandbox.window.CX_MATRIX;
const flow = sandbox.window.CX_FLOW;

const throwsWith = (fragment, change) => {
  const f = clone(flow);
  const m = clone(matrix);
  change(f, m);
  assert.throws(() => core.validate(m, f), error => error.message.includes(fragment), fragment);
};

// Dane DEMO przechodzą; ostrzeżenia to tylko pętle, bez kroków przypadków poza mapą.
const warnings = core.validate(matrix, flow);
assert.ok(warnings.some(w => w.includes('pętli')), 'oczekiwano ostrzeżenia o pętlach');
assert.ok(!warnings.some(w => w.startsWith('Przypadek')), warnings.join('\n'));

// Tory wynikają z danych: importer, dealer, salon, serwis.
assert.strictEqual(core.lanes(matrix, flow).map(l => l.id).join(), 'importer,dealer/dealer,dealer/salon,dealer/serwis');
assert.strictEqual(core.lanes(matrix, flow)[0].label, 'Importer');

// Nowy tor i nowy przypadek bez zmiany kodu: wystarczą dane.
{
  const m = clone(matrix);
  const f = clone(flow);
  m.touchpoints[0].lane = 'nowy';
  assert.throws(() => core.validate(m, f), e => e.message.includes('"nowy" nie ma etykiety'));
  f.labels.lane.nowy = 'Nowy tor';
  f.cases.push({ id: 'P-99', name: 'Nowy przypadek', steps: [{ n: 1, touchpointId: 'imp-01', state: 'zadzialal' }] });
  core.validate(m, f);
  const list = core.lanes(m, f);
  assert.strictEqual(list.length, 5);
  assert.strictEqual(list[0].id, 'nowy', 'tor z labels.lane idzie pierwszy');
}

throwsWith('nieistniejący punkt "x-1"', f => { f.edges[0].to = 'x-1'; });
throwsWith('do niego samego', f => { f.edges[0].to = f.edges[0].from; });
throwsWith('powtórzona krawędź', f => { f.edges.push(clone(f.edges[0])); });
throwsWith('powtórzone ID przypadku', f => { f.cases[1].id = f.cases[0].id; });
throwsWith('nie ma kroków', f => { f.cases[0].steps = []; });
throwsWith('powtórzone n kroku', f => { f.cases[0].steps[1].n = f.cases[0].steps[0].n; });
throwsWith('nie są uporządkowane', f => { f.cases[0].steps.reverse(); });
throwsWith('nieistniejący punkt "zzz"', f => { f.cases[0].steps[0].touchpointId = 'zzz'; });
throwsWith('nieznany stan "xx"', f => { f.cases[0].steps[0].state = 'xx'; });
throwsWith('brak window.CX_FLOW', f => { delete f.labels; });

// Krok przypadku bez krawędzi w mapie to ostrzeżenie, nie błąd.
{
  const f = clone(flow);
  f.cases[0].steps[1].touchpointId = 'dea-30';
  assert.ok(core.validate(matrix, f).some(w => w.startsWith('Przypadek P-01')));
}

console.log('OK: dane DEMO, tory z danych, nowy tor i przypadek bez zmiany kodu, przypadki błędów');
