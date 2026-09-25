import type { Vec2 } from '@shared/core/model/types';
import type { SnapResult } from '@shared/core/geometry/snap';
import type { Draw } from '../draw';
import type { PlanEditor } from '../editor';

export interface PointerInfo {
  world: Vec2;
  screen: Vec2;
  button: number;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

export type ToolName = 'select' | 'wall' | 'door' | 'window' | 'dimension';

export interface Tool {
  readonly name: ToolName;
  readonly cursor: string;
  activate?(): void;
  deactivate?(): void;
  pointerDown?(e: PointerInfo): void;
  pointerMove?(e: PointerInfo): void;
  pointerUp?(e: PointerInfo): void;
  doubleClick?(e: PointerInfo): void;
  /** true se a tecla foi tratada */
  keyDown?(e: KeyboardEvent): boolean;
  /** botão direito / Esc: cancela a operação em curso; false se não havia nada a cancelar */
  cancel?(): boolean;
  drawOverlay?(d: Draw): void;
  hint(): string;
}

export abstract class BaseTool implements Tool {
  abstract readonly name: ToolName;
  readonly cursor: string = 'crosshair';
  snap: SnapResult | null = null;

  constructor(protected editor: PlanEditor) {}

  protected get store() {
    return this.editor.store;
  }

  abstract hint(): string;
}
