// Ferramenta Selecionar: clique seleciona (vão > cota > parede > cômodo); arrastar move
// extremidades (as paredes ligadas acompanham), paredes inteiras, vãos ao longo da parede
// e linhas de cota.

import { wallFrame } from '@shared/core/geometry/wallFrame';
import { dist, dot, leftNormal, normalize, sub } from '@shared/core/geometry/vec';
import { roomAt } from '@shared/core/geometry/plan';
import type { Vec2 } from '@shared/core/model/types';
import { placeOnWall } from '@shared/core/openings/openings';
import { applyAttachments, findAttachments, wallsAt, type Attachment } from '@shared/core/model/wallEdits';
import { roundTo } from '@shared/core/units';
import type { Draw } from '../draw';
import { nearestWall, pickDimension, pickEndpoint, pickOpening, pickWall } from '../pick';
import type { Hover } from '../renderer2d';
import { BaseTool, type PointerInfo } from './tool';

type Drag =
  | { kind: 'endpoint'; from: Vec2; moving: Set<string>; attached: Attachment[] }
  | { kind: 'wall'; id: string; start: Vec2; a0: Vec2; b0: Vec2; attached: Attachment[] }
  | { kind: 'opening'; id: string }
  | { kind: 'dimension'; id: string };

const TOL_JOIN = 1e-3;

export class SelectTool extends BaseTool {
  readonly name = 'select' as const;
  override readonly cursor = 'default';
  private drag: Drag | null = null;

  hint(): string {
    return 'Clique para selecionar; arraste extremidades, paredes, vãos e cotas. Delete exclui. Duplo clique no cômodo renomeia.';
  }

  /** Alvo sob o cursor, na mesma prioridade do clique. */
  hoverAt(p: Vec2): Hover {
    const tol = this.editor.tolerance();
    const project = this.store.project;
    const end = pickEndpoint(project, p, tol);
    if (end) return { kind: 'endpoint', at: end };
    const o = pickOpening(project, p, tol / 2);
    if (o) return { kind: 'opening', id: o.id };
    const dim = pickDimension(project, p, tol / 2);
    if (dim) return { kind: 'dimension', id: dim.id };
    const w = pickWall(project, this.store.plan, p, tol / 2);
    if (w) return { kind: 'wall', id: w.id };
    if (roomAt(this.store.plan, p)) return { kind: 'room', at: p };
    return null;
  }

  pointerMove(e: PointerInfo): void {
    if (!this.drag) {
      this.editor.hover = this.hoverAt(e.world);
      this.snap = null;
      return;
    }
    const drag = this.drag;
    if (drag.kind === 'endpoint') {
      this.snap = this.editor.snap(e.world, { ignore: drag.moving, ortho: false });
      const to = this.snap.point;
      this.store.touch((p) => {
        for (const w of p.walls) {
          if (dist(w.a, drag.from) < TOL_JOIN) w.a = { ...to };
          if (dist(w.b, drag.from) < TOL_JOIN) w.b = { ...to };
        }
        applyAttachments(p.walls, drag.attached);
      });
      drag.from = to;
    } else if (drag.kind === 'wall') {
      const step = this.store.project.settings.gridStep;
      const dx = roundTo(e.world.x - drag.start.x, step);
      const dy = roundTo(e.world.y - drag.start.y, step);
      this.store.touch((p) => {
        const w = p.walls.find((x) => x.id === drag.id);
        if (!w) return;
        const na = { x: drag.a0.x + dx, y: drag.a0.y + dy };
        const nb = { x: drag.b0.x + dx, y: drag.b0.y + dy };
        // paredes ligadas às extremidades acompanham (esticam)
        for (const o of p.walls) {
          if (o === w) continue;
          if (dist(o.a, w.a) < TOL_JOIN) o.a = { ...na };
          if (dist(o.b, w.a) < TOL_JOIN) o.b = { ...na };
          if (dist(o.a, w.b) < TOL_JOIN) o.a = { ...nb };
          if (dist(o.b, w.b) < TOL_JOIN) o.b = { ...nb };
        }
        w.a = na;
        w.b = nb;
        applyAttachments(p.walls, drag.attached);
      });
    } else if (drag.kind === 'opening') {
      this.store.touch((p) => {
        const o = p.openings.find((x) => x.id === drag.id);
        if (!o) return;
        // pode trocar de parede se o cursor estiver sobre outra
        const target = nearestWall(p, e.world, this.editor.tolerance() * 2) ?? p.walls.find((w) => w.id === o.wallId);
        if (!target) return;
        o.wallId = target.id;
        o.offset = placeOnWall(target, o.width, wallFrame(target).local(e.world).u);
      });
    } else {
      this.store.touch((p) => {
        const dim = p.dimensions.find((x) => x.id === drag.id);
        if (!dim) return;
        const n = leftNormal(normalize(sub(dim.b, dim.a)));
        dim.offset = roundTo(dot(sub(e.world, dim.a), n), 0.05);
      });
    }
  }

  pointerDown(e: PointerInfo): void {
    if (e.button !== 0) return;
    const hit = this.hoverAt(e.world);
    const project = this.store.project;
    if (!hit) {
      this.store.select(null);
      return;
    }
    switch (hit.kind) {
      case 'endpoint':
        this.store.begin('Mover extremidade');
        {
          const moving = wallsAt(project.walls, hit.at);
          this.drag = { kind: 'endpoint', from: hit.at, moving, attached: findAttachments(project.walls, moving) };
        }
        break;
      case 'opening':
        this.store.select({ kind: 'opening', id: hit.id });
        this.store.begin('Mover vão');
        this.drag = { kind: 'opening', id: hit.id };
        break;
      case 'dimension':
        this.store.select({ kind: 'dimension', id: hit.id });
        this.store.begin('Mover cota');
        this.drag = { kind: 'dimension', id: hit.id };
        break;
      case 'wall': {
        const w = project.walls.find((x) => x.id === hit.id)!;
        this.store.select({ kind: 'wall', id: hit.id });
        this.store.begin('Mover parede');
        // a parede e as ligadas às suas pontas se deformam; as apoiadas nelas acompanham
        const hosts = new Set([w.id, ...wallsAt(project.walls, w.a), ...wallsAt(project.walls, w.b)]);
        this.drag = { kind: 'wall', id: w.id, start: e.world, a0: { ...w.a }, b0: { ...w.b }, attached: findAttachments(project.walls, hosts) };
        break;
      }
      case 'room':
        this.store.select({ kind: 'room', at: e.world });
        break;
    }
  }

  pointerUp(): void {
    if (this.drag) {
      this.drag = null;
      this.snap = null;
      this.store.end();
    }
  }

  doubleClick(e: PointerInfo): void {
    if (roomAt(this.store.plan, e.world)) {
      this.store.select({ kind: 'room', at: e.world });
      this.editor.dispatchEvent(new Event('rename-room'));
    }
  }

  cancel(): boolean {
    if (this.store.selection) {
      this.store.select(null);
      return true;
    }
    return false;
  }

  drawOverlay(d: Draw): void {
    if (this.snap) this.editor.drawSnap(d, this.snap);
  }
}
