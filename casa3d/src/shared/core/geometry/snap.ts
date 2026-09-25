// Captura de pontos do editor 2D. Ordem de prioridade: extremidade > meio de parede >
// ponto sobre parede > direção (ângulo/ortogonal a partir do ponto anterior) > grade.
// `tolerance` é em metros (o editor converte os pixels da tela conforme o zoom).

import type { Vec2, Wall } from '../model/types';
import { add, dist, len, lerp, lineIntersection, normalize, projectOnSegment, scale, sub } from './vec';
import { clean, roundTo } from '../units';

export type SnapKind = 'extremidade' | 'meio' | 'parede' | 'angulo' | 'grade' | 'livre';

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  wallId?: string;
}

export interface SnapContext {
  walls: Wall[];
  tolerance: number;
  gridStep: number;
  /** ponto anterior do traço (ativa a captura de ângulo) */
  from?: Vec2;
  angleStepDeg?: number;
  /** força 0°/90° a partir de `from` (Shift) */
  ortho?: boolean;
  /** paredes a ignorar (ex.: a que está sendo arrastada) */
  ignore?: Set<string>;
  /** pontos extras para capturar (ex.: início da polilinha atual) */
  extraPoints?: Vec2[];
}

function angleSnap(p: Vec2, from: Vec2, stepDeg: number, gridStep: number, force: boolean): Vec2 | null {
  const d = sub(p, from);
  const l = len(d);
  if (l < 1e-9) return null;
  const ang = Math.atan2(d.y, d.x);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  if (!force && Math.abs(snapped - ang) > (4 * Math.PI) / 180) return null;
  const length = roundTo(l * Math.cos(snapped - ang), gridStep);
  return add(from, scale({ x: Math.cos(snapped), y: Math.sin(snapped) }, length));
}

export function snapPoint(p: Vec2, ctx: SnapContext): SnapResult {
  const walls = ctx.walls.filter((w) => !ctx.ignore?.has(w.id));
  let best: SnapResult | null = null;
  let bestD = ctx.tolerance;
  const consider = (q: Vec2, kind: SnapKind, wallId?: string) => {
    const d = dist(p, q);
    if (d < bestD) {
      bestD = d;
      best = { point: { x: clean(q.x), y: clean(q.y) }, kind, wallId };
    }
  };

  // 1. extremidades têm prioridade absoluta
  if (!ctx.ortho) {
    for (const w of walls) {
      consider(w.a, 'extremidade', w.id);
      consider(w.b, 'extremidade', w.id);
    }
    for (const q of ctx.extraPoints ?? []) consider(q, 'extremidade');
    if (best) return best;
  }

  // 2. meio de parede ou cruzamento da direção capturada com uma parede: o mais próximo
  const q = ctx.from ? angleSnap(p, ctx.from, ctx.ortho ? 90 : (ctx.angleStepDeg ?? 15), ctx.gridStep, !!ctx.ortho) : null;
  if (!ctx.ortho) for (const w of walls) consider(lerp(w.a, w.b, 0.5), 'meio', w.id);
  if (q && ctx.from && dist(q, ctx.from) > 1e-9) {
    const from = ctx.from;
    const dir = normalize(sub(q, from));
    for (const w of walls) {
      const x = lineIntersection(from, dir, w.a, sub(w.b, w.a));
      if (!x || projectOnSegment(x, w.a, w.b).distance > 1e-6 || dist(x, from) < 1e-6) continue;
      consider(x, 'parede', w.id);
    }
  }
  if (best) return best;

  // 3. direção (ângulo/ortogonal) com comprimento na grade
  if (q) return { point: { x: clean(q.x), y: clean(q.y) }, kind: 'angulo' };

  // 4. ponto sobre parede
  if (!ctx.ortho) {
    for (const w of walls) {
      const pr = projectOnSegment(p, w.a, w.b);
      consider(pr.point, 'parede', w.id);
    }
    if (best) return best;
  }

  return { point: { x: roundTo(p.x, ctx.gridStep), y: roundTo(p.y, ctx.gridStep) }, kind: 'grade' };
}
