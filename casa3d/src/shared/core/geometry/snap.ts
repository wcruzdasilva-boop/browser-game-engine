// Captura de pontos do editor 2D. Ordem de prioridade: extremidade > meio de parede >
// ponto sobre parede > direção (ângulo/ortogonal a partir do ponto anterior) > grade.
// `tolerance` é em metros (o editor converte os pixels da tela conforme o zoom).

import type { Vec2, Wall } from '../model/types';
import { add, dist, len, lerp, projectOnSegment, scale, sub } from './vec';
import { roundTo } from '../units';

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

  if (!ctx.ortho) {
    let best: SnapResult | null = null;
    let bestD = ctx.tolerance;
    const consider = (q: Vec2, kind: SnapKind, wallId?: string) => {
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = { point: { x: q.x, y: q.y }, kind, wallId };
      }
    };
    for (const w of walls) {
      consider(w.a, 'extremidade', w.id);
      consider(w.b, 'extremidade', w.id);
    }
    for (const q of ctx.extraPoints ?? []) consider(q, 'extremidade');
    if (best) return best;
    for (const w of walls) consider(lerp(w.a, w.b, 0.5), 'meio', w.id);
    if (best) return best;
  }

  if (ctx.from) {
    const q = angleSnap(p, ctx.from, ctx.ortho ? 90 : (ctx.angleStepDeg ?? 15), ctx.gridStep, !!ctx.ortho);
    if (q) return { point: q, kind: 'angulo' };
  }

  if (!ctx.ortho) {
    let best: SnapResult | null = null;
    let bestD = ctx.tolerance;
    for (const w of walls) {
      const pr = projectOnSegment(p, w.a, w.b);
      if (pr.distance < bestD) {
        bestD = pr.distance;
        best = { point: pr.point, kind: 'parede', wallId: w.id };
      }
    }
    if (best) return best;
  }

  return { point: { x: roundTo(p.x, ctx.gridStep), y: roundTo(p.y, ctx.gridStep) }, kind: 'grade' };
}
