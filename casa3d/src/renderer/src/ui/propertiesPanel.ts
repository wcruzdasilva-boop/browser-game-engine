// Painel direito: propriedades do item selecionado ou resumo do projeto.

import { MATERIALS, OPTION_LABELS, findOpeningModel, DOOR_MODELS, WINDOW_MODELS } from '@shared/catalog/openings';
import { wallFrame } from '@shared/core/geometry/wallFrame';
import { add, dist, scale } from '@shared/core/geometry/vec';
import { defaultOptions, newId, wallLength } from '@shared/core/model/project';
import type { Opening, OpeningOptions, Project } from '@shared/core/model/types';
import { openingErrors } from '@shared/core/openings/openings';
import { formatArea, formatMeters, formatNumber } from '@shared/core/units';
import type { Store } from '../app/store';
import { append, field, h, numberInput, select, type Child } from './dom';

const THICKNESSES: [string, string][] = ['0.1', '0.12', '0.15', '0.2', '0.25'].map((t) => [t, `${Math.round(Number(t) * 100)} cm`]);

export function renderProperties(el: HTMLElement, store: Store): void {
  const sel = store.selection;
  const p = store.project;
  el.replaceChildren();

  if (sel?.kind === 'wall') {
    const w = p.walls.find((x) => x.id === sel.id);
    if (!w) return;
    const len = wallLength(w);
    const ops = p.openings.filter((o) => o.wallId === w.id);
    const setLength = (v: number) => store.edit('Comprimento da parede', (proj) => {
      const x = proj.walls.find((y) => y.id === w.id)!;
      const f = wallFrame(x);
      x.b = add(x.a, scale(f.dir, v));
    });
    append(el,
      h('h3', {}, store.plan.exteriorWalls.has(w.id) ? 'Parede externa' : 'Parede interna'),
      field('Comprimento (m)', numberInput(len, setLength, { min: 0.05 })),
      field('Espessura', select(String(+w.thickness.toFixed(3)), THICKNESSES.some(([t]) => Number(t) === +w.thickness.toFixed(3)) ? THICKNESSES : [...THICKNESSES, [String(w.thickness), `${formatNumber(w.thickness * 100, 1)} cm`]],
        (v) => store.edit('Espessura da parede', (proj) => { proj.walls.find((y) => y.id === w.id)!.thickness = Number(v); }))),
      field('Altura (m)', numberInput(w.height, (v) => store.edit('Altura da parede', (proj) => { proj.walls.find((y) => y.id === w.id)!.height = v; }), { min: 0.1 })),
      ops.length ? h('h4', {}, 'Vãos nesta parede') : null,
      h('ul', { class: 'list' }, ops.map((o) =>
        h('li', { onclick: () => store.select({ kind: 'opening', id: o.id }) }, `${findOpeningModel(o.modelId)?.name ?? o.modelId} — ${formatNumber(o.width)} × ${formatNumber(o.height)}`))),
      h('button', { class: 'danger', onclick: () => store.deleteSelection() }, 'Excluir parede'),
    );
    return;
  }

  if (sel?.kind === 'opening') {
    const o = p.openings.find((x) => x.id === sel.id);
    if (!o) return;
    append(el, openingProperties(o, store));
    return;
  }

  if (sel?.kind === 'dimension') {
    const d = p.dimensions.find((x) => x.id === sel.id);
    if (!d) return;
    append(el,
      h('h3', {}, 'Cota'),
      h('p', {}, `Medida: ${formatMeters(dist(d.a, d.b))}`),
      field('Afastamento (m)', numberInput(d.offset, (v) => store.edit('Mover cota', (proj) => { proj.dimensions.find((x) => x.id === d.id)!.offset = v; }))),
      h('button', { class: 'danger', onclick: () => store.deleteSelection() }, 'Excluir cota'),
    );
    return;
  }

  const room = store.selectedRoom();
  if (room) {
    const perimeter = room.inner.reduce((s, q, i) => s + dist(q, room.inner[(i + 1) % room.inner.length]!), 0);
    const name = h('input', { type: 'text', value: room.name, class: 'text', name: 'room-name' });
    name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') name.blur(); });
    name.addEventListener('change', () => {
      const v = name.value.trim();
      if (!v) return;
      store.edit('Renomear cômodo', (proj) => {
        const meta = room.metaId ? proj.rooms.find((r) => r.id === room.metaId) : undefined;
        if (meta) meta.name = v;
        else proj.rooms.push({ id: newId('room'), name: v, anchor: { ...room.label } });
      });
    });
    append(el,
      h('h3', {}, 'Cômodo'),
      field('Nome', name),
      h('p', {}, `Área útil: ${formatArea(room.area)}`),
      h('p', {}, `Perímetro interno: ${formatMeters(perimeter)}`),
    );
    return;
  }

  append(el, projectSummary(p, store));
}

