import { test, assert } from 'vitest';
import { leafPoses, type ResolvedOpening } from '@shared/core/openings/kinematics';

const base: ResolvedOpening = { operation: 'giro', leaves: 1, width: 0.8, height: 2.1, side: -1, hingeAtStart: false, slideToStart: true };

test('porta de giro fechada e aberta', () => {
  assert.equal(leafPoses(base, 0)[0]!.angle, 0);
  const leaf = leafPoses(base, 1)[0]!;
  assert.equal(leaf.pivot!.u, 0.8);
  assert.closeTo(leaf.angle!, Math.PI / 2, 1e-9);
  assert.equal(leaf.side, -1);
});

test('janela de correr 4 folhas: centrais se afastam', () => {
  const p = leafPoses({ ...base, operation: 'correr', leaves: 4, width: 2 }, 1);
  assert.deepEqual(p.map((l) => l.slide), [0, -0.5, 0.5, 0]);
});

test('porta de correr 1 folha corre para o lado escolhido', () => {
  assert.equal(leafPoses({ ...base, operation: 'correr' }, 1)[0]!.slide, -0.8);
  assert.equal(leafPoses({ ...base, operation: 'correr', slideToStart: false }, 0.5)[0]!.slide, 0.4);
});
