import { test, assert } from 'vitest';
import { findOpeningModel } from '@shared/catalog/openings';
import { analyzePlan } from '@shared/core/geometry/plan';
import { createOpening, createProject, createWall } from '@shared/core/model/project';
import { invalidOpenings, openingErrors, placeOnWall, resolveOpening } from '@shared/core/openings/openings';

const door = findOpeningModel('porta-giro-1f')!;

function house() {
  const p = createProject();
  const pts = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
  p.walls = pts.map((a, i) => createWall(a, pts[(i + 1) % 4]!));
  return p;
}

test('encaixe centrado no cursor, preso à parede e à grade', () => {
  const w = house().walls[0]!;
  assert.closeTo(placeOnWall(w, 0.8, 2.52), 2.1, 1e-9);
  assert.equal(placeOnWall(w, 0.8, 0.1), 0);
  assert.closeTo(placeOnWall(w, 0.8, 4.9), 4.2, 1e-9);
});

test('vãos sobrepostos são inválidos (os dois)', () => {
  const p = house();
  const a = createOpening(p.walls[0]!.id, door, { offset: 1 });
  const b = createOpening(p.walls[0]!.id, door, { offset: 1.5 });
  p.openings.push(a);
  assert.equal(openingErrors(p, b).length, 1);
  p.openings.push(b);
  assert.deepEqual([...invalidOpenings(p)].sort(), [a.id, b.id].sort());
});

test('porta externa abrindo para dentro avança para o lado do cômodo', () => {
  const p = house();
  const wall = p.walls[0]!; // (0,0)→(5,0): cômodo à esquerda (+y)
  const o = createOpening(wall.id, door, { offset: 1, options: { swing: 'dentro', hinge: 'direita' } });
  const plan = analyzePlan(p);
  const r = resolveOpening(plan, wall, o);
  assert.equal(r.side, 1);
  assert.isTrue(r.hingeAtStart); // de dentro olhando a parede, a direita fica em u = 0
  const out = resolveOpening(plan, wall, { ...o, options: { swing: 'fora', hinge: 'direita' } });
  assert.equal(out.side, -1);
  assert.isFalse(out.hingeAtStart);
});