function openingProperties(o: Opening, store: Store): Child[] {
  const model = findOpeningModel(o.modelId);
  const wall = store.project.walls.find((w) => w.id === o.wallId);
  const models = model?.kind === 'janela' ? WINDOW_MODELS : DOOR_MODELS;
  const set = (label: string, fn: (x: Opening) => void) => store.edit(label, (proj) => fn(proj.openings.find((x) => x.id === o.id)!));
  const errors = openingErrors(store.project, o);
  const custom = !model?.sizes.some(([w, hh]) => w === o.width && hh === o.height);
  const options = Object.entries(model?.options ?? {}) as [keyof OpeningOptions, readonly string[]][];
  return [
    h('h3', {}, model?.kind === 'janela' ? 'Janela' : 'Porta'),
    field('Modelo', select(o.modelId, models.map((m) => [m.id, m.name]), (v) => set('Trocar modelo', (x) => {
      const m = findOpeningModel(v)!;
      x.modelId = m.id;
      [x.width, x.height] = m.default;
      x.sill = m.sill;
      x.options = defaultOptions(m);
      if (!m.materials.includes(x.material)) x.material = m.materials[0]!;
    }))),
    field('Tamanho padrão', select(custom ? 'custom' : `${o.width}x${o.height}`,
      [...(model?.sizes ?? []).map(([w, hh]) => [`${w}x${hh}`, `${formatNumber(w)} × ${formatNumber(hh)} m`] as [string, string]), ['custom', 'Personalizado']],
      (v) => { if (v !== 'custom') set('Tamanho do vão', (x) => { [x.width, x.height] = v.split('x').map(Number) as [number, number]; }); })),
    h('div', { class: 'row' },
      field('Largura', numberInput(o.width, (v) => set('Largura do vão', (x) => { x.width = v; }), { min: 0.2 })),
      field('Altura', numberInput(o.height, (v) => set('Altura do vão', (x) => { x.height = v; }), { min: 0.2 }))),
    h('div', { class: 'row' },
      field('Peitoril', numberInput(o.sill, (v) => set('Peitoril', (x) => { x.sill = v; }), { min: 0 })),
      field('Dist. do início', numberInput(o.offset, (v) => set('Posição do vão', (x) => { x.offset = v; }), { min: 0 }))),
    field('Material', select(o.material, (model?.materials ?? []).map((k) => [k, MATERIALS[k].name]), (v) => set('Material', (x) => { x.material = v; }))),
    ...options.map(([k, values]) => field(OPTION_LABELS[k], select(String(o.options[k] ?? values[0]), values.map((v) => [v, v]), (v) =>
      set(OPTION_LABELS[k], (x) => { (x.options as Record<string, string>)[k] = v; })))),
    errors.length ? h('ul', { class: 'errors' }, errors.map((e) => h('li', {}, e.msg))) : null,
    wall ? h('p', { class: 'help' }, `Parede de ${formatMeters(wallLength(wall))}, altura ${formatMeters(wall.height)}.`) : null,
    h('button', { class: 'danger', onclick: () => store.deleteSelection() }, 'Excluir'),
  ];
}

function projectSummary(p: Project, store: Store): Child[] {
  const plan = store.plan;
  const built = plan.outlines.reduce((s, o) => s + o.area, 0);
  const useful = plan.rooms.reduce((s, r) => s + r.area, 0);
  const name = h('input', { type: 'text', value: p.name, class: 'text' });
  name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') name.blur(); });
  name.addEventListener('change', () => { if (name.value.trim()) store.edit('Renomear projeto', (proj) => { proj.name = name.value.trim(); }); });
  return [
    h('h3', {}, 'Projeto'),
    field('Nome', name),
    field('Grade de captura', select(String(p.settings.gridStep), [['0.01', '1 cm'], ['0.05', '5 cm'], ['0.1', '10 cm'], ['0.25', '25 cm']],
      (v) => store.edit('Grade', (proj) => { proj.settings.gridStep = Number(v); }))),
    h('h4', {}, 'Áreas'),
    h('dl', { class: 'stats' },
      h('dt', {}, 'Construída'), h('dd', {}, formatArea(built)),
      h('dt', {}, 'Útil (cômodos)'), h('dd', {}, formatArea(useful)),
      h('dt', {}, 'Paredes'), h('dd', {}, String(p.walls.length)),
      h('dt', {}, 'Portas/janelas'), h('dd', {}, String(p.openings.length))),
    plan.rooms.length ? h('h4', {}, 'Cômodos') : null,
    h('ul', { class: 'list' }, plan.rooms.map((r) =>
      h('li', { onclick: () => store.select({ kind: 'room', at: r.label }) }, h('span', {}, r.name), h('span', { class: 'muted' }, formatArea(r.area))))),
  ];
}
