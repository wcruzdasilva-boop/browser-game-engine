import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRoof, roofGeometry } from '../src/calc/roof.js';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('duas águas 10 × 8 m, 30%, beiral 0,50', () => {
  const g = roofGeometry({ width: 10, depth: 8, type: 'duas-aguas', slope: 0.30, overhang: 0.5 });
  assert.equal(g.ridgeAxis, 'x');
  close(g.rise, 1.2);
  close(g.planes[0].rafter, 4.5 * Math.hypot(1, 0.3));
  close(g.ridge, 11);
  close(g.area, 2 * 4.5 * Math.hypot(1, 0.3) * 11);
});

test('colonial: telhas e cumeeiras com 5% de perda', () => {
  const r = calculateRoof({ width: 10, depth: 8, type: 'duas-aguas', slope: 0.30, overhang: 0.5, tile: 'colonial' });
  const qty = Object.fromEntries(r.cover.items.map((i) => [i.key, i.qty]));
  assert.equal(qty.telha, Math.ceil(r.geometry.area * 24 * 1.05));
  assert.equal(qty.cumeeira, Math.ceil(11 * 3 * 1.05));
  assert.deepEqual(r.warnings, []);
});

test('estrutura de madeira para cerâmica tem tesoura, terça, caibro e ripa', () => {
  const r = calculateRoof({ width: 10, depth: 8, tile: 'colonial', structure: 'madeira', slope: 0.30 });
  const keys = r.structure.items.map((i) => i.key);
  assert.deepEqual(keys, ['tesoura', 'terca', 'caibro', 'ripa']);
  const tes = r.structure.items[0];
  assert.equal(tes.count, Math.ceil(10 / 3) + 1);
  assert.ok(r.structure.totals.volumeM3 > 0);
});

test('aço para cerâmica dispensa terças e caibros', () => {
  const r = calculateRoof({ width: 10, depth: 8, tile: 'plan', structure: 'aco', slope: 0.35 });
  assert.deepEqual(r.structure.items.map((i) => i.key), ['tesoura', 'ripa']);
  assert.ok(r.structure.totals.massKg > 0);
});

test('isotelha em platibanda: chapas, calha, rufo e altura da platibanda', () => {
  const r = calculateRoof({ width: 10, depth: 6, type: 'platibanda', slope: 0.10, tile: 'isotelha', structure: 'aco' });
  const g = r.geometry;
  close(g.rise, 0.6);
  close(g.parapetHeight, 0.9);
  const telha = r.cover.items.find((i) => i.key === 'telha');
  assert.equal(telha.qty, 10);                       // 10 m / 1,00 m útil
  close(telha.lengths[0].length, 6.05);             // 6,03 m arredondado a 5 cm
  assert.equal(r.cover.items.find((i) => i.key === 'calha').qty, 10);
  assert.equal(r.cover.items.find((i) => i.key === 'rufo').qty, 22);
  assert.deepEqual(r.structure.items.map((i) => i.key), ['tesoura', 'terca']);
});

test('avisa inclinação abaixo da mínima da telha', () => {
  const r = calculateRoof({ width: 8, depth: 6, type: 'uma-agua', slope: 0.10, tile: 'colonial' });
  assert.equal(r.warnings.length, 1);
});
