# Casa3D — Proposta técnica

Aplicativo desktop (Electron, 100% local) para desenhar a **planta baixa**, gerar a **projeção 3D**
da casa e do **telhado**, calcular o **material do telhado** e percorrer o interior com câmeras.
Todas as medidas são em **metros**.

> Nome provisório. **Decisões tomadas** (ver §12): TypeScript, repositório próprio, alvo
> **somente Windows** (Linux poderá ser reavaliado no futuro, sem a importação SketchUp),
> catálogo de telhas com os modelos padrão de mercado e telhados de 3/4 águas e plantas em L
> já na fase 3.

---

## 1. Visão geral do fluxo

```
 Editor 2D (planta)  ──►  Modelo do projeto (JSON, metros)  ──►  Construtores 3D por camada
   paredes, vãos,            paredes, vãos, cômodos,              0 fundação / piso
   cômodos, cotas            móveis, telhado, forro, câmeras      1 paredes + portas/janelas
        ▲                            │                            2 móveis
        │                            ├──► Cálculo de telhado      3 estrutura do telhado
 Importação .skp/.dae/.glb           │    (cobertura + estrutura) 4 cobertura
                                     └──► Arquivo .casa3d         + forro (extra)
```

O **modelo** é a fonte única da verdade: o 2D e o 3D são apenas vistas dele. Toda edição passa
por comandos (desfazer/refazer) e o 3D é reconstruído de forma incremental só para o que mudou.

## 2. Tecnologia

| Decisão | Escolha | Motivo |
|---|---|---|
| Shell desktop | **Electron** (contextIsolation + sandbox, preload mínimo) | Pedido do projeto; acesso a disco e ao conversor .skp nativo |
| Plataforma | **Windows x64** (instalador NSIS via electron-builder) | Decisão do projeto |
| Build | **electron-vite** (main, preload e renderer) | Vite com HMR para as três partes do Electron |
| 3D | **three.js** (`WebGLRenderer`, `MeshStandardMaterial`) | Maduro e leve; vidro transparente, seleção e contornos são simples no forward padrão |
| Render realista (fase posterior) | Pipeline **Aether** (céu físico, sombras em cascata, SSAO, TAA) | Já existe no repositório `browser-game-engine`; será trazido como pacote/submódulo na F7 |
| Editor 2D | **Canvas 2D** próprio | Linhas nítidas, textos de cotas, hit-test simples; independente do 3D |
| Linguagem | **TypeScript** estrito (`strict`, `noUncheckedIndexedAccess`) | Modelo de domínio grande; erros de unidade/forma pegos na compilação |
| Testes | **Vitest** nos módulos puros + roteiros Playwright (navegador e Electron) | Cálculo e geometria não dependem de DOM/three |
| Empacotamento | electron-builder, alvo Windows | Instalador offline |

## 3. Organização do código

```
casa3d/
  src/
    main/              processo principal do Electron: janela, diálogos, IPC, importação
      index.ts         project:open, project:save, import:model, confirmação ao fechar
      skp.ts           chama o conversor nativo .skp → .glb (Windows)
    preload/index.ts   API exposta ao renderer (window.casa3d)
    shared/            domínio puro, sem three.js/DOM (testável em Node)
      core/model/      tipos, criação/validação do projeto, edições de parede com junções
      core/geometry/   vetores, grafo da planta (junções, cômodos, contornos), captura, painéis
      core/openings/   regras de vãos na parede e cinemática das folhas
      core/history.ts  desfazer/refazer
      core/view/       camadas da vista 3D
      catalog/         portas, janelas, telhas, estruturas, móveis, forros
      calc/            cálculo de telhado
    renderer/          interface (roda no Electron ou no navegador com `npm run dev:web`)
      src/app/         estado da aplicação e abrir/salvar
      src/editor2d/    viewport, desenho, símbolos, ferramentas (selecionar, parede, porta,
                       janela, cota)
      src/ui/          painéis (ferramenta, propriedades, telhado)
  native/skp-converter conversor C++ com o SketchUp C SDK — fase 6
  test/                testes Vitest
  docs/PROPOSTA.md     este documento
```

