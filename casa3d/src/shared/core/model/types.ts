import type { RoofParams } from '../../calc/roof';

// Tipos do modelo de domínio. Tudo em metros, plano XY com Y apontando para o "norte"
// (para cima na tela); a altura (Z no 3D) vem de `height`/`sill`.

export interface Vec2 {
  x: number;
  y: number;
}

export type MaterialKey = 'madeira' | 'aco' | 'aluminio' | 'vidro';
export type OpeningOperation = 'giro' | 'correr' | 'pivotante' | 'basculante' | 'maxim-ar' | 'fixa';

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
}

export interface OpeningOptions {
  /** lado da dobradiça, visto por quem está do lado para onde a folha abre */
  hinge?: 'esquerda' | 'direita';
  swing?: 'dentro' | 'fora';
  /** lado para onde a folha corre, visto de dentro */
  slideTo?: 'esquerda' | 'direita';
  mount?: 'aparente' | 'embutida';
}

export interface Opening {
  id: string;
  wallId: string;
  modelId: string;
  /** distância do início da parede (a) até a lateral do vão */
  offset: number;
  width: number;
  height: number;
  sill: number;
  material: MaterialKey;
  options: OpeningOptions;
  /** 0 = fechada, 1 = aberta (usado pela vista 3D) */
  openAmount: number;
}

/** Metadados de um cômodo. O polígono é derivado das paredes; `anchor` liga os dados ao cômodo. */
export interface RoomMeta {
  id: string;
  name: string;
  anchor: Vec2;
}

export interface Dimension {
  id: string;
  a: Vec2;
  b: Vec2;
  /** deslocamento da linha de cota, perpendicular a a→b (positivo = à esquerda) */
  offset: number;
}

export interface FurnitureItem {
  id: string;
  catalogId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface CameraPoint {
  id: string;
  roomId?: string;
  x: number;
  y: number;
  eye: number;
  yaw: number;
}

export interface ImportRef {
  id: string;
  file: string;
  format: string;
}

export interface ProjectSettings {
  wallHeight: number;
  wallThickness: number;
  floorThickness: number;
  foundationDepth: number;
  gridStep: number;
}

export interface Project {
  schema: number;
  name: string;
  units: 'm';
  settings: ProjectSettings;
  walls: Wall[];
  openings: Opening[];
  rooms: RoomMeta[];
  dimensions: Dimension[];
  furniture: FurnitureItem[];
  roof: RoofParams | null;
  ceiling: { type: string };
  cameras: CameraPoint[];
  imports: ImportRef[];
}
