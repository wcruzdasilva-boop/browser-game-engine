// Posição das folhas de uma porta/janela para um grau de abertura t ∈ [0, 1]
// (0 = fechada, 1 = totalmente aberta). Coordenadas locais do vão: u ao longo da largura
// (0..width, no sentido a→b da parede), v na altura. O renderizador aplica cada pose:
//   angle → gira em torno do eixo (vertical/horizontal) que passa por pivot, avançando
//           para o lado `side` da parede (+1 = esquerda de a→b, -1 = direita)
//   slide → desloca a folha ao longo de u
// As opções semânticas (dobradiça esquerda/direita, abre para dentro/fora) são convertidas
// em geometria por `resolveOpening` (openings.ts).

import type { OpeningOperation } from '../model/types';

const DEG = Math.PI / 180;

export interface ResolvedOpening {
  operation: OpeningOperation;
  leaves: number;
  width: number;
  height: number;
  /** lado para onde as folhas de giro avançam */
  side: 1 | -1;
  /** folha única de giro: dobradiça em u = 0 */
  hingeAtStart: boolean;
  /** folha única de correr: corre em direção a u < 0 */
  slideToStart: boolean;
  maxAngle?: number;
}

export interface LeafPose {
  u0: number;
  u1: number;
  axis?: 'vertical' | 'horizontal';
  pivot?: { u: number; v: number };
  /** ângulo de abertura (rad, sempre ≥ 0) */
  angle?: number;
  side?: 1 | -1;
  slide?: number;
  track?: number;
}

export function leafPoses(o: ResolvedOpening, t: number): LeafPose[] {
  const { operation, leaves, width, height, side } = o;
  t = Math.min(1, Math.max(0, t));

  switch (operation) {
    case 'giro': {
      const angle = t * (o.maxAngle ?? 90) * DEG;
      if (leaves === 1) {
        return [{ u0: 0, u1: width, axis: 'vertical', pivot: { u: o.hingeAtStart ? 0 : width, v: 0 }, angle, side }];
      }
      const w = width / 2;
      return [
        { u0: 0, u1: w, axis: 'vertical', pivot: { u: 0, v: 0 }, angle, side },
        { u0: w, u1: width, axis: 'vertical', pivot: { u: width, v: 0 }, angle, side },
      ];
    }
    case 'pivotante':
      // eixo a 1/6 da largura
      return [{ u0: 0, u1: width, axis: 'vertical', pivot: { u: o.hingeAtStart ? width / 6 : (5 * width) / 6, v: 0 }, angle: t * (o.maxAngle ?? 90) * DEG, side }];
    case 'correr': {
      if (leaves === 1) return [{ u0: 0, u1: width, slide: (o.slideToStart ? -1 : 1) * t * width, track: 0 }];
      const w = width / leaves;
      if (leaves === 2) {
        // folha de u maior corre por trás da outra
        return [
          { u0: 0, u1: w, slide: 0, track: 0 },
          { u0: w, u1: width, slide: -t * w, track: 1 },
        ];
      }
      // 4 folhas: as centrais correm sobre as laterais fixas
      return [
        { u0: 0, u1: w, slide: 0, track: 0 },
        { u0: w, u1: 2 * w, slide: -t * w, track: 1 },
        { u0: 2 * w, u1: 3 * w, slide: t * w, track: 1 },
        { u0: 3 * w, u1: width, slide: 0, track: 0 },
      ];
    }
    case 'basculante':
      return [{ u0: 0, u1: width, axis: 'horizontal', pivot: { u: 0, v: height / 2 }, angle: t * 60 * DEG, side }];
    case 'maxim-ar':
      return [{ u0: 0, u1: width, axis: 'horizontal', pivot: { u: 0, v: height }, angle: t * 45 * DEG, side }];
    case 'fixa':
      return [{ u0: 0, u1: width, slide: 0 }];
  }
}
