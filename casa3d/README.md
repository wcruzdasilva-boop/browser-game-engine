# Casa3D

Planta baixa, projeção 3D da casa e do telhado, cálculo de material de telhado e passeio
interno — app desktop em Electron para Windows, 100% local, medidas em metros.

**Proposta e roteiro:** [docs/PROPOSTA.md](docs/PROPOSTA.md)

## Desenvolvimento

```bash
npm install
npm run dev          # app Electron com recarga automática
npm run dev:web      # só a interface, no navegador (http://localhost:5174)
npm test             # testes (Vitest)
npm run typecheck    # TypeScript
npm run build        # typecheck + bundles em out/
npm run dist:win     # instalador Windows (NSIS) em release/
```

## Estado

Fases **F0** (fundação) e **F1** (editor 2D) concluídas: paredes com junções, cômodos e áreas,
portas e janelas do catálogo, cotas, propriedades, desfazer/refazer, salvar/abrir `.casa3d` e
calculadora de telhado (duas águas / uma água / platibanda × Colonial / Plan / Isotelha ×
madeira / aço).

## Atalhos

| Tecla | Ação |
|---|---|
| V · P · O · J · C | Selecionar · Parede · Porta · Janela · Cota |
| Shift | Ortogonal |
| Espaço + arrastar / roda | Mover vista / zoom |
| F | Enquadrar a planta |
| Delete | Excluir seleção |
| Ctrl+Z · Ctrl+Y | Desfazer · refazer |
| Ctrl+N · Ctrl+O · Ctrl+S | Novo · abrir · salvar |
