// Tipos de forro (camada extra). `hangerSpacing` = espaçamento dos tirantes/perfis de
// sustentação; `wasteDefault` = perda usual de corte.

export interface CeilingType {
  name: string;
  color?: number;
  hangerSpacing?: number;
  wasteDefault?: number;
}

export const CEILINGS = {
  nenhum: { name: 'Sem forro (laje aparente)' },
  pvc: { name: 'Forro de PVC (réguas 20 cm)', color: 0xf2f2f2, hangerSpacing: 0.60, wasteDefault: 0.10 },
  gesso: { name: 'Gesso acartonado (drywall)', color: 0xfafafa, hangerSpacing: 0.60, wasteDefault: 0.10 },
  madeira: { name: 'Lambri de madeira', color: 0xb07a45, hangerSpacing: 0.50, wasteDefault: 0.12 },
  laje: { name: 'Laje pré-moldada rebocada', color: 0xe8e4dc },
} satisfies Record<string, CeilingType>;

export type CeilingId = keyof typeof CEILINGS;
