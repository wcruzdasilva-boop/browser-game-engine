// Editor da planta: canvas, pan/zoom, despacho de eventos para a ferramenta ativa e
// desenho sob demanda (requestAnimationFrame só quando algo muda).

import { DOOR_MODELS, WINDOW_MODELS, type OpeningModel } from '@shared/catalog/openings';
import { snapPoint, type SnapContext, type SnapResult } from '@shared/core/geometry/snap';
import { defaultOptions } from '@shared/core/model/project';
import type { MaterialKey, OpeningOptions, Vec2 } from '@shared/core/model/types';
import type { Store } from '../app/store';
import type { Draw } from './draw';
import { PlanRenderer, type Hover } from './renderer2d';
import { THEME } from './theme';
import { DimensionTool } from './tools/dimensionTool';
import { OpeningTool } from './tools/openingTool';
import { SelectTool } from './tools/selectTool';
import type { PointerInfo, Tool, ToolName } from './tools/tool';
import { WallTool } from './tools/wallTool';
import { Viewport } from './viewport';

export interface OpeningChoice {
  modelId: string;
  size: [number, number];
  material: MaterialKey;
  sill: number;
  options: OpeningOptions;
}

const choiceFor = (m: OpeningModel): OpeningChoice => ({
  modelId: m.id,
  size: [...m.default],
  material: m.materials[0] ?? 'madeira',
  sill: m.sill,
  options: defaultOptions(m),
});

const SNAP_PX = 10;

/** linha clicada: eixo da parede ou uma de suas faces (relativo ao sentido do traço) */
export type WallAlign = 'eixo' | 'face-esquerda' | 'face-direita';

export class PlanEditor extends EventTarget {
  readonly vp = new Viewport();
  readonly renderer: PlanRenderer;
  readonly tools: Record<ToolName, Tool>;
  tool: Tool;
  hover: Hover = null;
  cursorWorld: Vec2 | null = null;
  lastSnap: SnapResult | null = null;
  wallOptions: { thickness: number; height: number; align: WallAlign };
  openingChoice: { door: OpeningChoice; window: OpeningChoice } = {
    door: choiceFor(DOOR_MODELS[0]!),
    window: choiceFor(WINDOW_MODELS[0]!),
  };

  private ctx: CanvasRenderingContext2D;
  private frame = 0;
  private panning: { x: number; y: number } | null = null;
  private spaceDown = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly store: Store) {
    super();
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new PlanRenderer(this.ctx, this.vp);
    const s = store.project.settings;
    this.wallOptions = { thickness: s.wallThickness, height: s.wallHeight, align: 'eixo' };
    this.tools = {
      select: new SelectTool(this),
      wall: new WallTool(this),
      door: new OpeningTool(this, 'door'),
      window: new OpeningTool(this, 'window'),
      dimension: new DimensionTool(this),
    };
    this.tool = this.tools.select;
    this.bindEvents();
    store.addEventListener('change', () => this.requestRender());
    store.addEventListener('selection', () => this.requestRender());
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
  }

  static choiceFor = choiceFor;

  setTool(name: ToolName): void {
    if (this.tool.name === name) return;
    this.tool.deactivate?.();
    this.tool = this.tools[name];
    this.tool.activate?.();
    this.hover = null;
    this.canvas.style.cursor = this.tool.cursor;
    this.dispatchEvent(new Event('tool'));
    this.emitStatus();
    this.requestRender();
  }

  /** tolerância de captura em metros para o zoom atual */
  tolerance(): number {
    return this.vp.px(SNAP_PX);
  }

  snap(p: Vec2, extra: Partial<SnapContext> = {}): SnapResult {
    const r = snapPoint(p, {
      walls: this.store.project.walls,
      tolerance: this.tolerance(),
      gridStep: this.store.project.settings.gridStep,
      ...extra,
    });
    this.lastSnap = r;
    return r;
  }

  drawSnap(d: Draw, s: SnapResult): void {
    if (s.kind === 'grade' || s.kind === 'livre') return;
    const p = d.vp.toScreen(s.point);
    const ctx = d.ctx;
    ctx.strokeStyle = THEME.snap;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (s.kind === 'extremidade') ctx.rect(p.x - 5, p.y - 5, 10, 10);
    else if (s.kind === 'meio') {
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x + 6, p.y + 5);
      ctx.lineTo(p.x - 6, p.y + 5);
      ctx.closePath();
    } else if (s.kind === 'parede') {
      ctx.moveTo(p.x - 5, p.y - 5);
      ctx.lineTo(p.x + 5, p.y + 5);
      ctx.moveTo(p.x + 5, p.y - 5);
      ctx.lineTo(p.x - 5, p.y + 5);
    } else ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  fit(): void {
    const pts = this.store.project.walls.flatMap((w) => [w.a, w.b]);
    this.vp.fit(pts.length ? pts : [{ x: -1, y: -1 }, { x: 10, y: 8 }]);
    this.requestRender();
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  render(): void {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.render(this.store, this.hover);
    this.tool.drawOverlay?.(this.renderer.draw);
  }

  private resize(): void {
    const parent = this.canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const first = this.vp.width === 800 && this.vp.height === 600;
    this.vp.width = w;
    this.vp.height = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (first) this.fit();
    this.render();
  }

  private info(e: MouseEvent): PointerInfo {
    const r = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    return { screen, world: this.vp.toWorld(screen), button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey };
  }

  emitStatus(): void {
    this.dispatchEvent(new Event('status'));
  }

  private bindEvents(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
        this.panning = { x: e.clientX, y: e.clientY };
        c.style.cursor = 'grabbing';
        return;
      }
      if (e.button === 2) {
        if (!this.tool.cancel?.()) this.setTool('select');
      } else {
        this.tool.pointerDown?.(this.info(e));
      }
      this.emitStatus();
      this.requestRender();
    });
    c.addEventListener('pointermove', (e) => {
      if (this.panning) {
        this.vp.pan(e.clientX - this.panning.x, e.clientY - this.panning.y);
        this.panning = { x: e.clientX, y: e.clientY };
        this.requestRender();
        return;
      }
      const info = this.info(e);
      this.cursorWorld = info.world;
      this.lastSnap = null;
      this.tool.pointerMove?.(info);
      this.emitStatus();
      this.requestRender();
    });
    c.addEventListener('pointerup', (e) => {
      if (this.panning) {
        this.panning = null;
        c.style.cursor = this.tool.cursor;
        return;
      }
      this.tool.pointerUp?.(this.info(e));
      this.requestRender();
    });
    c.addEventListener('dblclick', (e) => {
      this.tool.doubleClick?.(this.info(e));
      this.requestRender();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const info = this.info(e);
      this.vp.zoomAt(info.screen, Math.exp(-e.deltaY * 0.0015));
      this.requestRender();
    }, { passive: false });
    c.addEventListener('pointerleave', () => {
      this.cursorWorld = null;
      this.hover = null;
      this.requestRender();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') this.spaceDown = false;
    });
  }

  /** Teclas para o editor (chamado pelo atalho global quando o foco não está num campo). */
  keyDown(e: KeyboardEvent): boolean {
    if (e.key === ' ') {
      this.spaceDown = true;
      return true;
    }
    if (this.tool.keyDown?.(e)) {
      this.emitStatus();
      this.requestRender();
      return true;
    }
    if (e.key === 'Escape') {
      if (!this.tool.cancel?.()) this.setTool('select');
      this.emitStatus();
      this.requestRender();
      return true;
    }
    return false;
  }
}
