// Desfazer/refazer por instantâneos. O projeto é JSON pequeno, então clonar o estado a cada
// edição é simples e robusto (não há inversa de comando para manter em sincronia).

export class History<T> {
  private past: { label: string; state: T }[] = [];
  private future: { label: string; state: T }[] = [];

  constructor(public current: T, private readonly limit = 200) {}

  /** Guarda o estado atual como ponto de retorno; chame antes de mutar `current`. */
  checkpoint(label: string): void {
    this.past.push({ label, state: structuredClone(this.current) });
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** checkpoint + mutação */
  edit(label: string, fn: (draft: T) => void): void {
    this.checkpoint(label);
    fn(this.current);
  }

  /** Descarta o último checkpoint se nada mudou (ex.: arraste sem movimento). */
  dropIfUnchanged(): void {
    const last = this.past[this.past.length - 1];
    if (last && JSON.stringify(last.state) === JSON.stringify(this.current)) this.past.pop();
  }

  undo(): string | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push({ label: prev.label, state: this.current });
    this.current = prev.state;
    return prev.label;
  }

  redo(): string | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({ label: next.label, state: this.current });
    this.current = next.state;
    return next.label;
  }

  reset(state: T): void {
    this.current = state;
    this.past = [];
    this.future = [];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.past[this.past.length - 1]?.label;
  }

  get redoLabel(): string | undefined {
    return this.future[this.future.length - 1]?.label;
  }
}
