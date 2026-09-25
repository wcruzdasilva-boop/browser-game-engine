import { test, assert } from 'vitest';
import { analyzePlan, insideSide } from '@shared/core/geometry/plan';
import { createWall } from '@shared/core/model/project';
import type { Vec2, Wall } from '@shared/core/model/types';

const P = (x: number, y: number): Vec2 => ({ x, y });
const loop = (pts: Vec2[], t = 0.2): Wall[] => pts.map((p, i) => createWall(p, pts[(i + 1) % pts.length]!, { thickness: t }));

test('retângulo 6 × 4 (eixo) com paredes de 20 cm: um cômodo, área interna 5,8 × 3,8', () => {
  const plan = analyzePlan({ walls: loop([P(0, 0), P(6, 0), P(6, 4), P(0, 4)]), rooms: [] });
  assert.equal(plan.rooms.length, 1);
  assert.closeTo(plan.rooms[0]!.area, 5.8 * 3.8, 1e-9);
  assert.equal(plan.outlines.length, 1);
  assert.closeTo(plan.outlines[0]!.area, 6.2 * 4.2, 1e-9);
  // cantos em L sem sobras: todo polígono de parede tem 4 vértices distintos
  for (const s of plan.segments) assert.equal(new Set(s.polygon.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size, 4);
});

test('parede interna em T divide em dois cômodos', () => {
  const walls = [...loop([P(0, 0), P(6, 0), P(6, 4), P(0, 4)]), createWall(P(3, 0), P(3, 4), { thickness: 0.1 })];
  const plan = analyzePlan({ walls, rooms: [] });
  assert.equal(plan.rooms.length, 2);
  const areas = plan.rooms.map((r) => r.area).sort();
  assert.closeTo(areas[0]!, (3 - 0.1 - 0.05) * 3.8, 1e-9);
  assert.closeTo(areas[1]!, (3 - 0.1 - 0.05) * 3.8, 1e-9);
});

test('paredes cruzadas (X) formam quatro cômodos', () => {
  const walls = [
    ...loop([P(0, 0), P(4, 0), P(4, 4), P(0, 4)], 0.1),
    createWall(P(2, 0), P(2, 4), { thickness: 0.1 }),
    createWall(P(0, 2), P(4, 2), { thickness: 0.1 }),
  ];
  const plan = analyzePlan({ walls, rooms: [] });
  assert.equal(plan.rooms.length, 4);
  for (const r of plan.rooms) assert.closeTo(r.area, 1.9 * 1.9, 1e-9);
});

test('parede solta não forma cômodo nem contorno', () => {
  const plan = analyzePlan({ walls: [createWall(P(0, 0), P(3, 0))], rooms: [] });
  assert.equal(plan.rooms.length, 0);
  assert.equal(plan.outlines.length, 0);
  assert.ok(plan.segments[0]!.capA && plan.segments[0]!.capB);
});

test('nome do cômodo vem do metadado cujo ponto está dentro dele', () => {
  const plan = analyzePlan({ walls: loop([P(0, 0), P(4, 0), P(4, 3), P(0, 3)]), rooms: [{ id: 'r1', name: 'Sala', anchor: P(2, 1.5) }] });
  assert.equal(plan.rooms[0]!.name, 'Sala');
  assert.equal(plan.rooms[0]!.metaId, 'r1');
});

test('lado de dentro de uma parede externa', () => {
  // contorno anti-horário: o interior fica à esquerda de cada parede
  const walls = loop([P(0, 0), P(4, 0), P(4, 3), P(0, 3)]);
  const plan = analyzePlan({ walls, rooms: [] });
  assert.equal(insideSide(plan, walls[0]!, 2), 1);
  const reversed = createWall(P(4, 0), P(0, 0), { thickness: 0.2 });
  const plan2 = analyzePlan({ walls: [reversed, ...walls.slice(1)], rooms: [] });
  assert.equal(insideSide(plan2, reversed, 2), -1);
});

test('paredes externas são as do contorno', () => {
  const walls = [...loop([P(0, 0), P(6, 0), P(6, 4), P(0, 4)]), createWall(P(3, 0), P(3, 4))];
  const plan = analyzePlan({ walls, rooms: [] });
  assert.equal(plan.exteriorWalls.size, 4);
  assert.isFalse(plan.exteriorWalls.has(walls[4]!.id));
});

test('polilinha deslocada pela face mantém os cantos ligados', async () => {
  const { offsetPolyline } = await import('@shared/core/geometry/vec');
  // contorno anti-horário 8 × 6 clicado pela face externa: o eixo fica 7,5 cm para dentro
  const pts = offsetPolyline([P(0, 0), P(8, 0), P(8, 6), P(0, 6)], 0.075, true);
  assert.deepEqual(pts.map((p) => [+p.x.toFixed(3), +p.y.toFixed(3)]), [[0.075, 0.075], [7.925, 0.075], [7.925, 5.925], [0.075, 5.925]]);
  const plan = analyzePlan({ walls: loop(pts, 0.15), rooms: [] });
  assert.closeTo(plan.outlines[0]!.area, 8 * 6, 1e-9);
});
