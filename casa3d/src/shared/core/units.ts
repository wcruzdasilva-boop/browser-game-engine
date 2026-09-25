// Todo o modelo trabalha em metros (float). Estes helpers só formatam/arredondam para exibição.

export const MM = 0.001;

/** SketchUp guarda comprimentos internamente em polegadas. */
export const INCH = 0.0254;

export const roundMm = (m: number): number => Math.round(m / MM) * MM;

/** remove o ruído de ponto flutuante (ex.: 20.950000000000003 → 20.95) */
export const clean = (v: number): number => Math.round(v * 1e6) / 1e6;

export const roundTo = (v: number, step: number): number => clean(Math.round(v / step) * step);

export const formatNumber = (v: number, decimals = 2): string =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const formatMeters = (m: number, decimals = 2): string => `${formatNumber(m, decimals)} m`;

export const formatArea = (m2: number): string => `${formatNumber(m2, 2)} m²`;

/** Aceita "3,45", "3.45" ou "345cm"; devolve metros ou null. */
export function parseLength(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  const m = /^(\d+(?:\.\d*)?|\.\d+)\s*(m|cm|mm)?$/.exec(t);
  if (!m?.[1]) return null;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? 'm';
  return unit === 'cm' ? v / 100 : unit === 'mm' ? v / 1000 : v;
}
