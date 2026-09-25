// Criação de elementos sem framework: h('button', { class: 'x', onclick }, 'Texto').

export type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** append que ignora null/false (útil para campos condicionais) */
export function append(el: Element, ...children: (Child | Child[])[]): void {
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
}

export function select<T extends string>(value: T, options: [T, string][], onchange: (v: T) => void, attrs: Attrs = {}): HTMLSelectElement {
  return h('select', { ...attrs, onchange: (e: Event) => onchange((e.target as HTMLSelectElement).value as T) },
    options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
}

/** Campo numérico em metros que aceita vírgula; chama onchange só com valor válido. */
export function numberInput(value: number, onchange: (v: number) => void, attrs: Attrs & { min?: number; decimals?: number } = {}): HTMLInputElement {
  const decimals = attrs.decimals ?? 2;
  const input = h('input', {
    type: 'text', inputMode: 'decimal', class: 'num', ...attrs,
    value: value.toFixed(decimals).replace('.', ','),
  });
  const commit = () => {
    const v = parseFloat(input.value.replace(',', '.'));
    if (Number.isFinite(v) && (attrs.min == null || v >= attrs.min)) onchange(v);
    else input.value = value.toFixed(decimals).replace('.', ',');
  };
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    e.stopPropagation();
  });
  return input;
}

export function field(label: string, control: Node): HTMLLabelElement {
  return h('label', { class: 'field' }, h('span', {}, label), control);
}
