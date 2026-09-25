// Regras de portas/janelas sobre as paredes: encaixe ao longo da parede, validação de
// sobreposição e conversão das opções semânticas (dentro/fora, esquerda/direita) em geometria.

import { findOpeningModel } from '../../catalog/openings';
import type { Opening, Project, Wall } from '../model/types';
import { wallLength } from '../model/project';
import { insideSide, type PlanAnalysis } from '../geometry/plan';
import { validateOpenings, type OpeningError } from '../geometry/wallPanels';
import { roundTo } from '../units';
import type { ResolvedOpening } from './kinematics';

/** Offset do vão centrado em `u` (m ao longo da parede), preso aos limites e à grade. */
export function placeOnWall(wall: Wall, width: number, u: number, step = 0.05): number {
  const max = wallLength(wall) - width;
  return Math.min(Math.max(0, roundTo(u - width / 2, step)), Math.max(0, max));
}

export function openingsOfWall(project: Project, wallId: string): Opening[] {
  return project.openings.filter((o) => o.wallId === wallId);
}

/** Erros do vão `candidate` na parede, considerando os demais vãos (exceto ele mesmo). */
export function openingErrors(project: Project, candidate: Opening): OpeningError[] {
  const wall = project.walls.find((w) => w.id === candidate.wallId);
  if (!wall) return [{ id: candidate.id, msg: 'Parede inexistente' }];
  const others = openingsOfWall(project, wall.id).filter((o) => o.id !== candidate.id);
  const all = [...others, candidate];
  return validateOpenings({ length: wallLength(wall), height: wall.height }, all).filter(
    (e) => e.id === candidate.id || e.other === candidate.id,
  );
}

/** Ids de todos os vãos inválidos do projeto. */
export function invalidOpenings(project: Project): Set<string> {
  const bad = new Set<string>();
  for (const w of project.walls) {
    const list = openingsOfWall(project, w.id);
    for (const e of validateOpenings({ length: wallLength(w), height: w.height }, list)) {
      bad.add(String(e.id));
      if (e.other != null) bad.add(String(e.other));
    }
  }
  for (const o of project.openings) if (!project.walls.some((w) => w.id === o.wallId)) bad.add(o.id);
  return bad;
}

export function resolveOpening(plan: PlanAnalysis, wall: Wall, o: Opening): ResolvedOpening {
  const model = findOpeningModel(o.modelId);
  const inside = insideSide(plan, wall, o.offset + o.width / 2);
  const side = (o.options.swing ?? 'dentro') === 'dentro' ? inside : (-inside as 1 | -1);
  // Quem está do lado +1 (esquerda de a→b) olhando para a parede tem a direita em u = 0.
  const hingeAtStart = (o.options.hinge ?? 'esquerda') === 'direita' ? side === 1 : side === -1;
  const slideToStart = (o.options.slideTo ?? 'esquerda') === 'direita' ? inside === 1 : inside === -1;
  return {
    operation: model?.operation ?? 'fixa',
    leaves: model?.leaves ?? 1,
    width: o.width,
    height: o.height,
    side,
    hingeAtStart,
    slideToStart,
  };
}
