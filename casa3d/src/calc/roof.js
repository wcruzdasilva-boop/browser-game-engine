// Geometria e quantitativo de telhado sobre uma projeção retangular (m).
//
// Tipos:
//   'duas-aguas' → cumeeira central, beiral em volta.
//   'uma-agua'   → uma única água com beiral, cai na direção do vão.
//   'platibanda' → uma água escondida atrás de platibanda: sem beiral, com calha e rufos.
//
// O vão (span) é a dimensão que as águas vencem; o comprimento (length) é a direção da
// cumeeira/terças. Por padrão a cumeeira corre na maior dimensão (ridgeAxis 'auto').

import { ROOF_TILES } from '../catalog/roofTiles.js';
import { STRUCTURE_SYSTEMS } from '../catalog/roofStructure.js';

export const ROOF_TYPES = {
  'duas-aguas': 'Duas águas',
  'uma-agua': 'Uma água',
  platibanda: 'Uma água com platibanda',
};

const slopeFactor = (i) => Math.hypot(1, i);

export function roofGeometry({
  width, depth, type = 'duas-aguas', slope = 0.30, overhang = 0.5,
  ridgeAxis = 'auto', parapetFreeboard = 0.30,
}) {
  if (!(width > 0 && depth > 0)) throw new Error('Projeção do telhado precisa ter largura e profundidade > 0');
  if (!ROOF_TYPES[type]) throw new Error(`Tipo de telhado desconhecido: ${type}`);
  const alongX = ridgeAxis === 'auto' ? width >= depth : ridgeAxis === 'x';
  const length = alongX ? width : depth;
  const span = alongX ? depth : width;
  const k = slopeFactor(slope);
  const base = { type, slope, span, length, ridgeAxis: alongX ? 'x' : 'y' };

  if (type === 'duas-aguas') {
    const rise = (span / 2) * slope;
    const run = span / 2 + overhang;
    const plane = { run, rafter: run * k, width: length + 2 * overhang };
    plane.area = plane.rafter * plane.width;
    return {
      ...base, overhang, rise, planes: [plane, { ...plane }], area: 2 * plane.area,
      supportedSlopeLength: (span / 2) * k,
      ridge: plane.width, eaves: 2 * plane.width, rakes: 4 * plane.rafter,
      gutters: 0, flashing: 0, gableArea: span * rise, parapetHeight: 0,
    };
  }

  const rise = span * slope;
  if (type === 'uma-agua') {
    const run = span + 2 * overhang;
    const plane = { run, rafter: run * k, width: length + 2 * overhang };
    plane.area = plane.rafter * plane.width;
    return {
      ...base, overhang, rise, planes: [plane], area: plane.area,
      supportedSlopeLength: span * k,
      ridge: 0, eaves: plane.width, rakes: 2 * plane.rafter,
      gutters: 0, flashing: plane.width, gableArea: span * rise, parapetHeight: 0,
    };
  }

  // platibanda: a água fica entre as paredes, calha no lado baixo, rufo nos outros três
  const plane = { run: span, rafter: span * k, width: length };
  plane.area = plane.rafter * plane.width;
  return {
    ...base, overhang: 0, rise, planes: [plane], area: plane.area,
    supportedSlopeLength: span * k,
    ridge: 0, eaves: 0, rakes: 0,
    gutters: length, flashing: length + 2 * span, gableArea: 0,
    parapetHeight: rise + parapetFreeboard,
  };
}

// Comprimento total de barras de uma tesoura (estimativa para orçamento).
function trussMemberLength(geom) {
  const { span, rise, slope } = geom;
  const k = slopeFactor(slope);
  if (geom.type === 'duas-aguas') {
    // tesoura com pendural e duas escoras
    return span + span * k + rise + 2 * Math.hypot(span / 4, rise / 2);
  }
  // meia-tesoura (uma água): linha, perna, montante alto, montante médio e diagonal
  return span + span * k + rise + rise / 2 + Math.hypot(span / 2, rise / 2);
}

function memberItem(key, member, material, count, unitLength, waste) {
  const totalLength = count * unitLength * (1 + waste);
  const item = { key, name: member.name, section: member.section, count, unitLength, totalLength };
  if (material === 'madeira') item.volumeM3 = totalLength * member.b * member.h;
  else item.massKg = totalLength * member.kgPerM;
  return item;
}

