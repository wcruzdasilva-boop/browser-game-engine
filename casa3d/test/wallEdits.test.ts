import { test, assert } from 'vitest';
import { applyAttachments, findAttachments } from '@shared/core/model/wallEdits';
import { createWall } from '@shared/core/model/project';

test('parede em T acompanha a parede hospedeira', () => {
  const host = createWall({ x: 8, y: 0 }, { x: 8, y: 6 });
  const stem = createWall({ x: 5, y: 3 }, { x: 8, y: 3 });
  const walls = [host, stem];
  const att = findAttachments(walls, new Set([host.id]));
  assert.equal(att.length, 1);
  host.b = { x: 9, y: 6 };
  applyAttachments(walls, att);
  // ponto mais próximo sobre a parede inclinada
  assert.closeTo(stem.b.x, 8 + 18 / 37, 1e-9);
  assert.closeTo(stem.b.y, 108 / 37, 1e-9);
});

test('ao esticar a parede hospedeira, a parede em T fica onde estava', () => {
  const host = createWall({ x: 0, y: 6 }, { x: 8, y: 6 });
  const stem = createWall({ x: 5, y: 0 }, { x: 5, y: 6 });
  const walls = [host, stem];
  const att = findAttachments(walls, new Set([host.id]));
  host.b = { x: 9, y: 6 };
  applyAttachments(walls, att);
  assert.deepEqual(stem.b, { x: 5, y: 6 });
});
