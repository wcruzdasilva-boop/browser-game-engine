// Painel esquerdo: opções da ferramenta ativa (espessura da parede, catálogo de portas e
// janelas com tamanhos padrão, material e opções de abertura).

import { DOOR_MODELS, MATERIALS, OPTION_LABELS, WINDOW_MODELS, findOpeningModel } from '@shared/catalog/openings';
import type { OpeningOptions } from '@shared/core/model/types';
import { formatNumber } from '@shared/core/units';
import { PlanEditor } from '../editor2d/editor';
import { append, field, h, numberInput, select } from './dom';

const THICKNESSES = [0.10, 0.12, 0.15, 0.20, 0.25];
const size = (w: number, hh: number) => `${formatNumber(w)} × ${formatNumber(hh)} m`;

const SHORTCUTS: [string, string][] = [
  ['V', 'Selecionar'], ['P', 'Parede'], ['O', 'Porta'], ['J', 'Janela'], ['C', 'Cota'],
  ['F', 'Enquadrar planta'], ['Shift', 'Ortogonal'], ['Espaço + arrastar', 'Mover vista'],
  ['Roda do mouse', 'Zoom'], ['Delete', 'Excluir seleção'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'],
  ['Ctrl+S', 'Salvar'], ['Esc', 'Cancelar'],
];

export function renderToolPanel(el: HTMLElement, editor: PlanEditor): void {
  const tool = editor.tool.name;
  const rerender = () => renderToolPanel(el, editor);
  el.replaceChildren();

  if (tool === 'wall') {
    const o = editor.wallOptions;
    append(el,
      h('h3', {}, 'Parede'),
      h('div', { class: 'chips' }, THICKNESSES.map((t) =>
        h('button', { class: Math.abs(o.thickness - t) < 1e-9 ? 'chip on' : 'chip', onclick: () => { o.thickness = t; rerender(); } }, `${Math.round(t * 100)} cm`))),
      field('Espessura (m)', numberInput(o.thickness, (v) => { o.thickness = v; rerender(); }, { min: 0.03 })),
      field('Altura (m)', numberInput(o.height, (v) => { o.height = v; rerender(); }, { min: 0.1 })),
      field('Linha de desenho', select(o.align, [['eixo', 'Eixo da parede'], ['face-direita', 'Face à direita do traço'], ['face-esquerda', 'Face à esquerda do traço']], (v) => { o.align = v; rerender(); })),
      o.align !== 'eixo' ? h('p', { class: 'help' }, 'Para medir pelo lado de fora, desenhe o contorno no sentido anti-horário com "face à direita" (ou horário com "face à esquerda").') : null,
      h('p', { class: 'help' }, 'Clique ponto a ponto. Digite o comprimento (ex.: 3,45 ou 345cm) e Enter para fixar a medida. Clique no ponto inicial para fechar o contorno.'),
    );
    return;
  }

  if (tool === 'door' || tool === 'window') {
    const models = tool === 'door' ? DOOR_MODELS : WINDOW_MODELS;
    const choice = editor.openingChoice[tool];
    const model = findOpeningModel(choice.modelId)!;
    const custom = !model.sizes.some(([w, hh]) => w === choice.size[0] && hh === choice.size[1]);
    const options = Object.entries(model.options) as [keyof OpeningOptions, readonly string[]][];
    append(el,
      h('h3', {}, tool === 'door' ? 'Portas' : 'Janelas'),
      h('div', { class: 'catalog' }, models.map((m) =>
        h('button', {
          class: m.id === model.id ? 'item on' : 'item',
          onclick: () => { editor.openingChoice[tool] = PlanEditor.choiceFor(m); rerender(); },
        }, m.name))),
      field('Tamanho padrão', select(custom ? 'custom' : choice.size.join('x'),
        [...model.sizes.map(([w, hh]) => [`${w}x${hh}`, size(w, hh)] as [string, string]), ['custom', 'Personalizado']],
        (v) => { if (v !== 'custom') choice.size = v.split('x').map(Number) as [number, number]; rerender(); })),
      h('div', { class: 'row' },
        field('Largura', numberInput(choice.size[0], (v) => { choice.size = [v, choice.size[1]]; rerender(); }, { min: 0.2 })),
        field('Altura', numberInput(choice.size[1], (v) => { choice.size = [choice.size[0], v]; rerender(); }, { min: 0.2 }))),
      tool === 'window' ? field('Peitoril (m)', numberInput(choice.sill, (v) => { choice.sill = v; }, { min: 0 })) : null,
      field('Material', select(choice.material, model.materials.map((k) => [k, MATERIALS[k].name]), (v) => { choice.material = v; })),
      options.filter(([k]) => k !== 'swing').map(([k, values]) =>
        field(OPTION_LABELS[k], select(String(choice.options[k] ?? values[0]), values.map((v) => [v, v]), (v) => {
          (choice.options as Record<string, string>)[k] = v;
        }))),
      h('p', { class: 'help' }, model.options.swing ? 'O lado da parede em que está o cursor define se a folha abre para dentro ou para fora.' : ''),
    );
    return;
  }

  append(el,
    h('h3', {}, tool === 'dimension' ? 'Cota' : 'Atalhos'),
    tool === 'dimension' ? h('p', { class: 'help' }, 'Clique no ponto inicial, no final e depois onde a linha de cota deve ficar.') : null,
    h('dl', { class: 'keys' }, SHORTCUTS.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
  );
}
