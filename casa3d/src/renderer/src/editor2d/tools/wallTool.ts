// Ferramenta Parede: cliques sucessivos formam uma polilinha de paredes. Digitar um
// comprimento (ex.: 3,45 ou 345cm) + Enter fixa a medida na direção do cursor.
// Shift = ortogonal; clicar no ponto inicial fecha o contorno; Esc/botão direito encerra.
// A linha clicada pode ser o eixo ou uma das faces da parede: nesse caso o eixo da cadeia
// inteira é recalculado com cantos em quina, para as medidas digitadas valerem na face.

import { createWall } from '@shared/core/model/project';
import type { Vec2 } from '@shared/core/model/types';
import { add, dist, leftNormal, normalize, offsetPolyline, scale, sub } from '@shared/core/geometry/vec';
import { formatNumber, parseLength } from '@shared/core/units';
import type { Draw } from '../draw';
import { THEME } from '../theme';
import { BaseTool, type PointerInfo } from './tool';

export class WallTool extends BaseTool {
  readonly name = 'wall' as const;
  private start: Vec2 | null = null;
  private chainStart: Vec2 | null = null;
  private pos: Vec2 | null = null;
  private lastDir: Vec2 = { x: 1, y: 0 };
  /** pontos clicados da cadeia atual (linha de referência) e paredes criadas por ela */
  private chain: Vec2[] = [];
  private chainWalls: string[] = [];
  typed = '';

  hint(): string {
    if (!this.start) return 'Clique para iniciar a parede. Shift = ortogonal.';
    return this.typed
      ? `Comprimento: ${this.typed} — Enter confirma`
      : 'Clique o próximo ponto ou digite o comprimento. Esc encerra; clicar no início fecha o contorno.';
  }

  private snapAt(e: PointerInfo) {
    const extra = this.chainStart ? [this.chainStart] : [];
    this.snap = this.editor.snap(e.world, { from: this.start ?? undefined, ortho: e.shift, extraPoints: extra });
    return this.snap.point;
  }

  pointerMove(e: PointerInfo): void {
    this.pos = this.snapAt(e);
  }

  pointerDown(e: PointerInfo): void {
    if (e.button !== 0) return;
    this.place(this.snapAt(e));
  }

  doubleClick(): void {
    this.finish();
  }

  private place(p: Vec2): void {
    if (!this.start) {
      this.start = p;
      this.chainStart = p;
      this.chain = [p];
      this.chainWalls = [];
      return;
    }
    if (dist(this.start, p) < 0.01) return;
    const opts = this.editor.wallOptions;
    const from = this.start;
    const closing = !!this.chainStart && this.chain.length >= 3 && dist(p, this.chainStart) < 1e-6;
    if (!closing) this.chain.push(p);
    const offset = opts.align === 'eixo' ? 0 : (opts.align === 'face-esquerda' ? -1 : 1) * (opts.thickness / 2);
    const axis = offsetPolyline(this.chain, offset, closing);
    const ids = this.chainWalls;
    const created = createWall(from, p, { thickness: opts.thickness, height: opts.height });
    this.store.edit('Desenhar parede', (proj) => {
      proj.walls.push(created);
      ids.push(created.id);
      // reposiciona toda a cadeia sobre o eixo calculado
      ids.forEach((id, i) => {
        const w = proj.walls.find((x) => x.id === id);
        if (!w) return;
        w.a = { ...axis[i]! };
        w.b = { ...axis[(i + 1) % axis.length]! };
      });
    });
    this.lastDir = normalize(sub(p, from));
    this.typed = '';
    if (closing) this.finish();
    else this.start = p;
  }

  private finish(): void {
    this.start = null;
    this.chainStart = null;
    this.chain = [];
    this.chainWalls = [];
    this.typed = '';
  }

  cancel(): boolean {
    if (!this.start) return false;
    this.finish();
    return true;
  }

  keyDown(e: KeyboardEvent): boolean {
    if (!this.start) return false;
    if (/^[0-9.,]$/.test(e.key) || (this.typed && /^[cm]$/i.test(e.key))) {
      this.typed += e.key;
      return true;
    }
    if (e.key === 'Backspace' && this.typed) {
      this.typed = this.typed.slice(0, -1);
      return true;
    }
    if (e.key === 'Enter') {
      const l = parseLength(this.typed);
      if (l && l > 0) {
        const dir = this.pos && dist(this.pos, this.start) > 1e-6 ? normalize(sub(this.pos, this.start)) : this.lastDir;
        this.place(add(this.start, scale(dir, l)));
      } else {
        this.finish();
      }
      return true;
    }
    return false;
  }

  drawOverlay(d: Draw): void {
    if (this.snap) this.editor.drawSnap(d, this.snap);
    if (!this.start || !this.pos) return;
    let end = this.pos;
    const typed = parseLength(this.typed);
    if (typed && dist(this.pos, this.start) > 1e-6) end = add(this.start, scale(normalize(sub(this.pos, this.start)), typed));
    const l = dist(this.start, end);
    if (l < 1e-6) return;
    const dir = normalize(sub(end, this.start));
    const { thickness, align } = this.editor.wallOptions;
    const left = leftNormal(dir);
    const shift = align === 'eixo' ? 0 : (align === 'face-esquerda' ? -1 : 1) * (thickness / 2);
    const s0 = add(this.start, scale(left, shift));
    const e0 = add(end, scale(left, shift));
    const n = scale(left, thickness / 2);
    d.polygon([add(s0, n), add(e0, n), sub(e0, n), sub(s0, n)], 'rgba(22,163,74,.25)', THEME.preview, 1.5);
    d.line(this.start, end, THEME.preview, 1, [6, 4]);
    d.dimension(this.start, end, this.editor.wallOptions.thickness / 2 + 0.35, THEME.preview, 1.5);
    const ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    d.text(add(end, { x: d.vp.px(28), y: d.vp.px(18) }), `${formatNumber((ang + 360) % 360, 0)}°`, THEME.preview, THEME.font, 0, THEME.paper);
  }
}
