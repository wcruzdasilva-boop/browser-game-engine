// Transformação mundo (m, Y para cima) ↔ tela (px, Y para baixo), com pan e zoom.

import type { Vec2 } from '@shared/core/model/types';

export class Viewport {
  /** pixels por metro */
  scale = 60;
  /** posição na tela da origem do mundo */
  ox = 200;
  oy = 500;
  width = 800;
  height = 600;

  toScreen(p: Vec2): Vec2 {
    return { x: this.ox + p.x * this.scale, y: this.oy - p.y * this.scale };
  }

  toWorld(s: Vec2): Vec2 {
    return { x: (s.x - this.ox) / this.scale, y: (this.oy - s.y) / this.scale };
  }

  /** metros correspondentes a `px` pixels */
  px(px: number): number {
    return px / this.scale;
  }

  zoomAt(screen: Vec2, factor: number): void {
    const before = this.toWorld(screen);
    this.scale = Math.min(2000, Math.max(5, this.scale * factor));
    this.ox = screen.x - before.x * this.scale;
    this.oy = screen.y + before.y * this.scale;
  }

  pan(dx: number, dy: number): void {
    this.ox += dx;
    this.oy += dy;
  }

  fit(points: Vec2[], margin = 60): void {
    if (points.length === 0) {
      this.scale = 60;
      this.ox = this.width / 2;
      this.oy = this.height / 2;
      return;
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 1);
    const hgt = Math.max(maxY - minY, 1);
    this.scale = Math.min((this.width - 2 * margin) / w, (this.height - 2 * margin) / hgt, 400);
    this.ox = this.width / 2 - ((minX + maxX) / 2) * this.scale;
    this.oy = this.height / 2 + ((minY + maxY) / 2) * this.scale;
  }
}
