import type { Vec2 } from '../model/types';
import { clean } from '../units';

export const cleanVec = (p: Vec2): Vec2 => ({ x: clean(p.x), y: clean(p.y) });

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const normalize = (a: Vec2): Vec2 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
/** normal à esquerda (giro de +90°) */
export const leftNormal = (d: Vec2): Vec2 => ({ x: -d.y, y: d.x });

/** Interseção das retas p + s·d e q + t·e; null se paralelas. */
export function lineIntersection(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const s = cross(sub(q, p), e) / den;
  return add(p, scale(d, s));
}

/** Projeção de p no segmento a-b: parâmetro t ∈ [0,1], ponto e distância. */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): { t: number; point: Vec2; distance: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
  const point = lerp(a, b, t);
  return { t, point, distance: dist(p, point) };
}

/** Interseção própria de dois segmentos (parâmetros t, u em [0,1]). */
export function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): { t: number; u: number; point: Vec2 } | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub(c, a);
  const t = cross(qp, s) / den;
  const u = cross(qp, r) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, point: add(a, scale(r, t)) };
}

export function polygonArea(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  const a = polygonArea(poly);
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Um ponto garantidamente interno (para rótulos): centróide, ou o meio da maior corda horizontal. */
export function interiorPoint(poly: Vec2[]): Vec2 {
  const c = polygonCentroid(poly);
  if (pointInPolygon(c, poly)) return c;
  const ys = poly.map((p) => p.y);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  let best = c;
  let bestLen = -1;
  for (let k = 1; k < 20; k++) {
    const y = y0 + ((y1 - y0) * k) / 20;
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const l = xs[i + 1]! - xs[i]!;
      if (l > bestLen) {
        bestLen = l;
        best = { x: (xs[i]! + xs[i + 1]!) / 2, y };
      }
    }
  }
  return best;
}

/**
 * Desloca uma polilinha `offset` m para a esquerda de cada trecho (negativo = direita),
 * com cantos em quina (interseção dos trechos deslocados).
 */
export function offsetPolyline(points: Vec2[], offset: number, closed: boolean): Vec2[] {
  const n = points.length;
  if (n < 2 || offset === 0) return points.map((p) => ({ ...p }));
  const segCount = closed ? n : n - 1;
  const dirs: Vec2[] = [];
  for (let i = 0; i < segCount; i++) dirs.push(normalize(sub(points[(i + 1) % n]!, points[i]!)));
  return points.map((p, i) => {
    const prev = closed ? dirs[(i - 1 + segCount) % segCount] : dirs[i - 1];
    const next = closed ? dirs[i % segCount] : dirs[i];
    if (!prev) return add(p, scale(leftNormal(next!), offset));
    if (!next) return add(p, scale(leftNormal(prev), offset));
    const a = add(p, scale(leftNormal(prev), offset));
    const b = add(p, scale(leftNormal(next), offset));
    return lineIntersection(a, prev, b, next) ?? a;
  });
}
