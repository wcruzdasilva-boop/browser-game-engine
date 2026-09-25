// Catálogo de telhas. Valores de referência de mercado (Brasil) — cada fabricante publica os
// seus; o usuário pode sobrescrever qualquer campo no projeto. Unidades: metros, kg, fração
// de inclinação (0.30 = 30%).
//
// kind 'ceramica' → peças por m² sobre ripas (galga = espaçamento das ripas).
// kind 'painel'   → chapas cortadas sob medida, fixadas direto nas terças.

export const ROOF_TILES = {
  colonial: {
    name: 'Colonial (cerâmica capa-canal)',
    kind: 'ceramica',
    piecesPerM2: 24,
    minSlope: 0.25,
    recommendedSlope: 0.30,
    gauge: 0.38,              // galga (distância entre ripas)
    weightKgM2: 55,           // saturada, para conferência da estrutura
    ridge: { name: 'Cumeeira colonial', piecesPerM: 3 },
  },
  plan: {
    name: 'Plan (cerâmica)',
    kind: 'ceramica',
    piecesPerM2: 26,
    minSlope: 0.30,
    recommendedSlope: 0.35,
    gauge: 0.33,
    weightKgM2: 55,
    ridge: { name: 'Cumeeira plan', piecesPerM: 3 },
  },
  isotelha: {
    name: 'Isotelha (termoacústica sanduíche aço + EPS 30 mm)',
    kind: 'painel',
    usefulWidth: 1.0,         // largura útil de cada chapa
    maxLength: 12,            // comprimento máximo de fabricação (acima disso: emenda)
    lengthStep: 0.05,         // chapas são vendidas com comprimento arredondado a 5 cm
    minSlope: 0.05,
    recommendedSlope: 0.10,
    maxPurlinSpacing: 1.8,    // vão máximo entre terças
    fixingsPerSupport: 4,     // parafusos autobrocantes por chapa em cada terça
    weightKgM2: 11,
    ridge: { name: 'Cumeeira trapezoidal', usefulLength: 1.0 },
  },
};