export function roofStructure(geom, tile, systemKey = 'madeira', { waste = 0.05, overrides = {} } = {}) {
  const system = STRUCTURE_SYSTEMS[systemKey];
  if (!system) throw new Error(`Sistema estrutural desconhecido: ${systemKey}`);
  const rules = { ...system[tile.kind], ...overrides };
  const { members, material } = system;
  const items = [];
  const planes = geom.planes;
  const plane = planes[0];

  const trusses = Math.ceil(geom.length / rules.trussSpacing) + 1;
  items.push(memberItem('tesoura', members.tesoura, material, trusses, trussMemberLength(geom), waste));

  if (rules.purlinSpacing) {
    const spacing = Math.min(rules.purlinSpacing, tile.maxPurlinSpacing ?? Infinity);
    const linesPerPlane = Math.ceil(geom.supportedSlopeLength / spacing) + 1;
    // nas duas águas a linha da cumeeira é compartilhada
    const lines = planes.length === 2 ? 2 * linesPerPlane - 1 : linesPerPlane;
    items.push(memberItem('terca', members.terca, material, lines, plane.width, waste));
  }
  if (rules.rafterSpacing && members.caibro) {
    const perPlane = Math.ceil(plane.width / rules.rafterSpacing) + 1;
    items.push(memberItem('caibro', members.caibro, material, perPlane * planes.length, plane.rafter, waste));
  }
  if (rules.battens && tile.gauge) {
    const rows = Math.ceil(plane.rafter / tile.gauge) + 1;
    items.push(memberItem('ripa', members.ripa, material, rows * planes.length, plane.width, waste));
  }

  const totals = material === 'madeira'
    ? { volumeM3: items.reduce((s, i) => s + i.volumeM3, 0) }
    : { massKg: items.reduce((s, i) => s + i.massKg, 0) };
  return { system: system.name, material, items, totals };
}

export function roofCover(geom, tile, { waste = 0.05 } = {}) {
  const items = [];
  const warnings = [];
  if (geom.slope < tile.minSlope) {
    warnings.push(`Inclinação ${(geom.slope * 100).toFixed(0)}% abaixo da mínima de ${tile.name} (${(tile.minSlope * 100).toFixed(0)}%).`);
  }

  if (tile.kind === 'ceramica') {
    items.push({ key: 'telha', name: tile.name, unit: 'peça', qty: Math.ceil(geom.area * tile.piecesPerM2 * (1 + waste)) });
    if (geom.ridge > 0) {
      items.push({ key: 'cumeeira', name: tile.ridge.name, unit: 'peça', qty: Math.ceil(geom.ridge * tile.ridge.piecesPerM * (1 + waste)) });
    }
  } else {
    let sheets = 0;
    let sheetArea = 0;
    const lengths = [];
    for (const plane of geom.planes) {
      const n = Math.ceil(plane.width / tile.usefulWidth - 1e-9);
      const len = Math.ceil(plane.rafter / tile.lengthStep - 1e-9) * tile.lengthStep;
      if (len > tile.maxLength) warnings.push(`Água com ${len.toFixed(2)} m excede a chapa máxima de ${tile.maxLength} m: prever emenda.`);
      sheets += n;
      sheetArea += n * len * tile.usefulWidth;
      lengths.push({ count: n, length: len });
    }
    items.push({ key: 'telha', name: tile.name, unit: 'chapa', qty: sheets, lengths, areaM2: sheetArea });
    if (geom.ridge > 0) {
      items.push({ key: 'cumeeira', name: tile.ridge.name, unit: 'peça', qty: Math.ceil(geom.ridge / tile.ridge.usefulLength - 1e-9) });
    }
    const spacing = tile.maxPurlinSpacing;
    const supportsPerSheet = Math.ceil(geom.planes[0].rafter / spacing) + 1;
    items.push({ key: 'fixacao', name: 'Parafuso autobrocante c/ vedação', unit: 'un', qty: Math.ceil(sheets * supportsPerSheet * tile.fixingsPerSupport * (1 + waste)) });
  }

  if (geom.gutters > 0) items.push({ key: 'calha', name: 'Calha', unit: 'm', qty: geom.gutters });
  if (geom.flashing > 0) items.push({ key: 'rufo', name: 'Rufo', unit: 'm', qty: geom.flashing });
  return { items, warnings };
}

// Ponto de entrada: geometria + cobertura + estrutura.
export function calculateRoof({ tile: tileKey = 'colonial', structure = 'madeira', waste = 0.05, structureOverrides, ...geomParams }) {
  const tile = ROOF_TILES[tileKey];
  if (!tile) throw new Error(`Telha desconhecida: ${tileKey}`);
  const geometry = roofGeometry(geomParams);
  const cover = roofCover(geometry, tile, { waste });
  const struct = roofStructure(geometry, tile, structure, { waste, overrides: structureOverrides });
  const loadKg = geometry.area * tile.weightKgM2;
  return { geometry, cover, structure: struct, loadKg, warnings: cover.warnings };
}
