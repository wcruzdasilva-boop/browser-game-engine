// Sistemas estruturais de telhado. Espaçamentos em metros; seções de madeira (b × h) para
// volume em m³; perfis de aço com massa linear (kg/m) para peso total. São parâmetros de
// pré-dimensionamento/orçamento: o projeto estrutural final é de um profissional habilitado.
//
// Cada sistema define, por tipo de telha (kind), quais peças existem:
//   trussSpacing  → tesouras ao longo da cumeeira
//   purlinSpacing → terças (medido ao longo da água)
//   rafterSpacing → caibros (ao longo do beiral)
//   battens       → ripas na galga da telha

import type { RoofTile } from './roofTiles';

export type StructureMaterial = 'madeira' | 'aco';
export type MemberKey = 'tesoura' | 'terca' | 'caibro' | 'ripa';

export interface StructureRules {
  trussSpacing: number;
  purlinSpacing?: number;
  rafterSpacing?: number;
  battens?: boolean;
}

export interface Member {
  name: string;
  section: string;
  b?: number;
  h?: number;
  kgPerM?: number;
}

export interface StructureSystem {
  name: string;
  material: StructureMaterial;
  rules: Record<RoofTile['kind'], StructureRules>;
  members: Partial<Record<MemberKey, Member>>;
}

export const STRUCTURE_SYSTEMS: Record<StructureMaterial, StructureSystem> = {
  madeira: {
    name: 'Madeira',
    material: 'madeira',
    rules: {
      ceramica: { trussSpacing: 3.0, purlinSpacing: 1.5, rafterSpacing: 0.5, battens: true },
      painel: { trussSpacing: 3.0, purlinSpacing: 1.8 },
    },
    members: {
      tesoura: { name: 'Tesoura', section: '6 × 16 cm', b: 0.06, h: 0.16 },
      terca: { name: 'Terça', section: '6 × 12 cm', b: 0.06, h: 0.12 },
      caibro: { name: 'Caibro', section: '5 × 6 cm', b: 0.05, h: 0.06 },
      ripa: { name: 'Ripa', section: '1,5 × 5 cm', b: 0.015, h: 0.05 },
    },
  },
  aco: {
    name: 'Aço (perfis formados a frio)',
    material: 'aco',
    rules: {
      // tesouras leves próximas + ripas metálicas direto no banzo: dispensa terças e caibros
      ceramica: { trussSpacing: 1.2, battens: true },
      painel: { trussSpacing: 3.0, purlinSpacing: 1.8 },
    },
    members: {
      tesoura: { name: 'Tesoura', section: 'Ue 100×40×17 #2,00', kgPerM: 3.2 },
      terca: { name: 'Terça', section: 'Ue 75×40×15 #2,00', kgPerM: 2.6 },
      ripa: { name: 'Ripa metálica', section: 'Cartola 20×30 #0,65', kgPerM: 0.55 },
    },
  },
};
