import { test, assert } from 'vitest';
import { snapPoint } from '@shared/core/geometry/snap';
import { createWall } from '@shared/core/model/project';

const walls = [createWall({ x: 0, y: 0 }, { x: 4, y: 0 })];
const ctx = { walls, tolerance: 0.2, gridStep: 0.05 };

test('captura extremidade antes de tudo', () => {
  const r = snapPoint({ x: 3.9, y: 0.1 }, ctx);
  assert.equal(r.kind, 'extremidade');
  assert.deepEqual(r.point, { x: 4, y: 0 });
});

test('captura meio e ponto sobre a parede', () => {
  assert.equal(snapPoint({ x: 2.05, y: 0.1 }, ctx).kind, 'meio');
  const r = snapPoint({ x: 1.23, y: 0.1 }, ctx);
  assert.equal(r.kind, 'parede');
  assert.closeTo(r.point.y, 0, 1e-12);
});

test('ângulo de 15° e comprimento na grade a partir do ponto anterior', () => {
  const r = snapPoint({ x: 2.01, y: 3.03 }, { ...ctx, walls: [], from: { x: 2, y: 0 } });
  assert.equal(r.kind, 'angulo');
  assert.closeTo(r.point.x, 2, 1e-9);
  assert.closeTo(r.point.y, 3.05, 1e-9);
});

test('ortogonal força 0°/90°', () => {
  const r = snapPoint({ x: 3, y: 1.2 }, { ...ctx, walls: [], from: { x: 0, y: 0 }, ortho: true });
  assert.closeTo(r.point.y, 0, 1e-9);
  assert.closeTo(r.point.x, 3, 1e-9);
});

test('grade quando nada está perto', () => {
  const r = snapPoint({ x: 1.234, y: 2.678 }, ctx);
  assert.equal(r.kind, 'grade');
  assert.closeTo(r.point.x, 1.25, 1e-9);
  assert.closeTo(r.point.y, 2.7, 1e-9);
});

test('traço alinhado para exatamente no eixo da parede que cruza (sem sobrar 5 cm)', () => {
  const host = createWall({ x: 1.7, y: 16.8 }, { x: 5.85, y: 16.8 });
  // subindo de (3,70; 13,95) com o cursor 3 cm além do eixo da parede
  const r = snapPoint({ x: 3.705, y: 16.83 }, { walls: [host], tolerance: 0.15, gridStep: 0.05, from: { x: 3.7, y: 13.95 } });
  assert.equal(r.kind, 'parede');
  assert.closeTo(r.point.x, 3.7, 1e-9);
  assert.closeTo(r.point.y, 16.8, 1e-9);
});

test('coordenadas da grade saem sem ruído de ponto flutuante', () => {
  const r = snapPoint({ x: 20.951, y: -0.449 }, { walls: [], tolerance: 0.01, gridStep: 0.05 });
  assert.equal(r.point.x, 20.95);
  assert.equal(r.point.y, -0.45);
});
