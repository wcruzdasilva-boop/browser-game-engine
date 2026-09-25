// Primitivas de desenho em coordenadas do mundo (m) sobre o canvas.

import { formatNumber } from '@shared/core/units';
import type { Vec2 } from '@shared/core/model/types';
import { add, dist, leftNormal, normalize, scale, sub } from '@shared/core/geometry/vec';
import type { Viewport } from './viewport';
import { THEME } from './theme';

export class Draw {
  constructor(public ctx: CanvasRenderingContext2D, public vp: Viewport) {}

  path(points: Vec2[], close = false): void {
    const { ctx, vp } = this;
    ctx.beginPath();
    points.forEach((p, i) => {
      const s = vp.toScreen(p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    if (close) ctx.closePath();
  }

  line(a: Vec2, b: Vec2, color: string, width = 1, dash: number[] = []): void {
    const { ctx } = this;
    this.path([a, b]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  polygon(points: Vec2[], fill?: string, stroke?: string, width = 1): void {
    const { ctx } = this;
    this.path(points, true);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  /** arco em torno de `center` de `from` até `to` (ângulos em rad, no mundo) */
  arc(center: Vec2, radius: number, from: number, to: number, color: string, width = 1, dash: number[] = []): void {
    const pts: Vec2[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
    }
    this.path(pts);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.setLineDash(dash);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  dot(p: Vec2, radiusPx: number, fill: string, stroke?: string): void {
    const s = this.vp.toScreen(p);
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /** texto centrado em p; `angle` no mundo (rad), mantido legível */
  text(p: Vec2, text: string, color: string, font = THEME.font, angle = 0, background?: string): void {
    const { ctx } = this;
    const s = this.vp.toScreen(p);
    // mantém o texto legível: da esquerda para a direita, ou de baixo para cima
    let a = -angle;
    while (a >= Math.PI / 2 - 1e-6) a -= Math.PI;
    while (a < -Math.PI / 2 - 1e-6) a += Math.PI;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (background) {
      const w = ctx.measureText(text).width + 6;
      ctx.fillStyle = background;
      ctx.fillRect(-w / 2, -8, w, 16);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** linha de cota de a até b, deslocada `offset` m para a esquerda de a→b */
  dimension(a: Vec2, b: Vec2, offset: number, color = THEME.dimension, width = 1): void {
    const l = dist(a, b);
    if (l < 1e-6) return;
    const d = normalize(sub(b, a));
    const n = leftNormal(d);
    const off = scale(n, offset);
    const pa = add(a, off);
    const pb = add(b, off);
    const ext = scale(n, Math.sign(offset || 1) * this.vp.px(6));
    const gap = scale(n, Math.sign(offset || 1) * this.vp.px(3));
    this.line(add(a, gap), add(pa, ext), color, 0.75);
    this.line(add(b, gap), add(pb, ext), color, 0.75);
    this.line(pa, pb, color, width);
    const t = this.vp.px(4);
    const tick = add(scale(d, t), scale(n, t));
    this.line(sub(pa, tick), add(pa, tick), color, 1.5);
    this.line(sub(pb, tick), add(pb, tick), color, 1.5);
    const mid = add(scale(add(pa, pb), 0.5), scale(n, this.vp.px(8) * Math.sign(offset || 1)));
    this.text(mid, formatNumber(l), color, THEME.font, Math.atan2(d.y, d.x), THEME.paper);
  }
}
