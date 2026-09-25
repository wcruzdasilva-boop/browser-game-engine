// Edições de parede que preservam as ligações: paredes cujas extremidades encostam no meio
// de uma parede movida (junção em T) continuam encostadas nela — a extremidade vai para o
// ponto mais próximo sobre a nova posição da parede (ao esticar, fica onde estava).

import type { Wall } from './types';
import { projectOnSegment } from '../geometry/vec';

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