## 4. Editor 2D — paredes, portas e janelas

**Paredes**
- Desenho por cliques sucessivos (polilinha); `Esc` encerra; digitar o comprimento (ex.: `3,45`
  ou `345cm`) + Enter fixa a medida; clicar no ponto inicial fecha o contorno.
- Parede = eixo `a → b` + espessura (padrão 0,15 m) + altura (pé-direito padrão 2,80 m).
  Externa/interna é derivada do contorno. A linha clicada pode ser o eixo ou uma das faces
  (a cadeia inteira é recalculada com cantos em quina), para medir pelo lado de fora.
- **Captura**: extremidades, meio, ponto sobre parede, ângulos de 15°, ortogonal (Shift) e grade
  (5 cm, configurável).
- **Edição**: arrastar extremidade (paredes ligadas acompanham), arrastar parede inteira (as
  ligadas esticam e as apoiadas em T continuam encostadas), comprimento/espessura/altura no
  painel de propriedades.
- **Junções** (L, T, X) calculadas por *offset* das faces e interseção das linhas; os cantos
  saem limpos no 2D e no 3D.
- **Cômodos** detectados automaticamente como ciclos mínimos do grafo de paredes (faces de um
  grafo planar). Cada cômodo mostra nome e área (m²) e recebe piso/forro.
- Cotas automáticas de cada fachada (pelo lado de fora) + ferramenta de cota manual.

**Portas e janelas**
- Escolhe-se o modelo no catálogo e clica-se sobre a parede: o vão se encaixa na parede
  (não pode sobrepor outro vão nem sair dela — `validateOpenings`) e pode ser arrastado ao longo
  dela ou para outra parede. O lado da parede em que está o cursor define se abre para dentro
  ou para fora; "dentro" é o lado do cômodo (paredes externas).
- Símbolo 2D padrão de desenho arquitetônico (arco de abertura, folhas de correr).
- Propriedades editáveis: tamanho padrão ou livre, material, peitoril, lado da dobradiça,
  abertura para dentro/fora, lado de correr.

| Modelos de porta | Tamanhos padrão (m) |
|---|---|
| Abrir 1 folha (madeira, aço, alumínio, vidro) | 0,60 / 0,70 / **0,80** / 0,90 × 2,10 |
| Abrir 2 folhas | 1,20 / 1,40 / 1,60 × 2,10 |
| Correr 1 folha (aparente ou embutida) | 0,70 / 0,80 / 0,90 × 2,10 |
| Correr 2 folhas | 1,20 / 1,50 / 2,00 / 2,40 × 2,10 |
| Pivotante | 1,00 / 1,20 × 2,40; 1,50 × 2,70 |

| Modelos de janela | Tamanhos (m) | Peitoril padrão |
|---|---|---|
| Correr 2 folhas | 1,00×1,00 · 1,20×1,00 · 1,20×1,20 · 1,50×1,20 · 2,00×1,20 | 1,10 |
| Correr 4 folhas | 1,50×1,20 · 2,00×1,20 · 2,40×1,20 | 0,90 |
| Abrir 2 folhas | 1,00×1,00 · 1,20×1,00 · 1,20×1,20 | 1,10 |
| Basculante | 0,40×0,40 · 0,60×0,60 · 0,80×0,60 · 1,00×0,60 | 1,50 |
| Maxim-ar | 0,60×0,60 · 0,80×0,60 · 1,00×0,60 · 1,00×0,80 | 1,50 |
| Vidro fixo | 0,60×1,00 · 1,00×1,00 · 1,50×1,50 | 1,10 |

Referências: NBR 15930 (portas de madeira), NBR 9050 (vão livre mínimo 0,80 m para acessibilidade).
Todo o catálogo é um arquivo de dados (`src/shared/catalog/openings.ts`) — adicionar modelo não exige código.

