// Modelo de domínio do projeto (serializável em JSON, sem dependência de three.js/DOM).
// Paredes são segmentos (a → b) com espessura e altura; vãos pertencem a uma parede e
// são posicionados por `offset` ao longo dela. Os cômodos são derivados do grafo de
// paredes (ciclos mínimos) e só guardam nome/acabamentos por id.

export const SCHEMA_VERSION = 1;

let seq = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const DEFAULTS = {
  wallHeight: 2.80,       // pé-direito
  wallThickness: 0.15,    // bloco 14 cm + reboco
  floorThickness: 0.10,
  foundationDepth: 0.40,  // baldrame
};

export function createProject(name = 'Novo projeto') {
  return {
    schema: SCHEMA_VERSION,
    name,
    units: 'm',
    settings: { ...DEFAULTS },
    walls: [],
    openings: [],
    rooms: [],        // { id, name, polygonKey, floor, ceiling }
    furniture: [],    // { id, catalogId, x, y, rotation }
    roof: null,       // parâmetros de calculateRoof()
    ceiling: { type: 'pvc' },
    cameras: [],      // pontos de vista do passeio: { id, roomId, x, y, eye, yaw }
    imports: [],      // referências importadas (.skp/.dae/.glb)
  };
}

export function createWall(a, b, opts = {}) {
  return {
    id: newId('wall'),
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    thickness: opts.thickness ?? DEFAULTS.wallThickness,
    height: opts.height ?? DEFAULTS.wallHeight,
    exterior: opts.exterior ?? false,
  };
}

export const wallLength = (w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

export function createOpening(wallId, model, opts = {}) {
  const [width, height] = opts.size ?? model.default;
  return {
    id: newId('open'),
    wallId,
    modelId: model.id,
    offset: opts.offset ?? 0,
    width,
    height,
    sill: opts.sill ?? model.sill ?? 0,
    material: opts.material ?? model.materials[0],
    options: { ...Object.fromEntries(Object.entries(model.options).map(([k, v]) => [k, v[0]])), ...opts.options },
    openAmount: 0,
  };
}
