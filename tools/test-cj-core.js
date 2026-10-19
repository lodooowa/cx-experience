// Test js/cj-core.js na data/cj.js. Uruchom: node tools/test-cj-core.js (bez zależności).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/cj.js', 'js/cj-core.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
const core = sandbox.window.CX.cjCore;
const cj = sandbox.window.CX_CJ;
const clone = value => JSON.parse(JSON.stringify(value));

// Dane przechodzą walidację; serie mają po jednej wartości na punkt, a przerwy to null (nic nie jest dopełniane).
core.validate(cj);
const m = core.model(cj);
assert.strictEqual(m.points.length, cj.touchpoints.length);
for (const h of core.HORIZONS) assert.strictEqual(m.series[h.key].length, m.points.length);
m.points.forEach((t, i) => assert.strictEqual(m.series.now[i], t.emotionValue));
assert.ok(m.series.now.some(v => v === null), 'punkty bez emocji dają przerwę');
assert.ok(m.hasForecast('qw'));
const steps = m.points.map(t => cj.steps.findIndex(s => s.nr === t.step));
assert.ok(steps.every((s, i) => !i || s >= steps[i - 1]), 'punkty w kolejności kroków');

// Powiązania: pain point → jego punkty; punkt → jego pain point i root cause.
const pp = cj.painPoints[0].id;
const r = core.related(cj, { kind: 'pp', id: pp });
assert.strictEqual(JSON.stringify([...r.tp].sort()), JSON.stringify(cj.touchpoints.filter(t => t.painPoint === pp).map(t => t.id).sort()));
assert.ok(r.pp.has(pp) && [...r.rc].every(rc => cj.painRoot.some(p => p[0] === pp && p[1] === rc)));
const t0 = cj.touchpoints.find(t => t.painPoint && t.rootCause);
const rt = core.related(cj, { kind: 'tp', id: t0.id });
assert.ok(rt.pp.has(t0.painPoint) && rt.rc.has(t0.rootCause) && rt.tp.has(t0.id));
assert.strictEqual(core.related(cj, null).tp.size, 0);

// Jawna inicjatywa punktu zawęża powiązania: punkt → tylko ta inicjatywa, inicjatywa → tylko jej punkty.
{
  const c2 = clone(cj), tp = c2.touchpoints.find(t => t.painPoint && t.rootCause);
  const init = c2.initiatives.find(i => c2.rootInitiative.some(p => p[0] === tp.rootCause && p[1] === i.id)) || c2.initiatives[0];
  tp.initiative = init.id;
  core.validate(c2);
  assert.strictEqual(JSON.stringify([...core.related(c2, { kind: 'tp', id: tp.id }).in]), JSON.stringify([init.id]));
  assert.strictEqual(JSON.stringify([...core.related(c2, { kind: 'in', id: init.id }).tp]), JSON.stringify([tp.id]));
  c2.touchpoints[0].initiative = 'IN99';
  assert.throws(() => core.validate(c2), e => e.message.includes('nieistniejącą inicjatywę'));
}

const throwsWith = (fragment, change) => {
  const bad = clone(cj);
  change(bad);
  assert.throws(() => core.validate(bad), e => e.message.includes(fragment), fragment);
};
throwsWith('powtórzone ID', b => { b.touchpoints[1].id = b.touchpoints[0].id; });
throwsWith('nieistniejący pain point', b => { b.touchpoints[0].painPoint = 'PP99'; });
throwsWith('nieistniejący krok', b => { b.touchpoints[0].step = 'zz'; });
throwsWith('poza zakresem', b => { b.touchpoints[0].emotionValue = 7; });
throwsWith('painRoot', b => { b.painRoot.push(['PP99', 'RC01']); });
console.log('OK: dane CJ, serie z przerwami, powiązania, przypadki błędów');