## 5. Vista 3D por camadas

| Camada | Conteúdo | Construtor |
|---|---|---|
| **0** | Planta baixa projetada no piso (linhas + nomes/áreas), contrapiso e fundação (baldrame sob as paredes, profundidade 0,40 m) | `FoundationBuilder` |
| **1** | Paredes com vãos, portas e janelas; **abrir/fechar** por clique ou "abrir todas" | `WallBuilder`, `OpeningBuilder` |
| **2** | Móveis do catálogo | `FurnitureBuilder` |
| **3** | Estrutura do telhado (tesouras, terças, caibros, ripas) conforme modelo e material | `RoofStructureBuilder` |
| **4** | Cobertura (telhas/chapas, cumeeira, calha, rufo, platibanda) | `RoofCoverBuilder` |
| **extra** | Forro (PVC, gesso, lambri, laje) | `CeilingBuilder` |

- Um seletor de **nível** revela da camada 0 até a escolhida (ex.: nível 2 mostra fundação, paredes
  e móveis); cada camada também tem liga/desliga individual. O forro fica fora da sequência porque
  esconderia o interior visto de cima.
- **Paredes sem CSG**: cada parede é fatiada em painéis maciços em volta dos vãos
  (`shared/core/geometry/wallPanels.ts`) e cada painel é extrudado pela espessura. É rápido, exato e sem
  artefatos de booleanas. Os cantos usam os polígonos de junção do 2D.
- **Portas e janelas** são geradas parametricamente (batente, folhas, vidro, puxador) a partir do
  modelo + material. A animação usa `leafPoses(opening, t)`:
  giro (rotação no eixo da dobradiça, 90°), correr (translação no trilho), basculante (eixo
  horizontal central, 60°), maxim-ar (eixo no topo, 45°), pivotante (eixo deslocado).
  Interpolação suave de `t` ao clicar.

## 6. Móveis (camada 2)

- Catálogo **limitado e padronizado** por ambiente (banheiro, cozinha, quarto, sala) com medidas
  de mercado — ex. banheiro: vaso com caixa acoplada 0,37×0,65, gabinete com cuba 0,60 e 0,80,
  lavatório de coluna, box 0,90×0,90 e 0,80×1,20, chuveiro, espelheira.
- **Posicionamento**: o móvel segue o mouse (raycast no piso do cômodo); móveis de parede
  **encostam e alinham** automaticamente na parede mais próxima (< 0,40 m); de canto encaixam no
  canto. Clique fixa.
- **Rotação**: `R` gira 90°, roda do mouse gira 15°, `Shift` livre.
- **Conflitos**: caixa orientada (OBB) do móvel + faixa de uso (`clearance`) — aviso visual ao
  sobrepor outro móvel, parede ou área de abertura de porta.
- Modelos 3D feitos proceduralmente (primitivas arredondadas), sem arquivos externos; mais tarde é
  possível aceitar .glb próprios.

## 7. Telhado — modelos, telhas e cálculo

**Modelos**: **duas águas** (cumeeira central, beiral em volta), **uma água** (com beiral) e
**uma água com platibanda** (sem beiral, calha no lado baixo, rufo nos outros três lados, altura da
platibanda = desnível da água + folga de 0,30 m). A cumeeira segue a maior dimensão por padrão
(configurável).

**Telhas** (`src/shared/catalog/roofTiles.ts`): organizadas por família com os **modelos padrão de
mercado**; quando uma família tem mais de um modelo (ex.: Isotelha EPS 30 mm e EPS 50 mm), a
interface mostra todos como opção. Valores de referência:

