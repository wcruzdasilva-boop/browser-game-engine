// Seleção por ponto na planta (tolerância em metros).

import type { Dimension, Opening, Project, Vec2, Wall } from '@shared/core/model/types';
import type { PlanAnalysis } from '@shared/core/geometry/plan';
import { wallFrame } from '@shared/core/geometry/wallFrame';
import { add, dist, leftNormal, normalize, pointInPolygon, projectOnSegment, scale, sub } from '@shared/core/geometry/vec';

export function pickOpening(project: Project, p: Vec2, tol: number): Opening | undefined {
  for (const o of project.openings) {
    const wall = project.walls.find((w) => w.id === o.wallId);
    if (!wall) continue;
    const { u, n } = wallFrame(wall).local(p);
    if (u >= o.offset - tol && u <= o.offset + o.width + tol && Math.abs(n) <= wall.thickness / 2 + tol) return o;
  }
  return undefined;
}

export function pickWall(project: Project, plan: PlanAnalysis, p: Vec2, tol: number): Wall | undefined {
  const seg = plan.segments.find((s) => pointInPolygon(p, s.polygon));
  if (seg) return project.walls.find((w) => w.id === seg.wallId);
  let best: Wall | undefined;
  let bestD = Infinity;
  for (const w of project.walls) {
    const d = projectOnSegment(p, w.a, w.b).distance - w.thickness / 2;
    if (d < tol && d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

/** Wall mais próxima cujo eixo está a menos de `reach` do ponto (para inserir vãos). */
export function nearestWall(project: Project, p: Vec2, reach: number): Wall | undefined {
  let best: Wall | undefined;
  let bestD = Infinity;
  for (const w of project.walls) {
    const d = projectOnSegment(p, w.a, w.b).distance;
    if (d < Math.max(reach, w.thickness / 2 + reach / 2) && d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

export function dimensionLine(dim: Dimension): [Vec2, Vec2] {
  const n = leftNormal(normalize(sub(dim.b, dim.a)));
  const off = scale(n, dim.offset);
  return [add(dim.a, off), add(dim.b, off)];
}

export function pickDimension(project: Project, p: Vec2, tol: number): Dimension | undefined {
  return project.dimensions.find((d) => {
    const [a, b] = dimensionLine(d);
    return projectOnSegment(p, a, b).distance < tol;
  });
}

/** Extremidade de parede mais próxima (posição). */
export function pickEndpoint(project: Project, p: Vec2, tol: number): Vec2 | undefined {
  let best: Vec2 | undefined;
  let bestD = tol;
  for (const w of project.walls) {
    for (const q of [w.a, w.b]) {
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best ? { ...best } : undefined;
}
