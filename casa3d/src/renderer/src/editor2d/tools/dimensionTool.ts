// Ferramenta Cota: clique no ponto inicial, no final e depois na posição da linha de cota.

import { newId } from '@shared/core/model/project';
import type { Vec2 } from '@shared/core/model/types';
import { dist, dot, leftNormal, normalize, sub } from '@shared/core/geometry/vec';
import type { Draw } from '../draw';
import { THEME } from '../theme';
import { BaseTool, type PointerInfo } from './tool';

export class DimensionTool extends BaseTool {
  readonly name = 'dimension' as const;
  private a: Vec2 | null = null;
  private b: Vec2 | null = null;
  private pos: Vec2 | null = null;

  hint(): string {
    if (!this.a) return 'Cota: clique no primeiro ponto.';
    if (!this.b) return 'Cota: clique no segundo ponto.';
    return 'Cota: posicione a linha e clique.';
  }

  private offsetFor(p: Vec2): number {
    const d = normalize(sub(this.b!, this.a!));
    return Math.round(dot(sub(p, this.a!), leftNormal(d)) / 0.05) * 0.05;
  }

  pointerMove(e: PointerInfo): void {
    if (this.a && this.b) {
      this.snap = null;
      this.pos = e.world;
      return;
    }
    this.snap = this.editor.snap(e.world, { from: this.a ?? undefined, ortho: e.shift });
    this.pos = this.snap.point;
  }

  pointerDown(e: PointerInfo): void {
    if (e.button !== 0) return;
    this.pointerMove(e);
    const p = this.pos!;
    if (!this.a) this.a = p;
    else if (!this.b) {
      if (dist(this.a, p) > 0.01) this.b = p;
    } else {
      const dim = { id: newId('dim'), a: this.a, b: this.b, offset: this.offsetFor(p) };
      this.store.edit('Cota', (proj) => {
        proj.dimensions.push(dim);
      });
      this.a = this.b = null;
    }
  }

  cancel(): boolean {
    if (!this.a) return false;
    this.a = this.b = null;
    return true;
  }

  drawOverlay(d: Draw): void {
    if (this.snap) this.editor.drawSnap(d, this.snap);
    if (!this.a || !this.pos) return;
    if (!this.b) d.dimension(this.a, this.pos, 0, THEME.preview);
    else d.dimension(this.a, this.b, this.offsetFor(this.pos), THEME.preview);
  }
}
