// Estado da aplicação: projeto (com desfazer/refazer), análise da planta em cache,
// seleção e arquivo atual. Emite 'change' a cada modificação e 'selection' ao selecionar.

import { History } from '@shared/core/history';
import { analyzePlan, roomAt, type PlanAnalysis, type Room } from '@shared/core/geometry/plan';
import { createProject } from '@shared/core/model/project';
import type { Project, Vec2 } from '@shared/core/model/types';

export type Selection =
  | { kind: 'wall'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'dimension'; id: string }
  | { kind: 'room'; at: Vec2 }
  | null;

export class Store extends EventTarget {
  readonly history = new History<Project>(createProject());
  selection: Selection = null;
  filePath: string | null = null;
  dirty = false;
  private planCache: PlanAnalysis | null = null;
  private planKey = '';

  get project(): Project {
    return this.history.current;
  }

  get plan(): PlanAnalysis {
    const key = JSON.stringify([this.project.walls, this.project.rooms]);
    if (!this.planCache || key !== this.planKey) {
      this.planCache = analyzePlan(this.project);
      this.planKey = key;
    }
    return this.planCache;
  }

  selectedRoom(): Room | undefined {
    return this.selection?.kind === 'room' ? roomAt(this.plan, this.selection.at) : undefined;
  }

  private changed(): void {
    this.dirty = true;
    this.validateSelection();
    this.dispatchEvent(new Event('change'));
  }

  edit(label: string, fn: (p: Project) => void): void {
    this.history.edit(label, fn);
    this.changed();
  }

  /** Início de uma edição contínua (arraste): guarda o ponto de desfazer. */
  begin(label: string): void {
    this.history.checkpoint(label);
  }

  /** Mutação durante a edição contínua (sem novo ponto de desfazer). */
  touch(fn: (p: Project) => void): void {
    fn(this.project);
    this.changed();
  }

  end(): void {
    this.history.dropIfUnchanged();
    this.dispatchEvent(new Event('change'));
  }

  undo(): void {
    if (this.history.undo() != null) this.changed();
  }

  redo(): void {
    if (this.history.redo() != null) this.changed();
  }

  load(project: Project, path: string | null): void {
    this.history.reset(project);
    this.filePath = path;
    this.dirty = false;
    this.selection = null;
    this.dispatchEvent(new Event('change'));
    this.dispatchEvent(new Event('selection'));
  }

  markSaved(path: string): void {
    this.filePath = path;
    this.dirty = false;
    this.dispatchEvent(new Event('change'));
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.dispatchEvent(new Event('selection'));
  }

  private validateSelection(): void {
    const s = this.selection;
    if (!s) return;
    const p = this.project;
    const alive =
      s.kind === 'wall' ? p.walls.some((w) => w.id === s.id)
      : s.kind === 'opening' ? p.openings.some((o) => o.id === s.id)
      : s.kind === 'dimension' ? p.dimensions.some((d) => d.id === s.id)
      : !!roomAt(this.plan, s.at);
    if (!alive) this.select(null);
  }

  deleteSelection(): void {
    const s = this.selection;
    if (!s || s.kind === 'room') return;
    this.edit('Excluir', (p) => {
      if (s.kind === 'wall') {
        p.walls = p.walls.filter((w) => w.id !== s.id);
        p.openings = p.openings.filter((o) => o.wallId !== s.id);
      } else if (s.kind === 'opening') {
        p.openings = p.openings.filter((o) => o.id !== s.id);
      } else {
        p.dimensions = p.dimensions.filter((d) => d.id !== s.id);
      }
    });
    this.select(null);
  }
}
