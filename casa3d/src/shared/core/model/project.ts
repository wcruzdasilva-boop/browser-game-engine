// Criação e migração do projeto. O modelo é JSON puro (sem three.js/DOM) e é salvo como
// arquivo `.casa3d`.

import type { OpeningModel } from '../../catalog/openings';
import type { Opening, OpeningOptions, Project, ProjectSettings, Vec2, Wall } from './types';
import { clean } from '../units';

export const SCHEMA_VERSION = 1;

let seq = 0;
export const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const DEFAULTS: ProjectSettings = {
  wallHeight: 2.80,       // pé-direito
  wallThickness: 0.15,    // bloco 14 cm + reboco
  floorThickness: 0.10,
  foundationDepth: 0.40,  // baldrame
  gridStep: 0.05,
};

export function createProject(name = 'Novo projeto'): Project {
  return {
    schema: SCHEMA_VERSION,
    name,
    units: 'm',
    settings: { ...DEFAULTS },
    walls: [],
    openings: [],
    rooms: [],
    dimensions: [],
    furniture: [],
    roof: null,
    ceiling: { type: 'pvc' },
    cameras: [],
    imports: [],
  };
}

/** Valida e completa um projeto lido do disco. */
export function loadProject(data: unknown): Project {
  if (!data || typeof data !== 'object') throw new Error('Arquivo de projeto inválido');
  const p = data as Partial<Project>;
  if (typeof p.schema !== 'number' || p.schema > SCHEMA_VERSION) {
    throw new Error('Projeto criado por uma versão mais nova do Casa3D');
  }
  const base = createProject(p.name);
  return { ...base, ...p, settings: { ...base.settings, ...p.settings }, schema: SCHEMA_VERSION };
}

export function createWall(a: Vec2, b: Vec2, opts: Partial<Omit<Wall, 'id' | 'a' | 'b'>> = {}): Wall {
  return {
    id: newId('wall'),
    a: { x: clean(a.x), y: clean(a.y) },
    b: { x: clean(b.x), y: clean(b.y) },
    thickness: opts.thickness ?? DEFAULTS.wallThickness,
    height: opts.height ?? DEFAULTS.wallHeight,
  };
}

export const wallLength = (w: Wall): number => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

export function defaultOptions(model: OpeningModel): OpeningOptions {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(model.options)) if (v?.[0]) out[k] = v[0];
  return out as OpeningOptions;
}

export function createOpening(
  wallId: string,
  model: OpeningModel,
  opts: { offset?: number; size?: [number, number]; sill?: number; material?: Opening['material']; options?: OpeningOptions } = {},
): Opening {
  const [width, height] = opts.size ?? model.default;
  return {
    id: newId('open'),
    wallId,
    modelId: model.id,
    offset: opts.offset ?? 0,
    width,
    height,
    sill: opts.sill ?? model.sill,
    material: opts.material ?? model.materials[0] ?? 'madeira',
    options: { ...defaultOptions(model), ...opts.options },
    openAmount: 0,
  };
}
