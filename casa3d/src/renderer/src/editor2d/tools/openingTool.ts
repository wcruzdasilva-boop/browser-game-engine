// Ferramentas Porta/Janela: o modelo escolhido no catálogo segue o cursor e encaixa na
// parede mais próxima. O lado do cursor define se a folha abre para dentro ou para fora.

import { findOpeningModel } from '@shared/catalog/openings';
import { insideSide } from '@shared/core/geometry/plan';
import { wallFrame } from '@shared/core/geometry/wallFrame';
import { createOpening } from '@shared/core/model/project';
import type { Opening } from '@shared/core/model/types';
import { openingErrors, placeOnWall } from '@shared/core/openings/openings';
import { nearestWall } from '../pick';
import { BaseTool, type PointerInfo } from './tool';

export class OpeningTool extends BaseTool {
  override readonly cursor = 'copy';
  private candidate: Opening | null = null;
  private valid = false;

  constructor(editor: ConstructorParameters<typeof BaseTool>[0], readonly name: 'door' | 'window') {
    super(editor);
  }

  hint(): string {
    const choice = this.editor.openingChoice[this.name];
    const model = findOpeningModel(choice.modelId);
    return `${model?.name ?? ''}: passe sobre uma parede e clique para inserir. O lado do cursor define a abertura.`;
  }

  pointerMove(e: PointerInfo): void {
    const wall = nearestWall(this.store.project, e.world, this.editor.tolerance() * 2);
    const choice = this.editor.openingChoice[this.name];
    const model = findOpeningModel(choice.modelId);
    if (!wall || !model) {
      this.candidate = null;
      return;
    }
    const f = wallFrame(wall);
    const { u, n } = f.local(e.world);
    const [width, height] = choice.size;
    const options = { ...choice.options };
    if (model.options.swing) {
      const inside = insideSide(this.store.plan, wall, u);
      options.swing = Math.sign(n || 1) === inside ? 'dentro' : 'fora';
    }
    this.candidate = createOpening(wall.id, model, {
      offset: placeOnWall(wall, width, u),
      size: [width, height],
      sill: choice.sill,
      material: choice.material,
      options,
    });
    this.valid = width <= f.length && openingErrors(this.store.project, this.candidate).length === 0;
  }

  pointerDown(e: PointerInfo): void {
    if (e.button !== 0) return;
    this.pointerMove(e);
    const c = this.candidate;
    if (!c || !this.valid) return;
    this.store.edit(this.name === 'door' ? 'Inserir porta' : 'Inserir janela', (p) => {
      p.openings.push(c);
    });
    this.store.select({ kind: 'opening', id: c.id });
    this.candidate = null;
  }

  deactivate(): void {
    this.candidate = null;
  }

  drawOverlay(): void {
    if (this.candidate) this.editor.renderer.previewOpening(this.store, this.candidate, this.valid);
  }
}