| Telha | Tipo | Consumo | Inclinação mín. | Galga / apoio |
|---|---|---|---|---|
| Colonial | cerâmica capa-canal | 24 pç/m², cumeeira 3 pç/m | 25% | ripas a 0,38 m |
| Plan | cerâmica | 26 pç/m², cumeeira 3 pç/m | 30% | ripas a 0,33 m |
| Isotelha EPS 30 mm | painel sanduíche aço+EPS | chapas de 1,00 m úteis, sob medida (passo 5 cm, máx. 12 m) | 5% | terças a ≤ 1,80 m, 4 parafusos/apoio |
| Isotelha EPS 50 mm | painel sanduíche aço+EPS | idem | 5% | terças a ≤ 2,20 m |

**Estrutura** (`src/shared/catalog/roofStructure.ts`):

| | Cerâmica (Colonial/Plan) | Isotelha |
|---|---|---|
| **Madeira** | tesouras a 3,0 m + terças a 1,5 m + caibros a 0,50 m + ripas na galga | tesouras + terças |
| **Aço** | tesouras leves a 1,20 m + ripas metálicas (sem terças/caibros) | tesouras + terças Ue |

**Cálculo** (`src/shared/calc/roof.ts`):
1. Fator de inclinação `k = √(1 + i²)`; comprimento da água = projeção horizontal × `k`.
2. Área por água = comprimento da água × largura (com beirais). Área total = soma.
3. Cerâmica: `peças = ⌈área × pç/m² × (1 + perda)⌉`; cumeeiras = ⌈comprimento × pç/m × (1+perda)⌉.
4. Isotelha: chapas = ⌈largura / largura útil⌉ por água, comprimento arredondado a 5 cm;
   parafusos = chapas × apoios × 4.
5. Estrutura: quantidade e comprimento de tesouras, terças, caibros e ripas → **m³ de madeira**
   ou **kg de aço**; mais calha e rufo em metros.
6. Avisos: inclinação abaixo da mínima da telha, chapa acima do comprimento máximo.
7. Carga da cobertura (kg) para conferência.

Exemplo (casa 10 × 8 m, duas águas, 30%, beiral 0,50, Colonial, madeira): área 103,36 m²,
**2.605 telhas**, **35 cumeeiras**, 5 tesouras, 7 linhas de terça, 46 caibros, 28 linhas de ripa ≈ 2,60 m³.

> O app produz **quantitativo e pré-dimensionamento para orçamento**; o dimensionamento
> estrutural definitivo continua sendo responsabilidade de profissional habilitado (ART/RRT).

**Fase 3** (decidido): telhados de **3 e 4 águas** e **plantas em L** via *straight skeleton* do
contorno da planta (gera espigões, rincões e águas automaticamente), com quantitativo de
cumeeiras, espigões e rincões por metro linear.

## 8. Passeio interno (câmeras)

- Cada cômodo detectado recebe automaticamente **pontos de vista** (centro do cômodo e cantos
  opostos às portas), com altura de olho 1,60 m; o usuário pode adicionar/mover pontos.
- Na câmera ativa o usuário **gira para os lados** (arrastar/setas: yaw livre, pitch limitado a ±60°);
  a posição fica fixa — é um "olhar em volta" estável, sem colisão com paredes.
- **Trocar de câmera** (Tab / miniaturas / clique no cômodo na planta) faz uma transição animada
  (interpolação de posição + `slerp` da orientação, ~0,8 s) para ver outros ângulos do cômodo ou
  outro cômodo.
- No passeio o forro e a cobertura ficam ligados; portas podem ser abertas por clique.

## 9. Importação do SketchUp (.skp) — Windows

- O `.skp` é proprietário; a única leitura confiável é o **SketchUp C SDK** (Trimble), disponível
  para Windows. Um **conversor nativo** pequeno (`native/skp-converter`, C++) é empacotado com o
  app (`resources/skp-converter`) e chamado como processo filho: `.skp → .glb`, convertendo
  **polegadas → metros** (unidade interna do SketchUp), preservando tags, grupos e componentes.
- Processo separado = uma falha no SDK não derruba o app, e evita compilar addon nativo por
  versão do Electron.
