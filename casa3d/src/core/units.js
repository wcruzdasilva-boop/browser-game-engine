// Todo o modelo trabalha em metros (float). Estes helpers só formatam/arredondam para exibição.

export const MM = 0.001;

export const roundMm = (m) => Math.round(m / MM) * MM;

export const formatMeters = (m, decimals = 2) =>
  `${m.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} m`;

export const formatArea = (m2) =>
  `${m2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

// SketchUp guarda comprimentos internamente em polegadas.
export const INCH = 0.0254;
