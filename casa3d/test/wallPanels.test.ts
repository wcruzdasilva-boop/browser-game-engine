import { test, assert } from 'vitest';
import { wallPanels } from '@shared/core/geometry/wallPanels';

const wall = { length: 4, height: 2.8 };

test('parede sem vãos é um painel só', () => {
  assert.deepEqual(wallPanels(wall).panels, [{ u0: 0, u1: 4, v0: 0, v1: 2.8 }]);
});

test('porta + janela geram painéis ao redor dos vãos', () => {
  const { panels, errors } = wallPanels(wall, [
    { id: 'j', offset: 2.5, width: 1.0, sill: 1.1, height: 1.0 },
    { id: 'p', offset: 0.5, width: 0.8, sill: 0, height: 2.1 },
  ]);
  assert.deepEqual(errors, []);
  const area = panels.reduce((s, p) => s + (p.u1 - p.u0) * (p.v1 - p.v0), 0);
  assert.ok(Math.abs(area - (4 * 2.8 - 0.8 * 2.1 - 1.0 * 1.0)) < 1e-9);
  // porta no piso não gera painel abaixo do peitoril
  assert.ok(!panels.some((p) => p.u0 === 0.5 && p.v0 === 0 && p.v1 === 0));
});

test('vãos sobrepostos ou fora da parede são rejeitados', () => {
  assert.equal(wallPanels(wall, [{ offset: 0, width: 1, sill: 0, height: 2.1 }, { offset: 0.8, width: 1, sill: 0, height: 2.1 }]).errors.length, 1);
  assert.equal(wallPanels(wall, [{ offset: 3.5, width: 1, sill: 0, height: 2.1 }]).errors.length, 1);
});
