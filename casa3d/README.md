# Casa3D

Planta baixa, projeção 3D da casa e do telhado, cálculo de material de telhado e passeio
interno — app desktop em Electron, 100% local, medidas em metros.

**Proposta completa:** [docs/PROPOSTA.md](docs/PROPOSTA.md)

```bash
npm install
npm test                         # testes dos módulos de cálculo/geometria
npm run dev                      # renderer no navegador (http://localhost:5174)
CASA3D_DEV_URL=http://localhost:5174 npm run electron   # mesmo renderer dentro do Electron
npm start                        # build + Electron
```

Estado atual (fase F0): catálogos, cálculo de telhado (duas águas / uma água / platibanda ×
Colonial / Plan / Isotelha × madeira / aço), painéis de parede com vãos, cinemática de
portas e janelas, camadas, shell Electron e tela com a calculadora de telhado.
