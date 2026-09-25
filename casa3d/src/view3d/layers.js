// Camadas da visualização 3D. O seletor de "nível" revela da camada 0 até a escolhida;
// cada camada também pode ser ligada/desligada isoladamente. A camada de forro é extra
// (não entra na sequência) porque esconde o interior visto de cima.

export const LAYERS = [
  { id: 0, key: 'fundacao', name: 'Planta baixa e fundação' },
  { id: 1, key: 'paredes', name: 'Paredes, portas e janelas' },
  { id: 2, key: 'moveis', name: 'Móveis' },
  { id: 3, key: 'estrutura-telhado', name: 'Estrutura do telhado' },
  { id: 4, key: 'cobertura', name: 'Cobertura' },
  { id: 5, key: 'forro', name: 'Forro', extra: true },
];

export function visibleLayers(level, toggles = {}) {
  return LAYERS.filter((l) => toggles[l.key] ?? (!l.extra && l.id <= level)).map((l) => l.key);
}
