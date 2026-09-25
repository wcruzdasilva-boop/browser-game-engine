// Análise da planta: transforma as paredes (segmentos soltos) num grafo planar e dele
// deriva, sem guardar nada no modelo:
//   • polígonos das paredes com junções limpas (L, T, X) — usados no 2D e no 3D;
//   • cômodos (faces internas do grafo) com polígono interno e área líquida;
//   • contornos externos (faces externas) — base das cotas automáticas e do telhado.
//
// Convenções: cada segmento s gera duas semiarestas, 2s (a→b) e 2s+1 (b→a). Em cada nó as
// semiarestas que saem são ordenadas por ângulo (anti-horário). A face à esquerda de uma
// semiaresta é percorrida tomando, no nó de chegada, a saída imediatamente horária à volta.

import type { Project, Vec2, Wall } from '../model/types';
import {
  add, dist, interiorPoint, leftNormal, lineIntersection, normalize, pointInPolygon, polygonArea,
  projectOnSegment, scale, segmentIntersection, sub,
} from './vec';

const TOL = 1e-3; // 1 mm

export interface PlanNode {
  p: Vec2;
  /** semiarestas que saem do nó, em ordem anti-horária */
  out: number[];
}

export interface PlanSegment {
  wallId: string;
  a: number;
  b: number;
  thickness: number;
  /** polígono [a-esq, b-esq, b-dir, a-dir] (esquerda relativa a a→b) */
  polygon: [Vec2, Vec2, Vec2, Vec2];
  capA: boolean;
  capB: boolean;
}

export interface PlanFace {
  halfEdges: number[];
  /** polígono pelo eixo das paredes */
  axis: Vec2[];
  /** polígono pelas faces das paredes (interno para cômodos, externo para contornos) */
  inner: Vec2[];
  area: number;
}

export interface Room extends PlanFace {
  metaId: string | null;
  name: string;
  label: Vec2;
}

export interface PlanAnalysis {
  nodes: PlanNode[];
  segments: PlanSegment[];
  /** preenchimento do miolo das junções com 3+ paredes (cobre a sobra entre as pontas) */
  hubs: Vec2[][];
  rooms: Room[];
  outlines: PlanFace[];
  /** paredes com pelo menos uma face voltada para fora da edificação */
  exteriorWalls: Set<string>;
}

interface HalfEdgeInfo {
  from: number;
  to: number;
  dir: Vec2;
  angle: number;
  half: number;
}

function splitParams(walls: Wall[]): Map<string, number[]> {
  const params = new Map<string, number[]>();
  for (const w of walls) params.set(w.id, [0, 1]);
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]!;
    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue;
      const o = walls[j]!;
      // extremidade de outra parede no meio desta (junção em T)
      for (const p of [o.a, o.b]) {
        const pr = projectOnSegment(p, w.a, w.b);
        if (pr.distance < TOL && pr.t > 1e-6 && pr.t < 1 - 1e-6) params.get(w.id)!.push(pr.t);
      }
      // cruzamento (junção em X)
      if (j > i) {
        const x = segmentIntersection(w.a, w.b, o.a, o.b);
        if (x && x.t > 1e-6 && x.t < 1 - 1e-6 && x.u > 1e-6 && x.u < 1 - 1e-6) {
          params.get(w.id)!.push(x.t);
          params.get(o.id)!.push(x.u);
        }
      }
    }
  }
  for (const list of params.values()) list.sort((m, n) => m - n);
  return params;
}

