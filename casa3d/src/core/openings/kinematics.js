// Posição das folhas de uma porta/janela para um grau de abertura t ∈ [0, 1]
// (0 = fechada, 1 = totalmente aberta). Coordenadas locais do vão: u ao longo da largura
// (0..width), v na altura. O renderizador aplica cada pose ao mesh da folha:
//   rotation → gira `angle` rad em torno do eixo (vertical/horizontal) que passa por pivot
//   slide    → desloca a folha `slide` m ao longo de u
// `side` indica para qual face da parede a folha avança: 'dentro' ou 'fora'.

const DEG = Math.PI / 180;

export function leafPoses(o, t) {
  const { operation, leaves = 1, width, height } = o;
  const side = o.swing ?? 'dentro';
  t = Math.min(1, Math.max(0, t));

  switch (operation) {
    case 'giro': {
      const max = (o.maxAngle ?? 90) * DEG;
      if (leaves === 1) {
        const hingeLeft = (o.hinge ?? 'esquerda') === 'esquerda';
        return [{ u0: 0, u1: width, axis: 'vertical', pivot: { u: hingeLeft ? 0 : width, v: 0 }, angle: t * max * (hingeLeft ? 1 : -1), side }];
      }
      const w = width / 2;
      return [
        { u0: 0, u1: w, axis: 'vertical', pivot: { u: 0, v: 0 }, angle: t * max, side },
        { u0: w, u1: width, axis: 'vertical', pivot: { u: width, v: 0 }, angle: -t * max, side },
      ];
    }
    case 'pivotante': {
      // eixo a 1/6 da largura, gira até 90°
      const max = (o.maxAngle ?? 90) * DEG;
      return [{ u0: 0, u1: width, axis: 'vertical', pivot: { u: width / 6, v: 0 }, angle: t * max, side }];
    }
    case 'correr': {
      if (leaves === 1) {
        // folha única corre por fora do vão (aparente) ou para dentro da parede (embutida)
        const dir = (o.slideTo ?? 'esquerda') === 'esquerda' ? -1 : 1;
        return [{ u0: 0, u1: width, slide: dir * t * width, track: 0 }];
      }
      const w = width / leaves;
      if (leaves === 2) {
        // folha da direita corre por trás da esquerda
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
      // palhetas giram em torno do eixo horizontal central
      return [{ u0: 0, u1: width, axis: 'horizontal', pivot: { u: 0, v: height / 2 }, angle: t * 60 * DEG, side: 'fora' }];
    case 'maxim-ar':
      // projeta para fora com eixo no topo
      return [{ u0: 0, u1: width, axis: 'horizontal', pivot: { u: 0, v: height }, angle: t * 45 * DEG, side: 'fora' }];
    case 'fixa':
      return [{ u0: 0, u1: width, slide: 0 }];
    default:
      throw new Error(`Operação de abertura desconhecida: ${operation}`);
  }
}
