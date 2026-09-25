// Catálogo de portas e janelas. Cada modelo é paramétrico: o usuário escolhe um tamanho
// padrão (ou digita outro), o material e as opções de abertura. Medidas do vão em metros
// (largura × altura); `sill` é o peitoril (altura do piso até a base do vão).
//
// Referências: portas de madeira NBR 15930 (0,60 / 0,70 / 0,80 / 0,90 × 2,10);
// vão livre mínimo acessível NBR 9050 = 0,80. Janelas com verga alinhada às portas (2,10).

export const MATERIALS = {
  madeira: { name: 'Madeira', color: 0x8a5a33, roughness: 0.7, metalness: 0 },
  aco: { name: 'Aço', color: 0x6b7075, roughness: 0.45, metalness: 0.9 },
  aluminio: { name: 'Alumínio', color: 0xc9ccd0, roughness: 0.35, metalness: 0.9 },
  vidro: { name: 'Vidro temperado', color: 0xbfd9e0, roughness: 0.05, metalness: 0, opacity: 0.25 },
};

const LEAF = ['esquerda', 'direita'];
const SWING = ['dentro', 'fora'];

export const DOOR_MODELS = [
  {
    id: 'porta-giro-1f', name: 'Porta de abrir — 1 folha', operation: 'giro', leaves: 1,
    materials: ['madeira', 'aco', 'aluminio', 'vidro'],
    sizes: [[0.60, 2.10], [0.70, 2.10], [0.80, 2.10], [0.90, 2.10]], default: [0.80, 2.10],
    options: { hinge: LEAF, swing: SWING },
  },
  {
    id: 'porta-giro-2f', name: 'Porta de abrir — 2 folhas', operation: 'giro', leaves: 2,
    materials: ['madeira', 'aco', 'aluminio', 'vidro'],
    sizes: [[1.20, 2.10], [1.40, 2.10], [1.60, 2.10]], default: [1.20, 2.10],
    options: { swing: SWING },
  },
  {
    id: 'porta-correr-1f', name: 'Porta de correr — 1 folha', operation: 'correr', leaves: 1,
    materials: ['madeira', 'aco', 'aluminio', 'vidro'],
    sizes: [[0.70, 2.10], [0.80, 2.10], [0.90, 2.10]], default: [0.80, 2.10],
    options: { slideTo: LEAF, mount: ['aparente', 'embutida'] },
  },
  {
    id: 'porta-correr-2f', name: 'Porta de correr — 2 folhas', operation: 'correr', leaves: 2,
    materials: ['aluminio', 'aco', 'vidro', 'madeira'],
    sizes: [[1.20, 2.10], [1.50, 2.10], [2.00, 2.10], [2.40, 2.10]], default: [1.50, 2.10],
    options: {},
  },
  {
    id: 'porta-pivotante', name: 'Porta pivotante', operation: 'pivotante', leaves: 1,
    materials: ['madeira', 'aco', 'vidro'],
    sizes: [[1.00, 2.40], [1.20, 2.40], [1.50, 2.70]], default: [1.20, 2.40],
    options: { swing: SWING },
  },
];

export const WINDOW_MODELS = [
  {
    id: 'janela-correr-2f', name: 'Janela de correr — 2 folhas', operation: 'correr', leaves: 2,
    materials: ['aluminio', 'aco', 'madeira'],
    sizes: [[1.00, 1.00], [1.20, 1.00], [1.20, 1.20], [1.50, 1.20], [2.00, 1.20]], default: [1.20, 1.00],
    sill: 1.10, options: {},
  },
  {
    id: 'janela-correr-4f', name: 'Janela de correr — 4 folhas', operation: 'correr', leaves: 4,
    materials: ['aluminio', 'aco'],
    sizes: [[1.50, 1.20], [2.00, 1.20], [2.40, 1.20]], default: [2.00, 1.20],
    sill: 0.90, options: {},
  },
  {
    id: 'janela-giro-2f', name: 'Janela de abrir — 2 folhas', operation: 'giro', leaves: 2,
    materials: ['madeira', 'aluminio', 'aco'],
    sizes: [[1.00, 1.00], [1.20, 1.00], [1.20, 1.20]], default: [1.00, 1.00],
    sill: 1.10, options: { swing: SWING },
  },
  {
    id: 'janela-basculante', name: 'Basculante (banheiro/área)', operation: 'basculante', leaves: 1,
    materials: ['aluminio', 'aco'],
    sizes: [[0.40, 0.40], [0.60, 0.60], [0.80, 0.60], [1.00, 0.60]], default: [0.60, 0.60],
    sill: 1.50, options: {},
  },
  {
    id: 'janela-maxim-ar', name: 'Maxim-ar', operation: 'maxim-ar', leaves: 1,
    materials: ['aluminio', 'aco'],
    sizes: [[0.60, 0.60], [0.80, 0.60], [1.00, 0.60], [1.00, 0.80]], default: [0.60, 0.60],
    sill: 1.50, options: {},
  },
  {
    id: 'janela-fixa', name: 'Vidro fixo', operation: 'fixa', leaves: 1,
    materials: ['aluminio', 'vidro'],
    sizes: [[0.60, 1.00], [1.00, 1.00], [1.50, 1.50]], default: [1.00, 1.00],
    sill: 1.10, options: {},
  },
];

export const findOpeningModel = (id) =>
  DOOR_MODELS.find((m) => m.id === id) ?? WINDOW_MODELS.find((m) => m.id === id);
