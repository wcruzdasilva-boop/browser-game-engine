// Edições de parede que preservam as ligações: paredes cujas extremidades encostam no meio
// de uma parede movida (junção em T) continuam encostadas nela — a extremidade vai para o
// ponto mais próximo sobre a nova posição da parede (ao esticar, fica onde estava).

import type { Wall } from './types';
import { add, cross, dist, dot, normalize, projectOnSegment, scale, sub } from '../geometry/vec';
import type { Vec2 } from './types';

const TOL = 1e-3;

export interface Attachment {
  wallId: string;
  end: 'a' | 'b';
  hostId: string;
}

/** Extremidades de outras paredes apoiadas no miolo das paredes `hosts`. */
export function findAttachments(walls: Wall[], hosts: Set<string>): Attachment[] {
  const out: Attachment[] = [];
  for (const host of walls) {
    if (!hosts.has(host.id)) continue;
    for (const w of walls) {
      if (hosts.has(w.id)) continue;
      for (const end of ['a', 'b'] as const) {
        const pr = projectOnSegment(w[end], host.a, host.b);
        if (pr.distance < TOL && pr.t > 1e-6 && pr.t < 1 - 1e-6) out.push({ wallId: w.id, end, hostId: host.id });
      }
    }
  }
  return out;
}

/** Reposiciona as extremidades apoiadas conforme a posição atual das paredes hospedeiras. */
export function applyAttachments(walls: Wall[], attachments: Attachment[]): void {
  for (const at of attachments) {
    const host = walls.find((w) => w.id === at.hostId);
    const w = walls.find((x) => x.id === at.wallId);
    if (host && w) w[at.end] = projectOnSegment(w[at.end], host.a, host.b).point;
  }
}

/** Paredes com extremidade no ponto p. */
export function wallsAt(walls: Wall[], p: { x: number; y: number }): Set<string> {
  return new Set(walls.filter((w) => Math.hypot(w.a.x - p.x, w.a.y - p.y) < TOL || Math.hypot(w.b.x - p.x, w.b.y - p.y) < TOL).map((w) => w.id));
}

/**
 * Trechos de a→b que ainda não estão cobertos por paredes colineares existentes — evita
 * desenhar a mesma parede duas vezes. Trechos menores que 1 cm são descartados.
 */
export function uncoveredSpans(a: Vec2, b: Vec2, walls: Wall[]): [Vec2, Vec2][] {
  const length = dist(a, b);
  if (length < 1e-9) return [];
  const d = normalize(sub(b, a));
  let spans: [number, number][] = [[0, length]];
  for (const w of walls) {
    if (Math.abs(cross(sub(w.a, a), d)) > TOL || Math.abs(cross(sub(w.b, a), d)) > TOL) continue;
    const t0 = dot(sub(w.a, a), d);
    const t1 = dot(sub(w.b, a), d);
    const lo = Math.min(t0, t1);
    const hi = Math.max(t0, t1);
    spans = spans.flatMap(([s, e]): [number, number][] => {
      if (hi <= s + TOL || lo >= e - TOL) return [[s, e]];
      const out: [number, number][] = [];
      if (lo > s + TOL) out.push([s, lo]);
      if (hi < e - TOL) out.push([hi, e]);
      return out;
    });
  }
  return spans.filter(([s, e]) => e - s >= 0.01).map(([s, e]) => [add(a, scale(d, s)), add(a, scale(d, e))]);
}
