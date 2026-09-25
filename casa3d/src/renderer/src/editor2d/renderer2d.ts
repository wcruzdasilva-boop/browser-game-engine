// Desenho da planta: grade, cômodos, paredes com junções, vãos, cotas e seleção.

import { findOpeningModel } from '@shared/catalog/openings';
import { formatArea } from '@shared/core/units';
import type { Opening, Vec2 } from '@shared/core/model/types';
import { add, dist, leftNormal, normalize, scale, sub, cross } from '@shared/core/geometry/vec';
import { invalidOpenings, resolveOpening } from '@shared/core/openings/openings';
import { roomAt } from '@shared/core/geometry/plan';
import type { Store } from '../app/store';
import { Draw } from './draw';
import { drawOpening } from './symbols';
import { THEME } from './theme';
import type { Viewport } from './viewport';

export type Hover =
  | { kind: 'wall' | 'opening' | 'dimension'; id: string }
  | { kind: 'endpoint'; at: Vec2 }
  | { kind: 'room'; at: Vec2 }
  | null;

const GRID_STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25];

/** Remove vértices colineares (para cotar cada fachada inteira). */
function simplify(poly: Vec2[]): Vec2[] {
  return poly.filter((p, i) => {
    const prev = poly[(i - 1 + poly.length) % poly.length]!;
    const next = poly[(i + 1) % poly.length]!;
    return Math.abs(cross(sub(p, prev), sub(next, p))) > 1e-6 && dist(p, prev) > 1e-6;
  });
}

export class PlanRenderer {
  readonly draw: Draw;

  constructor(private ctx: CanvasRenderingContext2D, private vp: Viewport) {
    this.draw = new Draw(ctx, vp);
  }

  render(store: Store, hover: Hover): void {
    const { ctx, vp, draw: d } = this;
    const project = store.project;
    const plan = store.plan;
    const sel = store.selection;

    ctx.fillStyle = THEME.paper;
    ctx.fillRect(0, 0, vp.width, vp.height);
    this.grid();

    // cômodos
    const selRoom = store.selectedRoom();
    const hoverRoom = hover?.kind === 'room' ? roomAt(plan, hover.at) : undefined;
    for (const room of plan.rooms) {
      d.polygon(room.inner, room === selRoom ? THEME.roomFillSelected : room === hoverRoom ? THEME.roomFillHover : THEME.roomFill);
    }

    // paredes: preenchimento e contorno (sem arestas internas nas junções)
    // contorno fino na mesma cor esconde as emendas de antialiasing entre as peças
    for (const s of plan.segments) d.polygon(s.polygon, THEME.wallFill, THEME.wallFill, 0.75);
    for (const hub of plan.hubs) d.polygon(hub, THEME.wallFill, THEME.wallFill, 0.75);
    for (const s of plan.segments) {
      const [al, bl, br, ar] = s.polygon;
      const highlighted = (sel?.kind === 'wall' && sel.id === s.wallId) || (hover?.kind === 'wall' && hover.id === s.wallId);
      const color = sel?.kind === 'wall' && sel.id === s.wallId ? THEME.selection : THEME.wallStroke;
      if (highlighted) d.polygon(s.polygon, sel?.kind === 'wall' && sel.id === s.wallId ? 'rgba(245,158,11,.55)' : 'rgba(251,191,36,.35)');
      d.line(al, bl, color, 1.25);
      d.line(br, ar, color, 1.25);
      if (s.capA) d.line(ar, al, color, 1.25);
      if (s.capB) d.line(bl, br, color, 1.25);
    }

    // portas e janelas
    const invalid = invalidOpenings(project);
    for (const o of project.openings) {
      const wall = project.walls.find((w) => w.id === o.wallId);
      if (!wall) continue;
      const selected = sel?.kind === 'opening' && sel.id === o.id;
      const hovered = hover?.kind === 'opening' && hover.id === o.id;
      const color = invalid.has(o.id) ? THEME.openingInvalid : selected ? THEME.selection : hovered ? THEME.hover : THEME.opening;
      drawOpening(d, wall, o, resolveOpening(plan, wall, o), color);
    }

    // rótulos dos cômodos
    for (const room of plan.rooms) {
      d.text(room.label, room.name, THEME.roomText, THEME.fontBold);
      d.text(add(room.label, { x: 0, y: -vp.px(16) }), formatArea(room.area), THEME.roomText);
    }

    // cotas automáticas das fachadas
    for (const outline of plan.outlines) {
      const poly = simplify(outline.inner);
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length]!;
        if (dist(a, b) >= 0.3) d.dimension(a, b, 0.6, THEME.dimension);
      });
    }

    // cotas manuais
    for (const dim of project.dimensions) {
      const selected = sel?.kind === 'dimension' && sel.id === dim.id;
      const hovered = hover?.kind === 'dimension' && hover.id === dim.id;
      d.dimension(dim.a, dim.b, dim.offset, selected ? THEME.selection : hovered ? THEME.hover : THEME.dimension, selected ? 2 : 1);
    }

    // alças das extremidades da parede selecionada
    if (sel?.kind === 'wall') {
      const w = project.walls.find((x) => x.id === sel.id);
      if (w) for (const p of [w.a, w.b]) d.dot(p, 5, THEME.paper, THEME.selection);
    }
    if (hover?.kind === 'endpoint') d.dot(hover.at, 5, THEME.hover, THEME.selection);
  }

  /** Desenha um vão ainda não inserido (pré-visualização da ferramenta). */
  previewOpening(store: Store, o: Opening, valid: boolean): void {
    const wall = store.project.walls.find((w) => w.id === o.wallId);
    if (!wall) return;
    const color = valid ? THEME.preview : THEME.previewInvalid;
    drawOpening(this.draw, wall, o, resolveOpening(store.plan, wall, o), color);
    const model = findOpeningModel(o.modelId);
    const f = normalize(sub(wall.b, wall.a));
    const n = leftNormal(f);
    const mid = add(add(wall.a, scale(f, o.offset + o.width / 2)), scale(n, -(wall.thickness / 2 + this.vp.px(14))));
    this.draw.text(mid, `${model?.name ?? ''} ${o.width.toFixed(2).replace('.', ',')} × ${o.height.toFixed(2).replace('.', ',')}`, color, THEME.font, Math.atan2(f.y, f.x), THEME.paper);
  }

  private grid(): void {
    const { vp, draw: d } = this;
    const minor = GRID_STEPS.find((s) => s * vp.scale >= 12) ?? 25;
    const major = minor < 1 ? 1 : minor * 5;
    const tl = vp.toWorld({ x: 0, y: 0 });
    const br = vp.toWorld({ x: vp.width, y: vp.height });
    const lines = (step: number, color: string) => {
      for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) d.line({ x, y: br.y }, { x, y: tl.y }, color, 1);
      for (let y = Math.floor(br.y / step) * step; y <= tl.y; y += step) d.line({ x: tl.x, y }, { x: br.x, y }, color, 1);
    };
    lines(minor, THEME.gridMinor);
    lines(major, THEME.gridMajor);
    d.line({ x: 0, y: br.y }, { x: 0, y: tl.y }, THEME.axis, 1);
    d.line({ x: tl.x, y: 0 }, { x: br.x, y: 0 }, THEME.axis, 1);
  }
}