export function analyzePlan(project: Pick<Project, 'walls' | 'rooms'>): PlanAnalysis {
  const walls = project.walls.filter((w) => dist(w.a, w.b) > TOL);
  const nodes: PlanNode[] = [];
  const nodeAt = (p: Vec2): number => {
    const i = nodes.findIndex((n) => dist(n.p, p) < TOL);
    if (i >= 0) return i;
    nodes.push({ p: { x: p.x, y: p.y }, out: [] });
    return nodes.length - 1;
  };

  // 1. segmentos entre pontos de divisão
  const raw: { wallId: string; a: number; b: number; thickness: number }[] = [];
  const params = splitParams(walls);
  for (const w of walls) {
    const ts = params.get(w.id)!;
    let prev = nodeAt(w.a);
    for (let k = 1; k < ts.length; k++) {
      const t = ts[k]!;
      const p = { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
      const cur = nodeAt(p);
      if (cur !== prev && !raw.some((s) => (s.a === prev && s.b === cur) || (s.a === cur && s.b === prev))) {
        raw.push({ wallId: w.id, a: prev, b: cur, thickness: w.thickness });
      }
      prev = cur;
    }
  }

  // 2. semiarestas ordenadas por ângulo em cada nó
  const halves: HalfEdgeInfo[] = [];
  raw.forEach((s, i) => {
    const pa = nodes[s.a]!.p;
    const pb = nodes[s.b]!.p;
    const d = normalize(sub(pb, pa));
    halves[2 * i] = { from: s.a, to: s.b, dir: d, angle: Math.atan2(d.y, d.x), half: s.thickness / 2 };
    halves[2 * i + 1] = { from: s.b, to: s.a, dir: scale(d, -1), angle: Math.atan2(-d.y, -d.x), half: s.thickness / 2 };
    nodes[s.a]!.out.push(2 * i);
    nodes[s.b]!.out.push(2 * i + 1);
  });
  for (const n of nodes) n.out.sort((m, k) => halves[m]!.angle - halves[k]!.angle);

  // 3. cantos: à esquerda de h fica a região até a próxima saída anti-horária
  const cornerLeft: Vec2[] = [];
  const cornerRight: Vec2[] = [];
  for (const n of nodes) {
    const count = n.out.length;
    n.out.forEach((h, i) => {
      const e = halves[h]!;
      const leftOff = add(n.p, scale(leftNormal(e.dir), e.half));
      const rightOff = add(n.p, scale(leftNormal(e.dir), -e.half));
      if (count === 1) {
        cornerLeft[h] = leftOff;
        cornerRight[h] = rightOff;
        return;
      }
      const next = halves[n.out[(i + 1) % count]!]!;
      const prev = halves[n.out[(i - 1 + count) % count]!]!;
      const limit = 4 * Math.max(e.half, next.half, prev.half) + 0.05;
      const l = lineIntersection(leftOff, e.dir, add(n.p, scale(leftNormal(next.dir), -next.half)), next.dir);
      cornerLeft[h] = l && dist(l, n.p) < limit ? l : leftOff;
      const r = lineIntersection(rightOff, e.dir, add(n.p, scale(leftNormal(prev.dir), prev.half)), prev.dir);
      cornerRight[h] = r && dist(r, n.p) < limit ? r : rightOff;
    });
  }

  const segments: PlanSegment[] = raw.map((s, i) => ({
    ...s,
    polygon: [cornerLeft[2 * i]!, cornerRight[2 * i + 1]!, cornerLeft[2 * i + 1]!, cornerRight[2 * i]!],
    capA: nodes[s.a]!.out.length === 1,
    capB: nodes[s.b]!.out.length === 1,
  }));

  const hubs = nodes.filter((n) => n.out.length >= 3).map((n) => n.out.flatMap((h) => [cornerRight[h]!, cornerLeft[h]!]));

  // 4. faces
  const visited = new Uint8Array(halves.length);
  const faces: PlanFace[] = [];
  for (let start = 0; start < halves.length; start++) {
    if (visited[start]) continue;
    const loop: number[] = [];
    let h = start;
    while (!visited[h]) {
      visited[h] = 1;
      loop.push(h);
      const to = nodes[halves[h]!.to]!;
      const k = to.out.indexOf(h ^ 1);
      h = to.out[(k - 1 + to.out.length) % to.out.length]!;
    }
    const axis = loop.map((e) => nodes[halves[e]!.from]!.p);
    faces.push({ halfEdges: loop, axis, inner: loop.map((e) => cornerLeft[e]!), area: polygonArea(axis) });
  }

  const rooms: Room[] = [];
  const outlines: PlanFace[] = [];
  const exteriorWalls = new Set<string>();
  const usedMeta = new Set<string>();
  for (const f of faces) {
    if (f.area > 1e-6) {
      const inner = f.inner;
      const meta = project.rooms.find((r) => !usedMeta.has(r.id) && pointInPolygon(r.anchor, inner));
      if (meta) usedMeta.add(meta.id);
      rooms.push({
        ...f,
        area: Math.abs(polygonArea(inner)),
        metaId: meta?.id ?? null,
        name: meta?.name ?? `Cômodo ${rooms.length + 1}`,
        label: meta ? meta.anchor : interiorPoint(inner),
      });
    } else if (f.area < -1e-6) {
      outlines.push({ ...f, area: Math.abs(polygonArea(f.inner)) });
      for (const h of f.halfEdges) exteriorWalls.add(raw[h >> 1]!.wallId);
    }
  }
  return { nodes, segments, hubs, rooms, outlines, exteriorWalls };
}

export function roomAt(plan: PlanAnalysis, p: Vec2): Room | undefined {
  // o menor cômodo que contém o ponto (cômodos não se sobrepõem, mas por segurança)
  return plan.rooms.filter((r) => pointInPolygon(p, r.inner)).sort((a, b) => a.area - b.area)[0];
}

/**
 * Qual lado da parede é "dentro" no ponto `u` (m a partir de a): +1 = esquerda de a→b,
 * -1 = direita. Parede externa: o lado que tem cômodo. Parede interna: esquerda.
 */
export function insideSide(plan: PlanAnalysis, wall: Wall, u: number): 1 | -1 {
  const d = normalize(sub(wall.b, wall.a));
  const n = leftNormal(d);
  const p = add(wall.a, scale(d, u));
  const off = wall.thickness / 2 + 0.05;
  const left = !!roomAt(plan, add(p, scale(n, off)));
  const right = !!roomAt(plan, add(p, scale(n, -off)));
  return right && !left ? -1 : 1;
}
