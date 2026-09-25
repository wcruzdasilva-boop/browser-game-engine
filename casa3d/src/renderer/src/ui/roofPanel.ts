// Aba Telhado: calculadora de cobertura e estrutura. Os parâmetros ficam salvos no projeto
// (desfazer/refazer) e as dimensões podem vir do contorno da planta.

import { ROOF_TYPES, calculateRoof, type RoofParams, type RoofType } from '@shared/calc/roof';
import { ROOF_TILES, TILE_FAMILIES, tilesOfFamily, type RoofTileId, type TileFamily } from '@shared/catalog/roofTiles';
import { STRUCTURE_SYSTEMS, type StructureMaterial } from '@shared/catalog/roofStructure';
import { formatNumber } from '@shared/core/units';
import type { Store } from '../app/store';
import { field, h, numberInput, select } from './dom';

const DEFAULT_ROOF: Required<Pick<RoofParams, 'width' | 'depth' | 'type' | 'slope' | 'overhang' | 'tile' | 'structure'>> = {
  width: 10, depth: 8, type: 'duas-aguas', slope: 0.30, overhang: 0.5, tile: 'colonial', structure: 'madeira',
};

function planExtents(store: Store): { width: number; depth: number } | null {
  const pts = store.plan.outlines.flatMap((o) => o.inner);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

export function renderRoofPanel(el: HTMLElement, store: Store): void {
  const params = { ...DEFAULT_ROOF, ...store.project.roof };
  const set = (patch: Partial<RoofParams>) => store.edit('Telhado', (p) => { p.roof = { ...params, ...patch }; });
  const tile = ROOF_TILES[params.tile];
  const family = tile.family;
  const variants = tilesOfFamily(family);
  const extents = planExtents(store);

  const form = h('div', { class: 'roof-form' },
    field('Largura (m)', numberInput(params.width, (v) => set({ width: v }), { min: 0.5 })),
    field('Profundidade (m)', numberInput(params.depth, (v) => set({ depth: v }), { min: 0.5 })),
    field('Modelo', select(params.type, Object.entries(ROOF_TYPES) as [RoofType, string][], (v) => set({ type: v }))),
    field('Inclinação (%)', numberInput(params.slope * 100, (v) => set({ slope: v / 100 }), { min: 1, decimals: 0 })),
    params.type !== 'platibanda' ? field('Beiral (m)', numberInput(params.overhang, (v) => set({ overhang: v }), { min: 0 })) : null,
    field('Telha', select(family, Object.entries(TILE_FAMILIES) as [TileFamily, string][], (v) => {
      const first = tilesOfFamily(v)[0]!;
      set({ tile: first, slope: Math.max(params.slope, ROOF_TILES[first].minSlope) });
    })),
    variants.length > 1
      ? field('Modelo da telha', select(params.tile, variants.map((id) => [id, ROOF_TILES[id].name] as [RoofTileId, string]), (v) => set({ tile: v })))
      : null,
    field('Estrutura', select(params.structure, Object.entries(STRUCTURE_SYSTEMS).map(([k, s]) => [k, s.name]) as [StructureMaterial, string][], (v) => set({ structure: v }))),
  );

  const result = h('section', { class: 'roof-result' });
  try {
    const r = calculateRoof(params);
    const g = r.geometry;
    result.append(
      ...r.warnings.map((w) => h('p', { class: 'warn' }, w)),
      h('p', {}, 'Área de telhado: ', h('b', {}, `${formatNumber(g.area)} m²`),
        ` · desnível: ${formatNumber(g.rise)} m`,
        g.parapetHeight ? ` · platibanda: ${formatNumber(g.parapetHeight)} m` : '',
        ` · carga da cobertura ≈ ${formatNumber(r.loadKg, 0)} kg`),
      h('h4', {}, 'Cobertura'),
      h('table', {}, r.cover.items.map((i) => h('tr', {}, h('td', {}, i.name), h('td', { class: 'n' }, `${formatNumber(i.qty, i.unit === 'm' ? 2 : 0)} ${i.unit}`),
        h('td', { class: 'muted' }, i.lengths ? i.lengths.map((l) => `${l.count} × ${formatNumber(l.length)} m`).join(' + ') : '')))),
      h('h4', {}, `Estrutura — ${r.structure.system}`),
      h('table', {},
        h('tr', {}, h('th', {}, 'Peça'), h('th', {}, 'Seção'), h('th', { class: 'n' }, 'Qtd.'), h('th', { class: 'n' }, 'Total'), h('th', { class: 'n' }, '')),
        r.structure.items.map((i) => h('tr', {}, h('td', {}, i.name), h('td', {}, i.section), h('td', { class: 'n' }, String(i.count)),
          h('td', { class: 'n' }, `${formatNumber(i.totalLength, 1)} m`),
          h('td', { class: 'n' }, i.volumeM3 != null ? `${formatNumber(i.volumeM3, 3)} m³` : `${formatNumber(i.massKg ?? 0, 0)} kg`)))),
      h('p', { class: 'help' }, 'Quantitativo para orçamento (perda de 5% incluída). O dimensionamento estrutural definitivo é de responsabilidade de profissional habilitado.'),
    );
  } catch (e) {
    result.append(h('p', { class: 'warn' }, (e as Error).message));
  }

  el.replaceChildren(
    h('div', { class: 'roof' },
      h('header', {},
        h('h2', {}, 'Telhado'),
        extents
          ? h('button', { onclick: () => set({ width: +extents.width.toFixed(2), depth: +extents.depth.toFixed(2) }) },
            `Usar contorno da planta (${formatNumber(extents.width)} × ${formatNumber(extents.depth)} m)`)
          : null),
      form,
      result,
      h('p', { class: 'help' }, 'Fase 3: telhados de 3 e 4 águas, plantas em L e visualização 3D das camadas de estrutura e cobertura.')),
  );
}
