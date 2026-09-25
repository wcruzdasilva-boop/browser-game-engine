// Símbolos de portas e janelas na planta (convenção de desenho arquitetônico): vão
// recortado na parede, batentes, folhas e arcos de abertura.

import { findOpeningModel } from '@shared/catalog/openings';
import type { ResolvedOpening } from '@shared/core/openings/kinematics';
import type { Opening, Vec2, Wall } from '@shared/core/model/types';
import { wallFrame } from '@shared/core/geometry/wallFrame';
import { sub } from '@shared/core/geometry/vec';
import type { Draw } from './draw';
import { THEME } from './theme';

const angleOf = (v: Vec2) => Math.atan2(v.y, v.x);

function sweep(d: Draw, center: Vec2, from: Vec2, to: Vec2, color: string, dash: number[] = []): void {
  const a0 = angleOf(sub(from, center));
  let delta = angleOf(sub(to, center)) - a0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  d.arc(center, Math.hypot(from.x - center.x, from.y - center.y), a0, a0 + delta, color, 1, dash);
}

/** Retângulo de folha (espessura `thick`) entre u0 e u1 na faixa normal n. */
function leafRect(d: Draw, at: (u: number, n: number) => Vec2, u0: number, u1: number, n: number, thick: number, color: string, dash: number[] = []): void {
  const pts = [at(u0, n - thick / 2), at(u1, n - thick / 2), at(u1, n + thick / 2), at(u0, n + thick / 2)];
  d.path(pts, true);
  d.ctx.strokeStyle = color;
  d.ctx.lineWidth = 1.25;
  d.ctx.setLineDash(dash);
  d.ctx.stroke();
  d.ctx.setLineDash([]);
}

export function drawOpening(d: Draw, wall: Wall, o: Opening, r: ResolvedOpening, color: string, cut = true): void {
  const model = findOpeningModel(o.modelId);
  const f = wallFrame(wall);
  const at = f.at;
  const half = wall.thickness / 2;
  const u0 = o.offset;
  const u1 = o.offset + o.width;
  const w = o.width;
  const s = r.side;

  // recorte do vão e batentes
  if (cut) d.polygon([at(u0, -half - 0.01), at(u1, -half - 0.01), at(u1, half + 0.01), at(u0, half + 0.01)], THEME.paper);
  d.line(at(u0, -half), at(u0, half), color, 1.5);
  d.line(at(u1, -half), at(u1, half), color, 1.5);

  const isDoor = model?.kind !== 'janela';
  if (!isDoor) {
    // janela: faces da parede no vão + vidro
    d.line(at(u0, -half), at(u1, -half), color, 0.75);
    d.line(at(u0, half), at(u1, half), color, 0.75);
  }

  switch (r.operation) {
    case 'giro': {
      const face = s * half;
      const leafLen = r.leaves === 1 ? w : w / 2;
      const dash = isDoor ? [] : [4, 3];
      const hinges = r.leaves === 1 ? [r.hingeAtStart ? u0 : u1] : [u0, u1];
      for (const hu of hinges) {
        const toward = hu === u0 ? 1 : -1;
        const pivot = at(hu, face);
        const tip = at(hu, face + s * leafLen);
        const closed = at(hu + toward * leafLen, face);
        d.line(pivot, tip, color, isDoor ? 2.5 : 1);
        sweep(d, pivot, closed, tip, color, dash);
      }
      if (!isDoor) d.line(at(u0, 0), at(u1, 0), color, 1);
      break;
    }
    case 'pivotante': {
      const face = s * half;
      const pu = r.hingeAtStart ? u0 + w / 6 : u1 - w / 6;
      const far = r.hingeAtStart ? u1 : u0;
      const pivot = at(pu, face);
      d.line(at(pu, face - (s * w) / 6), at(pu, face + (s * 5 * w) / 6), color, 2.5);
      sweep(d, pivot, at(far, face), at(pu, face + (s * 5 * w) / 6), color);
      d.dot(pivot, 2.5, color);
      break;
    }
    case 'correr': {
      const thick = Math.min(0.04, half / 2);
      if (r.leaves === 1) {
        const embutida = o.options.mount === 'embutida';
        const n = embutida ? 0 : s * (half + thick);
        const shift = (r.slideToStart ? -1 : 1) * w;
        leafRect(d, at, u0, u1, n, thick, color);
        leafRect(d, at, u0 + shift, u1 + shift, n, thick, color, [4, 3]);
      } else {
        const lw = w / r.leaves;
        for (let i = 0; i < r.leaves; i++) {
          const track = (r.leaves === 4 ? (i === 1 || i === 2) : i % 2 === 1) ? 1 : -1;
          const a = u0 + i * lw - (i > 0 ? 0.03 : 0);
          const b = u0 + (i + 1) * lw + (i < r.leaves - 1 ? 0.03 : 0);
          leafRect(d, at, a, b, (track * half) / 3, thick, color);
        }
      }
      break;
    }
    case 'basculante':
    case 'maxim-ar':
      d.line(at(u0, 0), at(u1, 0), color, 1);
      d.line(at(u0, s * (half + 0.12)), at(u1, s * (half + 0.12)), color, 1, [4, 3]);
      break;
    case 'fixa':
      d.line(at(u0, 0), at(u1, 0), color, 1.25);
      break;
  }
}
