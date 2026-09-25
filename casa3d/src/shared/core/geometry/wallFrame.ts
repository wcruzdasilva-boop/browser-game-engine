// Sistema local de uma parede: u ao longo de a→b, n para a esquerda (normal), em metros.

import type { Vec2, Wall } from '../model/types';
import { add, dist, dot, leftNormal, normalize, scale, sub } from './vec';

export interface WallFrame {
  origin: Vec2;
  dir: Vec2;
  normal: Vec2;
  length: number;
  /** ponto do mundo em (u, n) */
  at(u: number, n?: number): Vec2;
  /** coordenadas locais (u, n) de um ponto do mundo */
  local(p: Vec2): { u: number; n: number };
}

export function wallFrame(w: Wall): WallFrame {
  const dir = normalize(sub(w.b, w.a));
  const normal = leftNormal(dir);
  return {
    origin: w.a,
    dir,
    normal,
    length: dist(w.a, w.b),
    at: (u, n = 0) => add(add(w.a, scale(dir, u)), scale(normal, n)),
    local: (p) => {
      const d = sub(p, w.a);
      return { u: dot(d, dir), n: dot(d, normal) };
    },
  };
}
