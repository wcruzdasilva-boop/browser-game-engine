// Catálogo de telhas: famílias (Colonial, Plan, Isotelha) com os modelos padrão de mercado.
// Quando uma família tem mais de um modelo, a interface mostra todos como opção. Valores de
// referência (Brasil); unidades: metros, kg, inclinação em fração (0.30 = 30%).
//
// kind 'ceramica' → peças por m² sobre ripas (galga = espaçamento das ripas).
// kind 'painel'   → chapas cortadas sob medida, fixadas direto nas terças.

export type TileFamily = 'colonial' | 'plan' | 'isotelha';

interface TileBase {
  family: TileFamily;
  name: string;
  minSlope: number;
  recommendedSlope: number;
  weightKgM2: number;
}

export interface CeramicTile extends TileBase {
  kind: 'ceramica';
  piecesPerM2: number;
  gauge: number;
  ridge: { name: string; piecesPerM: number };
}

export interface PanelTile extends TileBase {
  kind: 'painel';
  usefulWidth: number;
  maxLength: number;
  lengthStep: number;
  maxPurlinSpacing: number;
  fixingsPerSupport: number;
  ridge: { name: string; usefulLength: number };
}

export type RoofTile = CeramicTile | PanelTile;

export const TILE_FAMILIES: Record<TileFamily, string> = {
  colonial: 'Colonial',
  plan: 'Plan',
  isotelha: 'Isotelha (termoacústica)',
};

export const ROOF_TILES = {
  colonial: {
    family: 'colonial',
    name: 'Colonial cerâmica (capa-canal)',
    kind: 'ceramica',
    piecesPerM2: 24,
    minSlope: 0.25,
    recommendedSlope: 0.30,
    gauge: 0.38,
    weightKgM2: 55,
    ridge: { name: 'Cumeeira colonial', piecesPerM: 3 },
  },
  plan: {
    family: 'plan',
    name: 'Plan cerâmica',
    kind: 'ceramica',
    piecesPerM2: 26,
    minSlope: 0.30,
    recommendedSlope: 0.35,
    gauge: 0.33,
    weightKgM2: 55,
    ridge: { name: 'Cumeeira plan', piecesPerM: 3 },
  },
  'isotelha-eps30': {
    family: 'isotelha',
    name: 'Isotelha trapezoidal EPS 30 mm',
    kind: 'painel',
    usefulWidth: 1.0,
    maxLength: 12,
    lengthStep: 0.05,
    minSlope: 0.05,
    recommendedSlope: 0.10,
    maxPurlinSpacing: 1.8,
    fixingsPerSupport: 4,
    weightKgM2: 11,
    ridge: { name: 'Cumeeira trapezoidal', usefulLength: 1.0 },
  },
  'isotelha-eps50': {
    family: 'isotelha',
    name: 'Isotelha trapezoidal EPS 50 mm',
    kind: 'painel',
    usefulWidth: 1.0,
    maxLength: 12,
    lengthStep: 0.05,
    minSlope: 0.05,
    recommendedSlope: 0.10,
    maxPurlinSpacing: 2.2,
    fixingsPerSupport: 4,
    weightKgM2: 12,
    ridge: { name: 'Cumeeira trapezoidal', usefulLength: 1.0 },
  },
} satisfies Record<string, RoofTile>;

export type RoofTileId = keyof typeof ROOF_TILES;

export const tilesOfFamily = (family: TileFamily): RoofTileId[] =>
  (Object.keys(ROOF_TILES) as RoofTileId[]).filter((id) => ROOF_TILES[id].family === family);
