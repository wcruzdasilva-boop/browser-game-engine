// Catálogo de móveis (camada 2). Lista curta, com medidas usuais de mercado; w = largura,
// d = profundidade, h = altura (m). `mount: 'parede'` faz o móvel encostar e alinhar na
// parede mais próxima ao ser posicionado; `clearance` é a faixa livre de uso à frente do
// móvel, usada para avisar sobreposição com outros móveis e portas.

export const FURNITURE_CATEGORIES = {
  banheiro: 'Banheiro',
  cozinha: 'Cozinha',
  quarto: 'Quarto',
  sala: 'Sala',
};

export const FURNITURE = [
  // Banheiro
  { id: 'vaso-caixa-acoplada', category: 'banheiro', name: 'Vaso sanitário c/ caixa acoplada', w: 0.37, d: 0.65, h: 0.78, mount: 'parede', clearance: 0.60 },
  { id: 'vaso-convencional', category: 'banheiro', name: 'Vaso sanitário convencional', w: 0.36, d: 0.52, h: 0.40, mount: 'parede', clearance: 0.60 },
  { id: 'lavatorio-gabinete-60', category: 'banheiro', name: 'Gabinete c/ cuba 60 cm', w: 0.60, d: 0.45, h: 0.85, mount: 'parede', clearance: 0.60 },
  { id: 'lavatorio-gabinete-80', category: 'banheiro', name: 'Gabinete c/ cuba 80 cm', w: 0.80, d: 0.45, h: 0.85, mount: 'parede', clearance: 0.60 },
  { id: 'lavatorio-coluna', category: 'banheiro', name: 'Lavatório de coluna', w: 0.50, d: 0.40, h: 0.85, mount: 'parede', clearance: 0.60 },
  { id: 'box-90x90', category: 'banheiro', name: 'Box de vidro 0,90 × 0,90', w: 0.90, d: 0.90, h: 1.90, mount: 'canto', clearance: 0.55 },
  { id: 'box-80x120', category: 'banheiro', name: 'Box de vidro 0,80 × 1,20', w: 1.20, d: 0.80, h: 1.90, mount: 'canto', clearance: 0.55 },
  { id: 'chuveiro', category: 'banheiro', name: 'Chuveiro', w: 0.20, d: 0.30, h: 2.10, mount: 'parede', clearance: 0 },
  { id: 'espelheira-60', category: 'banheiro', name: 'Espelheira 60 cm', w: 0.60, d: 0.15, h: 0.70, mount: 'parede', elevation: 1.10, clearance: 0 },
  // Cozinha
  { id: 'pia-120', category: 'cozinha', name: 'Pia c/ gabinete 1,20 m', w: 1.20, d: 0.55, h: 0.90, mount: 'parede', clearance: 0.90 },
  { id: 'fogao-4b', category: 'cozinha', name: 'Fogão 4 bocas', w: 0.51, d: 0.60, h: 0.85, mount: 'parede', clearance: 0.90 },
  { id: 'geladeira', category: 'cozinha', name: 'Geladeira', w: 0.70, d: 0.72, h: 1.80, mount: 'parede', clearance: 0.90 },
  // Quarto
  { id: 'cama-solteiro', category: 'quarto', name: 'Cama de solteiro', w: 0.88, d: 1.88, h: 0.50, mount: 'parede', clearance: 0.50 },
  { id: 'cama-casal', category: 'quarto', name: 'Cama de casal', w: 1.38, d: 1.88, h: 0.50, mount: 'parede', clearance: 0.50 },
  { id: 'cama-queen', category: 'quarto', name: 'Cama queen', w: 1.58, d: 1.98, h: 0.50, mount: 'parede', clearance: 0.50 },
  { id: 'guarda-roupa-3p', category: 'quarto', name: 'Guarda-roupa 3 portas', w: 1.20, d: 0.55, h: 2.10, mount: 'parede', clearance: 0.70 },
  // Sala
  { id: 'sofa-3l', category: 'sala', name: 'Sofá 3 lugares', w: 2.00, d: 0.90, h: 0.85, mount: 'parede', clearance: 0.60 },
  { id: 'rack-tv', category: 'sala', name: 'Rack de TV', w: 1.60, d: 0.40, h: 0.55, mount: 'parede', clearance: 0.60 },
  { id: 'mesa-4l', category: 'sala', name: 'Mesa de jantar 4 lugares', w: 1.20, d: 0.80, h: 0.76, mount: 'piso', clearance: 0.75 },
];
