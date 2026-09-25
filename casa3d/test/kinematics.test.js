import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leafPoses } from '../src/core/openings/kinematics.js';

test('porta de giro fechada e aberta', () => {
  const o = { operation: 'giro', leaves: 1, width: 0.8, height: 2.1, hinge: 'direita', swing: 'fora' };
  assert.equal(leafPoses(o, 0)[0].angle, -0);
  const [leaf] = leafPoses(o, 1);
  assert.equal(leaf.pivot.u, 0.8);
  assert.ok(Math.abs(Math.abs(leaf.angle) - Math.PI / 2) < 1e-9);
  assert.equal(leaf.side, 'fora');
});

test('janela de correr 4 folhas: centrais se afastam', () => {
  const p = leafPoses({ operation: 'correr', leaves: 4, width: 2, height: 1.2 }, 1);
  assert.deepEqual(p.map((l) => l.slide), [0, -0.5, 0.5, 0]);
});