- Também aceita `.dae`/`.glb`/`.obj` exportados pelo SketchUp.
- O modelo importado entra como **referência** (camada própria, pode ser escalado/alinhado e usado
  como gabarito para desenhar as paredes por cima). Fase seguinte: **reconhecimento** automático de
  paredes (pares de faces verticais paralelas) e de componentes de porta/janela por nome.
- Pendente: conferir os termos de licença de redistribuição das bibliotecas do SDK.
- Linux: se for reavaliado no futuro, entra sem a importação SketchUp.

## 10. Arquivo do projeto e dados

- Arquivo `.casa3d` = JSON versionado (`schema`), legível e fácil de migrar; modelos importados
  ficam ao lado (ou embutidos num pacote zip numa fase posterior).
- Medidas sempre em metros (float), arredondamento a milímetro apenas na exibição.
- Exportações planejadas: lista de materiais (CSV/planilha), prancha da planta em PDF com cotas,
  imagens do 3D.

## 11. Roteiro por fases

| Fase | Entrega | Estado |
|---|---|---|
| **F0 – Fundação** | Estrutura, modelo, catálogos, cálculo de telhado, shell Electron, testes | ✅ |
| **F1 – Editor 2D** | Paredes (eixo ou face) com captura e junções L/T/X, cotas automáticas e manuais, cômodos com nome e área, portas e janelas do catálogo, propriedades, desfazer/refazer, salvar/abrir, TypeScript | ✅ |
| **F2 – 3D camadas 0–1** | Piso/fundação, paredes com vãos, portas/janelas paramétricas com abrir/fechar | |
| **F3 – Telhado 3D** | 2 águas, 1 água, platibanda, **3 e 4 águas, plantas em L**; camadas 3 e 4, forro, quantitativos e exportação CSV | |
| **F4 – Móveis** | Catálogo, encaixe na parede, rotação, conflitos | |
| **F5 – Passeio** | Pontos de vista por cômodo, girar, trocar câmera com transição | |
| **F6 – SketchUp** | Importação .dae/.glb; conversor .skp (Windows) | |
| **F7 – Acabamento** | PDF da prancha, render realista, instalador Windows | |

Cada fase termina com app utilizável e testes dos módulos puros.

### O que a F1 entrega

- Ferramentas **Selecionar (V)**, **Parede (P)**, **Porta (O)**, **Janela (J)**, **Cota (C)**; pan com
  espaço/botão do meio, zoom na roda, **F** enquadra.
- Paredes desenhadas pelo eixo ou por uma face, com comprimento digitado; junções limpas em L, T e
  X; paredes externas identificadas pelo contorno.
- Cômodos detectados automaticamente, com área útil (descontando as paredes) e nome (duplo clique).
- Portas e janelas do catálogo com tamanhos padrão, material e opções; símbolo de desenho técnico;
  vãos inválidos (sobrepostos/fora da parede) em vermelho.
- Cotas automáticas por fachada e cotas manuais arrastáveis.
- Painel de propriedades (parede, vão, cômodo, cota, projeto com áreas construída e útil).
- Desfazer/refazer de tudo; arquivo `.casa3d`; confirmação ao fechar com alterações.
- Aba **Telhado** usando o contorno da planta.

Limitações conhecidas da F1: começar uma cadeia "pela face" em cima de uma parede existente
desloca o ponto inicial (desenhe pelo eixo nesse caso); ângulos muito agudos entre paredes
(< ~15°) ficam sem quina.

## 12. Decisões

| Pergunta | Decisão |
|---|---|
| JavaScript ou TypeScript | **TypeScript** |
| Onde fica o código | **Repositório próprio** |
| Plataformas | **Somente Windows**; Linux pode ser reavaliado, sem a importação SketchUp |
| Telhas | **Modelos padrão de mercado**; famílias com mais de um modelo mostram todas as opções |
| 3/4 águas e planta em L | **Na fase 3** |
| Publicação da proposta | Após a conclusão da fase 1 |
