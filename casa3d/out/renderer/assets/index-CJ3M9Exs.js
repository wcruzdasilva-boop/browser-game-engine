const SCHEMA_VERSION = 1;
let seq = 0;
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;
const DEFAULTS = {
  wallHeight: 2.8,
  // pé-direito
  wallThickness: 0.15,
  // bloco 14 cm + reboco
  floorThickness: 0.1,
  foundationDepth: 0.4,
  // baldrame
  gridStep: 0.05
};
function createProject(name = "Novo projeto") {
  return {
    schema: SCHEMA_VERSION,
    name,
    units: "m",
    settings: { ...DEFAULTS },
    walls: [],
    openings: [],
    rooms: [],
    dimensions: [],
    furniture: [],
    roof: null,
    ceiling: { type: "pvc" },
    cameras: [],
    imports: []
  };
}
function loadProject(data) {
  if (!data || typeof data !== "object") throw new Error("Arquivo de projeto inválido");
  const p = data;
  if (typeof p.schema !== "number" || p.schema > SCHEMA_VERSION) {
    throw new Error("Projeto criado por uma versão mais nova do Casa3D");
  }
  const base = createProject(p.name);
  return { ...base, ...p, settings: { ...base.settings, ...p.settings }, schema: SCHEMA_VERSION };
}
function createWall(a, b, opts = {}) {
  return {
    id: newId("wall"),
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    thickness: opts.thickness ?? DEFAULTS.wallThickness,
    height: opts.height ?? DEFAULTS.wallHeight
  };
}
const wallLength = (w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
function defaultOptions(model) {
  const out = {};
  for (const [k, v] of Object.entries(model.options)) if (v?.[0]) out[k] = v[0];
  return out;
}
function createOpening(wallId, model, opts = {}) {
  const [width, height] = opts.size ?? model.default;
  return {
    id: newId("open"),
    wallId,
    modelId: model.id,
    offset: opts.offset ?? 0,
    width,
    height,
    sill: opts.sill ?? model.sill,
    material: opts.material ?? model.materials[0] ?? "madeira",
    options: { ...defaultOptions(model), ...opts.options },
    openAmount: 0
  };
}
const roundTo = (v, step) => Math.round(v / step) * step;
const formatNumber = (v, decimals = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const formatMeters = (m, decimals = 2) => `${formatNumber(m, decimals)} m`;
const formatArea = (m2) => `${formatNumber(m2, 2)} m²`;
function parseLength(text) {
  const t = text.trim().toLowerCase().replace(",", ".");
  const m = /^(\d+(?:\.\d*)?|\.\d+)\s*(m|cm|mm)?$/.exec(t);
  if (!m?.[1]) return null;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? "m";
  return unit === "cm" ? v / 100 : unit === "mm" ? v / 1e3 : v;
}
async function openProjectFile() {
  if (window.casa3d) {
    const res = await window.casa3d.openProject();
    return res ? { project: loadProject(res.data), path: res.path } : null;
  }
  const file = await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".casa3d,application/json";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return null;
  return { project: loadProject(JSON.parse(await file.text())), path: file.name };
}
async function saveProjectFile(project, path, saveAs = false) {
  if (window.casa3d) return window.casa3d.saveProject(path, project, saveAs);
  const name = (path ?? `${project.name}.casa3d`).replace(/^.*[\\/]/, "");
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".casa3d") ? name : `${name}.casa3d`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}
class History {
  constructor(current, limit = 200) {
    this.current = current;
    this.limit = limit;
  }
  current;
  limit;
  past = [];
  future = [];
  /** Guarda o estado atual como ponto de retorno; chame antes de mutar `current`. */
  checkpoint(label) {
    this.past.push({ label, state: structuredClone(this.current) });
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  /** checkpoint + mutação */
  edit(label, fn) {
    this.checkpoint(label);
    fn(this.current);
  }
  /** Descarta o último checkpoint se nada mudou (ex.: arraste sem movimento). */
  dropIfUnchanged() {
    const last = this.past[this.past.length - 1];
    if (last && JSON.stringify(last.state) === JSON.stringify(this.current)) this.past.pop();
  }
  undo() {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push({ label: prev.label, state: this.current });
    this.current = prev.state;
    return prev.label;
  }
  redo() {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({ label: next.label, state: this.current });
    this.current = next.state;
    return next.label;
  }
  reset(state) {
    this.current = state;
    this.past = [];
    this.future = [];
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  get undoLabel() {
    return this.past[this.past.length - 1]?.label;
  }
  get redoLabel() {
    return this.future[this.future.length - 1]?.label;
  }
}
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (a) => Math.hypot(a.x, a.y);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const normalize = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const leftNormal = (d) => ({ x: -d.y, y: d.x });
function lineIntersection(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const s = cross(sub(q, p), e) / den;
  return add(p, scale(d, s));
}
function projectOnSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
  const point = lerp(a, b, t);
  return { t, point, distance: dist(p, point) };
}
function segmentIntersection(a, b, c, d) {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub(c, a);
  const t = cross(qp, s) / den;
  const u = cross(qp, r) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, point: add(a, scale(r, t)) };
}
function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function polygonCentroid(poly) {
  const a = polygonArea(poly);
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
function interiorPoint(poly) {
  const c = polygonCentroid(poly);
  if (pointInPolygon(c, poly)) return c;
  const ys = poly.map((p) => p.y);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  let best = c;
  let bestLen = -1;
  for (let k = 1; k < 20; k++) {
    const y = y0 + (y1 - y0) * k / 20;
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a.y > y !== b.y > y) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const l = xs[i + 1] - xs[i];
      if (l > bestLen) {
        bestLen = l;
        best = { x: (xs[i] + xs[i + 1]) / 2, y };
      }
    }
  }
  return best;
}
function offsetPolyline(points, offset, closed) {
  const n = points.length;
  if (n < 2 || offset === 0) return points.map((p) => ({ ...p }));
  const segCount = closed ? n : n - 1;
  const dirs = [];
  for (let i = 0; i < segCount; i++) dirs.push(normalize(sub(points[(i + 1) % n], points[i])));
  return points.map((p, i) => {
    const prev = closed ? dirs[(i - 1 + segCount) % segCount] : dirs[i - 1];
    const next = closed ? dirs[i % segCount] : dirs[i];
    if (!prev) return add(p, scale(leftNormal(next), offset));
    if (!next) return add(p, scale(leftNormal(prev), offset));
    const a = add(p, scale(leftNormal(prev), offset));
    const b = add(p, scale(leftNormal(next), offset));
    return lineIntersection(a, prev, b, next) ?? a;
  });
}
const TOL$1 = 1e-3;
function splitParams(walls) {
  const params = /* @__PURE__ */ new Map();
  for (const w of walls) params.set(w.id, [0, 1]);
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue;
      const o = walls[j];
      for (const p of [o.a, o.b]) {
        const pr = projectOnSegment(p, w.a, w.b);
        if (pr.distance < TOL$1 && pr.t > 1e-6 && pr.t < 1 - 1e-6) params.get(w.id).push(pr.t);
      }
      if (j > i) {
        const x = segmentIntersection(w.a, w.b, o.a, o.b);
        if (x && x.t > 1e-6 && x.t < 1 - 1e-6 && x.u > 1e-6 && x.u < 1 - 1e-6) {
          params.get(w.id).push(x.t);
          params.get(o.id).push(x.u);
        }
      }
    }
  }
  for (const list of params.values()) list.sort((m, n) => m - n);
  return params;
}
function analyzePlan(project) {
  const walls = project.walls.filter((w) => dist(w.a, w.b) > TOL$1);
  const nodes = [];
  const nodeAt = (p) => {
    const i = nodes.findIndex((n) => dist(n.p, p) < TOL$1);
    if (i >= 0) return i;
    nodes.push({ p: { x: p.x, y: p.y }, out: [] });
    return nodes.length - 1;
  };
  const raw = [];
  const params = splitParams(walls);
  for (const w of walls) {
    const ts = params.get(w.id);
    let prev = nodeAt(w.a);
    for (let k = 1; k < ts.length; k++) {
      const t = ts[k];
      const p = { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
      const cur = nodeAt(p);
      if (cur !== prev && !raw.some((s) => s.a === prev && s.b === cur || s.a === cur && s.b === prev)) {
        raw.push({ wallId: w.id, a: prev, b: cur, thickness: w.thickness });
      }
      prev = cur;
    }
  }
  const halves = [];
  raw.forEach((s, i) => {
    const pa = nodes[s.a].p;
    const pb = nodes[s.b].p;
    const d = normalize(sub(pb, pa));
    halves[2 * i] = { from: s.a, to: s.b, dir: d, angle: Math.atan2(d.y, d.x), half: s.thickness / 2 };
    halves[2 * i + 1] = { from: s.b, to: s.a, dir: scale(d, -1), angle: Math.atan2(-d.y, -d.x), half: s.thickness / 2 };
    nodes[s.a].out.push(2 * i);
    nodes[s.b].out.push(2 * i + 1);
  });
  for (const n of nodes) n.out.sort((m, k) => halves[m].angle - halves[k].angle);
  const cornerLeft = [];
  const cornerRight = [];
  for (const n of nodes) {
    const count = n.out.length;
    n.out.forEach((h2, i) => {
      const e = halves[h2];
      const leftOff = add(n.p, scale(leftNormal(e.dir), e.half));
      const rightOff = add(n.p, scale(leftNormal(e.dir), -e.half));
      if (count === 1) {
        cornerLeft[h2] = leftOff;
        cornerRight[h2] = rightOff;
        return;
      }
      const next = halves[n.out[(i + 1) % count]];
      const prev = halves[n.out[(i - 1 + count) % count]];
      const limit = 4 * Math.max(e.half, next.half, prev.half) + 0.05;
      const l = lineIntersection(leftOff, e.dir, add(n.p, scale(leftNormal(next.dir), -next.half)), next.dir);
      cornerLeft[h2] = l && dist(l, n.p) < limit ? l : leftOff;
      const r = lineIntersection(rightOff, e.dir, add(n.p, scale(leftNormal(prev.dir), prev.half)), prev.dir);
      cornerRight[h2] = r && dist(r, n.p) < limit ? r : rightOff;
    });
  }
  const segments = raw.map((s, i) => ({
    ...s,
    polygon: [cornerLeft[2 * i], cornerRight[2 * i + 1], cornerLeft[2 * i + 1], cornerRight[2 * i]],
    capA: nodes[s.a].out.length === 1,
    capB: nodes[s.b].out.length === 1
  }));
  const hubs = nodes.filter((n) => n.out.length >= 3).map((n) => n.out.flatMap((h2) => [cornerRight[h2], cornerLeft[h2]]));
  const visited = new Uint8Array(halves.length);
  const faces = [];
  for (let start = 0; start < halves.length; start++) {
    if (visited[start]) continue;
    const loop = [];
    let h2 = start;
    while (!visited[h2]) {
      visited[h2] = 1;
      loop.push(h2);
      const to = nodes[halves[h2].to];
      const k = to.out.indexOf(h2 ^ 1);
      h2 = to.out[(k - 1 + to.out.length) % to.out.length];
    }
    const axis = loop.map((e) => nodes[halves[e].from].p);
    faces.push({ halfEdges: loop, axis, inner: loop.map((e) => cornerLeft[e]), area: polygonArea(axis) });
  }
  const rooms = [];
  const outlines = [];
  const exteriorWalls = /* @__PURE__ */ new Set();
  const usedMeta = /* @__PURE__ */ new Set();
  for (const f of faces) {
    if (f.area > 1e-6) {
      const inner = f.inner;
      const meta = project.rooms.find((r) => !usedMeta.has(r.id) && pointInPolygon(r.anchor, inner));
      if (meta) usedMeta.add(meta.id);
      rooms.push({
        ...f,
        area: Math.abs(polygonArea(inner)),
        metaId: meta?.id ?? null,
        name: meta?.name ?? `Cômodo ${rooms.length + 1}`,
        label: meta ? meta.anchor : interiorPoint(inner)
      });
    } else if (f.area < -1e-6) {
      outlines.push({ ...f, area: Math.abs(polygonArea(f.inner)) });
      for (const h2 of f.halfEdges) exteriorWalls.add(raw[h2 >> 1].wallId);
    }
  }
  return { nodes, segments, hubs, rooms, outlines, exteriorWalls };
}
function roomAt(plan, p) {
  return plan.rooms.filter((r) => pointInPolygon(p, r.inner)).sort((a, b) => a.area - b.area)[0];
}
function insideSide(plan, wall, u) {
  const d = normalize(sub(wall.b, wall.a));
  const n = leftNormal(d);
  const p = add(wall.a, scale(d, u));
  const off = wall.thickness / 2 + 0.05;
  const left = !!roomAt(plan, add(p, scale(n, off)));
  const right = !!roomAt(plan, add(p, scale(n, -off)));
  return right && !left ? -1 : 1;
}
class Store extends EventTarget {
  history = new History(createProject());
  selection = null;
  filePath = null;
  dirty = false;
  planCache = null;
  planKey = "";
  get project() {
    return this.history.current;
  }
  get plan() {
    const key = JSON.stringify([this.project.walls, this.project.rooms]);
    if (!this.planCache || key !== this.planKey) {
      this.planCache = analyzePlan(this.project);
      this.planKey = key;
    }
    return this.planCache;
  }
  selectedRoom() {
    return this.selection?.kind === "room" ? roomAt(this.plan, this.selection.at) : void 0;
  }
  changed() {
    this.dirty = true;
    this.validateSelection();
    this.dispatchEvent(new Event("change"));
  }
  edit(label, fn) {
    this.history.edit(label, fn);
    this.changed();
  }
  /** Início de uma edição contínua (arraste): guarda o ponto de desfazer. */
  begin(label) {
    this.history.checkpoint(label);
  }
  /** Mutação durante a edição contínua (sem novo ponto de desfazer). */
  touch(fn) {
    fn(this.project);
    this.changed();
  }
  end() {
    this.history.dropIfUnchanged();
    this.dispatchEvent(new Event("change"));
  }
  undo() {
    if (this.history.undo() != null) this.changed();
  }
  redo() {
    if (this.history.redo() != null) this.changed();
  }
  load(project, path) {
    this.history.reset(project);
    this.filePath = path;
    this.dirty = false;
    this.selection = null;
    this.dispatchEvent(new Event("change"));
    this.dispatchEvent(new Event("selection"));
  }
  markSaved(path) {
    this.filePath = path;
    this.dirty = false;
    this.dispatchEvent(new Event("change"));
  }
  select(sel) {
    this.selection = sel;
    this.dispatchEvent(new Event("selection"));
  }
  validateSelection() {
    const s = this.selection;
    if (!s) return;
    const p = this.project;
    const alive = s.kind === "wall" ? p.walls.some((w) => w.id === s.id) : s.kind === "opening" ? p.openings.some((o) => o.id === s.id) : s.kind === "dimension" ? p.dimensions.some((d) => d.id === s.id) : !!roomAt(this.plan, s.at);
    if (!alive) this.select(null);
  }
  deleteSelection() {
    const s = this.selection;
    if (!s || s.kind === "room") return;
    this.edit("Excluir", (p) => {
      if (s.kind === "wall") {
        p.walls = p.walls.filter((w) => w.id !== s.id);
        p.openings = p.openings.filter((o) => o.wallId !== s.id);
      } else if (s.kind === "opening") {
        p.openings = p.openings.filter((o) => o.id !== s.id);
      } else {
        p.dimensions = p.dimensions.filter((d) => d.id !== s.id);
      }
    });
    this.select(null);
  }
}
const MATERIALS = {
  madeira: { name: "Madeira", color: 9067059, roughness: 0.7, metalness: 0 },
  aco: { name: "Aço", color: 7041141, roughness: 0.45, metalness: 0.9 },
  aluminio: { name: "Alumínio", color: 13225168, roughness: 0.35, metalness: 0.9 },
  vidro: { name: "Vidro temperado", color: 12573152, roughness: 0.05, metalness: 0, opacity: 0.25 }
};
const OPTION_LABELS = {
  hinge: "Dobradiça",
  swing: "Abre para",
  slideTo: "Corre para",
  mount: "Instalação"
};
const HINGE = ["esquerda", "direita"];
const SWING = ["dentro", "fora"];
const DOOR_MODELS = [
  {
    id: "porta-giro-1f",
    kind: "porta",
    name: "Porta de abrir — 1 folha",
    operation: "giro",
    leaves: 1,
    materials: ["madeira", "aco", "aluminio", "vidro"],
    sizes: [[0.6, 2.1], [0.7, 2.1], [0.8, 2.1], [0.9, 2.1]],
    default: [0.8, 2.1],
    sill: 0,
    options: { hinge: HINGE, swing: SWING }
  },
  {
    id: "porta-giro-2f",
    kind: "porta",
    name: "Porta de abrir — 2 folhas",
    operation: "giro",
    leaves: 2,
    materials: ["madeira", "aco", "aluminio", "vidro"],
    sizes: [[1.2, 2.1], [1.4, 2.1], [1.6, 2.1]],
    default: [1.2, 2.1],
    sill: 0,
    options: { swing: SWING }
  },
  {
    id: "porta-correr-1f",
    kind: "porta",
    name: "Porta de correr — 1 folha",
    operation: "correr",
    leaves: 1,
    materials: ["madeira", "aco", "aluminio", "vidro"],
    sizes: [[0.7, 2.1], [0.8, 2.1], [0.9, 2.1]],
    default: [0.8, 2.1],
    sill: 0,
    options: { slideTo: HINGE, mount: ["aparente", "embutida"] }
  },
  {
    id: "porta-correr-2f",
    kind: "porta",
    name: "Porta de correr — 2 folhas",
    operation: "correr",
    leaves: 2,
    materials: ["aluminio", "aco", "vidro", "madeira"],
    sizes: [[1.2, 2.1], [1.5, 2.1], [2, 2.1], [2.4, 2.1]],
    default: [1.5, 2.1],
    sill: 0,
    options: {}
  },
  {
    id: "porta-pivotante",
    kind: "porta",
    name: "Porta pivotante",
    operation: "pivotante",
    leaves: 1,
    materials: ["madeira", "aco", "vidro"],
    sizes: [[1, 2.4], [1.2, 2.4], [1.5, 2.7]],
    default: [1.2, 2.4],
    sill: 0,
    options: { swing: SWING }
  }
];
const WINDOW_MODELS = [
  {
    id: "janela-correr-2f",
    kind: "janela",
    name: "Janela de correr — 2 folhas",
    operation: "correr",
    leaves: 2,
    materials: ["aluminio", "aco", "madeira"],
    sizes: [[1, 1], [1.2, 1], [1.2, 1.2], [1.5, 1.2], [2, 1.2]],
    default: [1.2, 1],
    sill: 1.1,
    options: {}
  },
  {
    id: "janela-correr-4f",
    kind: "janela",
    name: "Janela de correr — 4 folhas",
    operation: "correr",
    leaves: 4,
    materials: ["aluminio", "aco"],
    sizes: [[1.5, 1.2], [2, 1.2], [2.4, 1.2]],
    default: [2, 1.2],
    sill: 0.9,
    options: {}
  },
  {
    id: "janela-giro-2f",
    kind: "janela",
    name: "Janela de abrir — 2 folhas",
    operation: "giro",
    leaves: 2,
    materials: ["madeira", "aluminio", "aco"],
    sizes: [[1, 1], [1.2, 1], [1.2, 1.2]],
    default: [1, 1],
    sill: 1.1,
    options: { swing: SWING }
  },
  {
    id: "janela-basculante",
    kind: "janela",
    name: "Basculante (banheiro/área)",
    operation: "basculante",
    leaves: 1,
    materials: ["aluminio", "aco"],
    sizes: [[0.4, 0.4], [0.6, 0.6], [0.8, 0.6], [1, 0.6]],
    default: [0.6, 0.6],
    sill: 1.5,
    options: {}
  },
  {
    id: "janela-maxim-ar",
    kind: "janela",
    name: "Maxim-ar",
    operation: "maxim-ar",
    leaves: 1,
    materials: ["aluminio", "aco"],
    sizes: [[0.6, 0.6], [0.8, 0.6], [1, 0.6], [1, 0.8]],
    default: [0.6, 0.6],
    sill: 1.5,
    options: {}
  },
  {
    id: "janela-fixa",
    kind: "janela",
    name: "Vidro fixo",
    operation: "fixa",
    leaves: 1,
    materials: ["aluminio", "vidro"],
    sizes: [[0.6, 1], [1, 1], [1.5, 1.5]],
    default: [1, 1],
    sill: 1.1,
    options: {}
  }
];
const findOpeningModel = (id) => DOOR_MODELS.find((m) => m.id === id) ?? WINDOW_MODELS.find((m) => m.id === id);
function angleSnap(p, from, stepDeg, gridStep, force) {
  const d = sub(p, from);
  const l = len(d);
  if (l < 1e-9) return null;
  const ang = Math.atan2(d.y, d.x);
  const step = stepDeg * Math.PI / 180;
  const snapped = Math.round(ang / step) * step;
  if (!force && Math.abs(snapped - ang) > 4 * Math.PI / 180) return null;
  const length = roundTo(l * Math.cos(snapped - ang), gridStep);
  return add(from, scale({ x: Math.cos(snapped), y: Math.sin(snapped) }, length));
}
function snapPoint(p, ctx) {
  const walls = ctx.walls.filter((w) => !ctx.ignore?.has(w.id));
  if (!ctx.ortho) {
    let best = null;
    let bestD = ctx.tolerance;
    const consider = (q, kind, wallId) => {
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = { point: { x: q.x, y: q.y }, kind, wallId };
      }
    };
    for (const w of walls) {
      consider(w.a, "extremidade", w.id);
      consider(w.b, "extremidade", w.id);
    }
    for (const q of ctx.extraPoints ?? []) consider(q, "extremidade");
    if (best) return best;
    for (const w of walls) consider(lerp(w.a, w.b, 0.5), "meio", w.id);
    if (best) return best;
  }
  if (ctx.from) {
    const q = angleSnap(p, ctx.from, ctx.ortho ? 90 : ctx.angleStepDeg ?? 15, ctx.gridStep, !!ctx.ortho);
    if (q) return { point: q, kind: "angulo" };
  }
  if (!ctx.ortho) {
    let best = null;
    let bestD = ctx.tolerance;
    for (const w of walls) {
      const pr = projectOnSegment(p, w.a, w.b);
      if (pr.distance < bestD) {
        bestD = pr.distance;
        best = { point: pr.point, kind: "parede", wallId: w.id };
      }
    }
    if (best) return best;
  }
  return { point: { x: roundTo(p.x, ctx.gridStep), y: roundTo(p.y, ctx.gridStep) }, kind: "grade" };
}
const EPS = 1e-6;
function validateOpenings(wall, openings) {
  const errors = [];
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  sorted.forEach((o, i) => {
    const id = o.id ?? i;
    if (o.width <= 0 || o.height <= 0) errors.push({ id, msg: "Vão com dimensão nula" });
    if (o.offset < -EPS || o.offset + o.width > wall.length + EPS) errors.push({ id, msg: "Vão fora dos limites da parede" });
    if (o.sill < -EPS || o.sill + o.height > wall.height + EPS) errors.push({ id, msg: "Vão mais alto que a parede" });
    const prev = sorted[i - 1];
    if (prev && o.offset < prev.offset + prev.width - EPS) errors.push({ id, msg: "Vão sobrepõe outro vão", other: prev.id ?? i - 1 });
  });
  return errors;
}
function placeOnWall(wall, width, u, step = 0.05) {
  const max = wallLength(wall) - width;
  return Math.min(Math.max(0, roundTo(u - width / 2, step)), Math.max(0, max));
}
function openingsOfWall(project, wallId) {
  return project.openings.filter((o) => o.wallId === wallId);
}
function openingErrors(project, candidate) {
  const wall = project.walls.find((w) => w.id === candidate.wallId);
  if (!wall) return [{ id: candidate.id, msg: "Parede inexistente" }];
  const others = openingsOfWall(project, wall.id).filter((o) => o.id !== candidate.id);
  const all = [...others, candidate];
  return validateOpenings({ length: wallLength(wall), height: wall.height }, all).filter(
    (e) => e.id === candidate.id || e.other === candidate.id
  );
}
function invalidOpenings(project) {
  const bad = /* @__PURE__ */ new Set();
  for (const w of project.walls) {
    const list = openingsOfWall(project, w.id);
    for (const e of validateOpenings({ length: wallLength(w), height: w.height }, list)) {
      bad.add(String(e.id));
      if (e.other != null) bad.add(String(e.other));
    }
  }
  for (const o of project.openings) if (!project.walls.some((w) => w.id === o.wallId)) bad.add(o.id);
  return bad;
}
function resolveOpening(plan, wall, o) {
  const model = findOpeningModel(o.modelId);
  const inside = insideSide(plan, wall, o.offset + o.width / 2);
  const side = (o.options.swing ?? "dentro") === "dentro" ? inside : -inside;
  const hingeAtStart = (o.options.hinge ?? "esquerda") === "direita" ? side === 1 : side === -1;
  const slideToStart = (o.options.slideTo ?? "esquerda") === "direita" ? inside === 1 : inside === -1;
  return {
    operation: model?.operation ?? "fixa",
    leaves: model?.leaves ?? 1,
    width: o.width,
    height: o.height,
    side,
    hingeAtStart,
    slideToStart
  };
}
const THEME = {
  paper: "#ffffff",
  gridMinor: "#eef1f4",
  gridMajor: "#d9dee4",
  axis: "#c3cad2",
  wallFill: "#3b4046",
  wallStroke: "#1d2024",
  roomFill: "#f5efe3",
  roomFillSelected: "#fde7b0",
  roomFillHover: "#faeed3",
  roomText: "#4a4f55",
  opening: "#1d2024",
  openingInvalid: "#dc2626",
  dimension: "#2563eb",
  selection: "#f59e0b",
  hover: "#fbbf24",
  preview: "#16a34a",
  previewInvalid: "#dc2626",
  snap: "#db2777",
  font: "12px system-ui, sans-serif",
  fontBold: "600 13px system-ui, sans-serif"
};
class Draw {
  constructor(ctx, vp) {
    this.ctx = ctx;
    this.vp = vp;
  }
  ctx;
  vp;
  path(points, close = false) {
    const { ctx, vp } = this;
    ctx.beginPath();
    points.forEach((p, i) => {
      const s = vp.toScreen(p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    if (close) ctx.closePath();
  }
  line(a, b, color, width = 1, dash = []) {
    const { ctx } = this;
    this.path([a, b]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  polygon(points, fill, stroke, width = 1) {
    const { ctx } = this;
    this.path(points, true);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
  /** arco em torno de `center` de `from` até `to` (ângulos em rad, no mundo) */
  arc(center, radius, from, to, color, width = 1, dash = []) {
    const pts = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const a = from + (to - from) * i / n;
      pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
    }
    this.path(pts);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.setLineDash(dash);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }
  dot(p, radiusPx, fill, stroke) {
    const s = this.vp.toScreen(p);
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  /** texto centrado em p; `angle` no mundo (rad), mantido legível */
  text(p, text, color, font = THEME.font, angle = 0, background) {
    const { ctx } = this;
    const s = this.vp.toScreen(p);
    let a = -angle;
    while (a >= Math.PI / 2 - 1e-6) a -= Math.PI;
    while (a < -Math.PI / 2 - 1e-6) a += Math.PI;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (background) {
      const w = ctx.measureText(text).width + 6;
      ctx.fillStyle = background;
      ctx.fillRect(-w / 2, -8, w, 16);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  /** linha de cota de a até b, deslocada `offset` m para a esquerda de a→b */
  dimension(a, b, offset, color = THEME.dimension, width = 1) {
    const l = dist(a, b);
    if (l < 1e-6) return;
    const d = normalize(sub(b, a));
    const n = leftNormal(d);
    const off = scale(n, offset);
    const pa = add(a, off);
    const pb = add(b, off);
    const ext = scale(n, Math.sign(offset || 1) * this.vp.px(6));
    const gap = scale(n, Math.sign(offset || 1) * this.vp.px(3));
    this.line(add(a, gap), add(pa, ext), color, 0.75);
    this.line(add(b, gap), add(pb, ext), color, 0.75);
    this.line(pa, pb, color, width);
    const t = this.vp.px(4);
    const tick = add(scale(d, t), scale(n, t));
    this.line(sub(pa, tick), add(pa, tick), color, 1.5);
    this.line(sub(pb, tick), add(pb, tick), color, 1.5);
    const mid = add(scale(add(pa, pb), 0.5), scale(n, this.vp.px(8) * Math.sign(offset || 1)));
    this.text(mid, formatNumber(l), color, THEME.font, Math.atan2(d.y, d.x), THEME.paper);
  }
}
function wallFrame(w) {
  const dir = normalize(sub(w.b, w.a));
  const normal = leftNormal(dir);
  return {
    origin: w.a,
    dir,
    normal,
    length: dist(w.a, w.b),
    at: (u, n = 0) => add(add(w.a, scale(dir, u)), scale(normal, n)),
    local: (p) => {
      const d = sub(p, w.a);
      return { u: dot(d, dir), n: dot(d, normal) };
    }
  };
}
const angleOf = (v) => Math.atan2(v.y, v.x);
function sweep(d, center, from, to, color, dash = []) {
  const a0 = angleOf(sub(from, center));
  let delta = angleOf(sub(to, center)) - a0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  d.arc(center, Math.hypot(from.x - center.x, from.y - center.y), a0, a0 + delta, color, 1, dash);
}
function leafRect(d, at, u0, u1, n, thick, color, dash = []) {
  const pts = [at(u0, n - thick / 2), at(u1, n - thick / 2), at(u1, n + thick / 2), at(u0, n + thick / 2)];
  d.path(pts, true);
  d.ctx.strokeStyle = color;
  d.ctx.lineWidth = 1.25;
  d.ctx.setLineDash(dash);
  d.ctx.stroke();
  d.ctx.setLineDash([]);
}
function drawOpening(d, wall, o, r, color, cut = true) {
  const model = findOpeningModel(o.modelId);
  const f = wallFrame(wall);
  const at = f.at;
  const half = wall.thickness / 2;
  const u0 = o.offset;
  const u1 = o.offset + o.width;
  const w = o.width;
  const s = r.side;
  if (cut) d.polygon([at(u0, -half - 0.01), at(u1, -half - 0.01), at(u1, half + 0.01), at(u0, half + 0.01)], THEME.paper);
  d.line(at(u0, -half), at(u0, half), color, 1.5);
  d.line(at(u1, -half), at(u1, half), color, 1.5);
  const isDoor = model?.kind !== "janela";
  if (!isDoor) {
    d.line(at(u0, -half), at(u1, -half), color, 0.75);
    d.line(at(u0, half), at(u1, half), color, 0.75);
  }
  switch (r.operation) {
    case "giro": {
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
    case "pivotante": {
      const face = s * half;
      const pu = r.hingeAtStart ? u0 + w / 6 : u1 - w / 6;
      const far = r.hingeAtStart ? u1 : u0;
      const pivot = at(pu, face);
      d.line(at(pu, face - s * w / 6), at(pu, face + s * 5 * w / 6), color, 2.5);
      sweep(d, pivot, at(far, face), at(pu, face + s * 5 * w / 6), color);
      d.dot(pivot, 2.5, color);
      break;
    }
    case "correr": {
      const thick = Math.min(0.04, half / 2);
      if (r.leaves === 1) {
        const embutida = o.options.mount === "embutida";
        const n = embutida ? 0 : s * (half + thick);
        const shift = (r.slideToStart ? -1 : 1) * w;
        leafRect(d, at, u0, u1, n, thick, color);
        leafRect(d, at, u0 + shift, u1 + shift, n, thick, color, [4, 3]);
      } else {
        const lw = w / r.leaves;
        for (let i = 0; i < r.leaves; i++) {
          const track = (r.leaves === 4 ? i === 1 || i === 2 : i % 2 === 1) ? 1 : -1;
          const a = u0 + i * lw - (i > 0 ? 0.03 : 0);
          const b = u0 + (i + 1) * lw + (i < r.leaves - 1 ? 0.03 : 0);
          leafRect(d, at, a, b, track * half / 3, thick, color);
        }
      }
      break;
    }
    case "basculante":
    case "maxim-ar":
      d.line(at(u0, 0), at(u1, 0), color, 1);
      d.line(at(u0, s * (half + 0.12)), at(u1, s * (half + 0.12)), color, 1, [4, 3]);
      break;
    case "fixa":
      d.line(at(u0, 0), at(u1, 0), color, 1.25);
      break;
  }
}
const GRID_STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25];
function simplify(poly) {
  return poly.filter((p, i) => {
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const next = poly[(i + 1) % poly.length];
    return Math.abs(cross(sub(p, prev), sub(next, p))) > 1e-6 && dist(p, prev) > 1e-6;
  });
}
class PlanRenderer {
  constructor(ctx, vp) {
    this.ctx = ctx;
    this.vp = vp;
    this.draw = new Draw(ctx, vp);
  }
  ctx;
  vp;
  draw;
  render(store2, hover) {
    const { ctx, vp, draw: d } = this;
    const project = store2.project;
    const plan = store2.plan;
    const sel = store2.selection;
    ctx.fillStyle = THEME.paper;
    ctx.fillRect(0, 0, vp.width, vp.height);
    this.grid();
    const selRoom = store2.selectedRoom();
    const hoverRoom = hover?.kind === "room" ? roomAt(plan, hover.at) : void 0;
    for (const room of plan.rooms) {
      d.polygon(room.inner, room === selRoom ? THEME.roomFillSelected : room === hoverRoom ? THEME.roomFillHover : THEME.roomFill);
    }
    for (const s of plan.segments) d.polygon(s.polygon, THEME.wallFill, THEME.wallFill, 0.75);
    for (const hub of plan.hubs) d.polygon(hub, THEME.wallFill, THEME.wallFill, 0.75);
    for (const s of plan.segments) {
      const [al, bl, br, ar] = s.polygon;
      const highlighted = sel?.kind === "wall" && sel.id === s.wallId || hover?.kind === "wall" && hover.id === s.wallId;
      const color = sel?.kind === "wall" && sel.id === s.wallId ? THEME.selection : THEME.wallStroke;
      if (highlighted) d.polygon(s.polygon, sel?.kind === "wall" && sel.id === s.wallId ? "rgba(245,158,11,.55)" : "rgba(251,191,36,.35)");
      d.line(al, bl, color, 1.25);
      d.line(br, ar, color, 1.25);
      if (s.capA) d.line(ar, al, color, 1.25);
      if (s.capB) d.line(bl, br, color, 1.25);
    }
    const invalid = invalidOpenings(project);
    for (const o of project.openings) {
      const wall = project.walls.find((w) => w.id === o.wallId);
      if (!wall) continue;
      const selected = sel?.kind === "opening" && sel.id === o.id;
      const hovered = hover?.kind === "opening" && hover.id === o.id;
      const color = invalid.has(o.id) ? THEME.openingInvalid : selected ? THEME.selection : hovered ? THEME.hover : THEME.opening;
      drawOpening(d, wall, o, resolveOpening(plan, wall, o), color);
    }
    for (const room of plan.rooms) {
      d.text(room.label, room.name, THEME.roomText, THEME.fontBold);
      d.text(add(room.label, { x: 0, y: -vp.px(16) }), formatArea(room.area), THEME.roomText);
    }
    for (const outline of plan.outlines) {
      const poly = simplify(outline.inner);
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length];
        if (dist(a, b) >= 0.3) d.dimension(a, b, 0.6, THEME.dimension);
      });
    }
    for (const dim of project.dimensions) {
      const selected = sel?.kind === "dimension" && sel.id === dim.id;
      const hovered = hover?.kind === "dimension" && hover.id === dim.id;
      d.dimension(dim.a, dim.b, dim.offset, selected ? THEME.selection : hovered ? THEME.hover : THEME.dimension, selected ? 2 : 1);
    }
    if (sel?.kind === "wall") {
      const w = project.walls.find((x) => x.id === sel.id);
      if (w) for (const p of [w.a, w.b]) d.dot(p, 5, THEME.paper, THEME.selection);
    }
    if (hover?.kind === "endpoint") d.dot(hover.at, 5, THEME.hover, THEME.selection);
  }
  /** Desenha um vão ainda não inserido (pré-visualização da ferramenta). */
  previewOpening(store2, o, valid) {
    const wall = store2.project.walls.find((w) => w.id === o.wallId);
    if (!wall) return;
    const color = valid ? THEME.preview : THEME.previewInvalid;
    drawOpening(this.draw, wall, o, resolveOpening(store2.plan, wall, o), color);
    const model = findOpeningModel(o.modelId);
    const f = normalize(sub(wall.b, wall.a));
    const n = leftNormal(f);
    const mid = add(add(wall.a, scale(f, o.offset + o.width / 2)), scale(n, -(wall.thickness / 2 + this.vp.px(14))));
    this.draw.text(mid, `${model?.name ?? ""} ${o.width.toFixed(2).replace(".", ",")} × ${o.height.toFixed(2).replace(".", ",")}`, color, THEME.font, Math.atan2(f.y, f.x), THEME.paper);
  }
  grid() {
    const { vp, draw: d } = this;
    const minor = GRID_STEPS.find((s) => s * vp.scale >= 12) ?? 25;
    const major = minor < 1 ? 1 : minor * 5;
    const tl = vp.toWorld({ x: 0, y: 0 });
    const br = vp.toWorld({ x: vp.width, y: vp.height });
    const lines = (step, color) => {
      for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) d.line({ x, y: br.y }, { x, y: tl.y }, color, 1);
      for (let y = Math.floor(br.y / step) * step; y <= tl.y; y += step) d.line({ x: tl.x, y }, { x: br.x, y }, color, 1);
    };
    lines(minor, THEME.gridMinor);
    lines(major, THEME.gridMajor);
    d.line({ x: 0, y: br.y }, { x: 0, y: tl.y }, THEME.axis, 1);
    d.line({ x: tl.x, y: 0 }, { x: br.x, y: 0 }, THEME.axis, 1);
  }
}
class BaseTool {
  constructor(editor2) {
    this.editor = editor2;
  }
  editor;
  cursor = "crosshair";
  snap = null;
  get store() {
    return this.editor.store;
  }
}
class DimensionTool extends BaseTool {
  name = "dimension";
  a = null;
  b = null;
  pos = null;
  hint() {
    if (!this.a) return "Cota: clique no primeiro ponto.";
    if (!this.b) return "Cota: clique no segundo ponto.";
    return "Cota: posicione a linha e clique.";
  }
  offsetFor(p) {
    const d = normalize(sub(this.b, this.a));
    return Math.round(dot(sub(p, this.a), leftNormal(d)) / 0.05) * 0.05;
  }
  pointerMove(e) {
    if (this.a && this.b) {
      this.snap = null;
      this.pos = e.world;
      return;
    }
    this.snap = this.editor.snap(e.world, { from: this.a ?? void 0, ortho: e.shift });
    this.pos = this.snap.point;
  }
  pointerDown(e) {
    if (e.button !== 0) return;
    this.pointerMove(e);
    const p = this.pos;
    if (!this.a) this.a = p;
    else if (!this.b) {
      if (dist(this.a, p) > 0.01) this.b = p;
    } else {
      const dim = { id: newId("dim"), a: this.a, b: this.b, offset: this.offsetFor(p) };
      this.store.edit("Cota", (proj) => {
        proj.dimensions.push(dim);
      });
      this.a = this.b = null;
    }
  }
  cancel() {
    if (!this.a) return false;
    this.a = this.b = null;
    return true;
  }
  drawOverlay(d) {
    if (this.snap) this.editor.drawSnap(d, this.snap);
    if (!this.a || !this.pos) return;
    if (!this.b) d.dimension(this.a, this.pos, 0, THEME.preview);
    else d.dimension(this.a, this.b, this.offsetFor(this.pos), THEME.preview);
  }
}
function pickOpening(project, p, tol) {
  for (const o of project.openings) {
    const wall = project.walls.find((w) => w.id === o.wallId);
    if (!wall) continue;
    const { u, n } = wallFrame(wall).local(p);
    if (u >= o.offset - tol && u <= o.offset + o.width + tol && Math.abs(n) <= wall.thickness / 2 + tol) return o;
  }
  return void 0;
}
function pickWall(project, plan, p, tol) {
  const seg = plan.segments.find((s) => pointInPolygon(p, s.polygon));
  if (seg) return project.walls.find((w) => w.id === seg.wallId);
  let best;
  let bestD = Infinity;
  for (const w of project.walls) {
    const d = projectOnSegment(p, w.a, w.b).distance - w.thickness / 2;
    if (d < tol && d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}
function nearestWall(project, p, reach) {
  let best;
  let bestD = Infinity;
  for (const w of project.walls) {
    const d = projectOnSegment(p, w.a, w.b).distance;
    if (d < Math.max(reach, w.thickness / 2 + reach / 2) && d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}
function dimensionLine(dim) {
  const n = leftNormal(normalize(sub(dim.b, dim.a)));
  const off = scale(n, dim.offset);
  return [add(dim.a, off), add(dim.b, off)];
}
function pickDimension(project, p, tol) {
  return project.dimensions.find((d) => {
    const [a, b] = dimensionLine(d);
    return projectOnSegment(p, a, b).distance < tol;
  });
}
function pickEndpoint(project, p, tol) {
  let best;
  let bestD = tol;
  for (const w of project.walls) {
    for (const q of [w.a, w.b]) {
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best ? { ...best } : void 0;
}
class OpeningTool extends BaseTool {
  constructor(editor2, name) {
    super(editor2);
    this.name = name;
  }
  name;
  cursor = "copy";
  candidate = null;
  valid = false;
  hint() {
    const choice = this.editor.openingChoice[this.name];
    const model = findOpeningModel(choice.modelId);
    return `${model?.name ?? ""}: passe sobre uma parede e clique para inserir. O lado do cursor define a abertura.`;
  }
  pointerMove(e) {
    const wall = nearestWall(this.store.project, e.world, this.editor.tolerance() * 2);
    const choice = this.editor.openingChoice[this.name];
    const model = findOpeningModel(choice.modelId);
    if (!wall || !model) {
      this.candidate = null;
      return;
    }
    const f = wallFrame(wall);
    const { u, n } = f.local(e.world);
    const [width, height] = choice.size;
    const options = { ...choice.options };
    if (model.options.swing) {
      const inside = insideSide(this.store.plan, wall, u);
      options.swing = Math.sign(n || 1) === inside ? "dentro" : "fora";
    }
    this.candidate = createOpening(wall.id, model, {
      offset: placeOnWall(wall, width, u),
      size: [width, height],
      sill: choice.sill,
      material: choice.material,
      options
    });
    this.valid = width <= f.length && openingErrors(this.store.project, this.candidate).length === 0;
  }
  pointerDown(e) {
    if (e.button !== 0) return;
    this.pointerMove(e);
    const c = this.candidate;
    if (!c || !this.valid) return;
    this.store.edit(this.name === "door" ? "Inserir porta" : "Inserir janela", (p) => {
      p.openings.push(c);
    });
    this.store.select({ kind: "opening", id: c.id });
    this.candidate = null;
  }
  deactivate() {
    this.candidate = null;
  }
  drawOverlay() {
    if (this.candidate) this.editor.renderer.previewOpening(this.store, this.candidate, this.valid);
  }
}
const TOL = 1e-3;
function findAttachments(walls, hosts) {
  const out = [];
  for (const host of walls) {
    if (!hosts.has(host.id)) continue;
    for (const w of walls) {
      if (hosts.has(w.id)) continue;
      for (const end of ["a", "b"]) {
        const pr = projectOnSegment(w[end], host.a, host.b);
        if (pr.distance < TOL && pr.t > 1e-6 && pr.t < 1 - 1e-6) out.push({ wallId: w.id, end, hostId: host.id });
      }
    }
  }
  return out;
}
function applyAttachments(walls, attachments) {
  for (const at of attachments) {
    const host = walls.find((w2) => w2.id === at.hostId);
    const w = walls.find((x) => x.id === at.wallId);
    if (host && w) w[at.end] = projectOnSegment(w[at.end], host.a, host.b).point;
  }
}
function wallsAt(walls, p) {
  return new Set(walls.filter((w) => Math.hypot(w.a.x - p.x, w.a.y - p.y) < TOL || Math.hypot(w.b.x - p.x, w.b.y - p.y) < TOL).map((w) => w.id));
}
const TOL_JOIN = 1e-3;
class SelectTool extends BaseTool {
  name = "select";
  cursor = "default";
  drag = null;
  hint() {
    return "Clique para selecionar; arraste extremidades, paredes, vãos e cotas. Delete exclui. Duplo clique no cômodo renomeia.";
  }
  /** Alvo sob o cursor, na mesma prioridade do clique. */
  hoverAt(p) {
    const tol = this.editor.tolerance();
    const project = this.store.project;
    const end = pickEndpoint(project, p, tol);
    if (end) return { kind: "endpoint", at: end };
    const o = pickOpening(project, p, tol / 2);
    if (o) return { kind: "opening", id: o.id };
    const dim = pickDimension(project, p, tol / 2);
    if (dim) return { kind: "dimension", id: dim.id };
    const w = pickWall(project, this.store.plan, p, tol / 2);
    if (w) return { kind: "wall", id: w.id };
    if (roomAt(this.store.plan, p)) return { kind: "room", at: p };
    return null;
  }
  pointerMove(e) {
    if (!this.drag) {
      this.editor.hover = this.hoverAt(e.world);
      this.snap = null;
      return;
    }
    const drag = this.drag;
    if (drag.kind === "endpoint") {
      this.snap = this.editor.snap(e.world, { ignore: drag.moving, ortho: false });
      const to = this.snap.point;
      this.store.touch((p) => {
        for (const w of p.walls) {
          if (dist(w.a, drag.from) < TOL_JOIN) w.a = { ...to };
          if (dist(w.b, drag.from) < TOL_JOIN) w.b = { ...to };
        }
        applyAttachments(p.walls, drag.attached);
      });
      drag.from = to;
    } else if (drag.kind === "wall") {
      const step = this.store.project.settings.gridStep;
      const dx = roundTo(e.world.x - drag.start.x, step);
      const dy = roundTo(e.world.y - drag.start.y, step);
      this.store.touch((p) => {
        const w = p.walls.find((x) => x.id === drag.id);
        if (!w) return;
        const na = { x: drag.a0.x + dx, y: drag.a0.y + dy };
        const nb = { x: drag.b0.x + dx, y: drag.b0.y + dy };
        for (const o of p.walls) {
          if (o === w) continue;
          if (dist(o.a, w.a) < TOL_JOIN) o.a = { ...na };
          if (dist(o.b, w.a) < TOL_JOIN) o.b = { ...na };
          if (dist(o.a, w.b) < TOL_JOIN) o.a = { ...nb };
          if (dist(o.b, w.b) < TOL_JOIN) o.b = { ...nb };
        }
        w.a = na;
        w.b = nb;
        applyAttachments(p.walls, drag.attached);
      });
    } else if (drag.kind === "opening") {
      this.store.touch((p) => {
        const o = p.openings.find((x) => x.id === drag.id);
        if (!o) return;
        const target = nearestWall(p, e.world, this.editor.tolerance() * 2) ?? p.walls.find((w) => w.id === o.wallId);
        if (!target) return;
        o.wallId = target.id;
        o.offset = placeOnWall(target, o.width, wallFrame(target).local(e.world).u);
      });
    } else {
      this.store.touch((p) => {
        const dim = p.dimensions.find((x) => x.id === drag.id);
        if (!dim) return;
        const n = leftNormal(normalize(sub(dim.b, dim.a)));
        dim.offset = roundTo(dot(sub(e.world, dim.a), n), 0.05);
      });
    }
  }
  pointerDown(e) {
    if (e.button !== 0) return;
    const hit = this.hoverAt(e.world);
    const project = this.store.project;
    if (!hit) {
      this.store.select(null);
      return;
    }
    switch (hit.kind) {
      case "endpoint":
        this.store.begin("Mover extremidade");
        {
          const moving = wallsAt(project.walls, hit.at);
          this.drag = { kind: "endpoint", from: hit.at, moving, attached: findAttachments(project.walls, moving) };
        }
        break;
      case "opening":
        this.store.select({ kind: "opening", id: hit.id });
        this.store.begin("Mover vão");
        this.drag = { kind: "opening", id: hit.id };
        break;
      case "dimension":
        this.store.select({ kind: "dimension", id: hit.id });
        this.store.begin("Mover cota");
        this.drag = { kind: "dimension", id: hit.id };
        break;
      case "wall": {
        const w = project.walls.find((x) => x.id === hit.id);
        this.store.select({ kind: "wall", id: hit.id });
        this.store.begin("Mover parede");
        const hosts = /* @__PURE__ */ new Set([w.id, ...wallsAt(project.walls, w.a), ...wallsAt(project.walls, w.b)]);
        this.drag = { kind: "wall", id: w.id, start: e.world, a0: { ...w.a }, b0: { ...w.b }, attached: findAttachments(project.walls, hosts) };
        break;
      }
      case "room":
        this.store.select({ kind: "room", at: e.world });
        break;
    }
  }
  pointerUp() {
    if (this.drag) {
      this.drag = null;
      this.snap = null;
      this.store.end();
    }
  }
  doubleClick(e) {
    if (roomAt(this.store.plan, e.world)) {
      this.store.select({ kind: "room", at: e.world });
      this.editor.dispatchEvent(new Event("rename-room"));
    }
  }
  cancel() {
    if (this.store.selection) {
      this.store.select(null);
      return true;
    }
    return false;
  }
  drawOverlay(d) {
    if (this.snap) this.editor.drawSnap(d, this.snap);
  }
}
class WallTool extends BaseTool {
  name = "wall";
  start = null;
  chainStart = null;
  pos = null;
  lastDir = { x: 1, y: 0 };
  /** pontos clicados da cadeia atual (linha de referência) e paredes criadas por ela */
  chain = [];
  chainWalls = [];
  typed = "";
  hint() {
    if (!this.start) return "Clique para iniciar a parede. Shift = ortogonal.";
    return this.typed ? `Comprimento: ${this.typed} — Enter confirma` : "Clique o próximo ponto ou digite o comprimento. Esc encerra; clicar no início fecha o contorno.";
  }
  snapAt(e) {
    const extra = this.chainStart ? [this.chainStart] : [];
    this.snap = this.editor.snap(e.world, { from: this.start ?? void 0, ortho: e.shift, extraPoints: extra });
    return this.snap.point;
  }
  pointerMove(e) {
    this.pos = this.snapAt(e);
  }
  pointerDown(e) {
    if (e.button !== 0) return;
    this.place(this.snapAt(e));
  }
  doubleClick() {
    this.finish();
  }
  place(p) {
    if (!this.start) {
      this.start = p;
      this.chainStart = p;
      this.chain = [p];
      this.chainWalls = [];
      return;
    }
    if (dist(this.start, p) < 0.01) return;
    const opts = this.editor.wallOptions;
    const from = this.start;
    const closing = !!this.chainStart && this.chain.length >= 3 && dist(p, this.chainStart) < 1e-6;
    if (!closing) this.chain.push(p);
    const offset = opts.align === "eixo" ? 0 : (opts.align === "face-esquerda" ? -1 : 1) * (opts.thickness / 2);
    const axis = offsetPolyline(this.chain, offset, closing);
    const ids = this.chainWalls;
    const created = createWall(from, p, { thickness: opts.thickness, height: opts.height });
    this.store.edit("Desenhar parede", (proj) => {
      proj.walls.push(created);
      ids.push(created.id);
      ids.forEach((id, i) => {
        const w = proj.walls.find((x) => x.id === id);
        if (!w) return;
        w.a = { ...axis[i] };
        w.b = { ...axis[(i + 1) % axis.length] };
      });
    });
    this.lastDir = normalize(sub(p, from));
    this.typed = "";
    if (closing) this.finish();
    else this.start = p;
  }
  finish() {
    this.start = null;
    this.chainStart = null;
    this.chain = [];
    this.chainWalls = [];
    this.typed = "";
  }
  cancel() {
    if (!this.start) return false;
    this.finish();
    return true;
  }
  keyDown(e) {
    if (!this.start) return false;
    if (/^[0-9.,]$/.test(e.key) || this.typed && /^[cm]$/i.test(e.key)) {
      this.typed += e.key;
      return true;
    }
    if (e.key === "Backspace" && this.typed) {
      this.typed = this.typed.slice(0, -1);
      return true;
    }
    if (e.key === "Enter") {
      const l = parseLength(this.typed);
      if (l && l > 0) {
        const dir = this.pos && dist(this.pos, this.start) > 1e-6 ? normalize(sub(this.pos, this.start)) : this.lastDir;
        this.place(add(this.start, scale(dir, l)));
      } else {
        this.finish();
      }
      return true;
    }
    return false;
  }
  drawOverlay(d) {
    if (this.snap) this.editor.drawSnap(d, this.snap);
    if (!this.start || !this.pos) return;
    let end = this.pos;
    const typed = parseLength(this.typed);
    if (typed && dist(this.pos, this.start) > 1e-6) end = add(this.start, scale(normalize(sub(this.pos, this.start)), typed));
    const l = dist(this.start, end);
    if (l < 1e-6) return;
    const dir = normalize(sub(end, this.start));
    const { thickness, align } = this.editor.wallOptions;
    const left = leftNormal(dir);
    const shift = align === "eixo" ? 0 : (align === "face-esquerda" ? -1 : 1) * (thickness / 2);
    const s0 = add(this.start, scale(left, shift));
    const e0 = add(end, scale(left, shift));
    const n = scale(left, thickness / 2);
    d.polygon([add(s0, n), add(e0, n), sub(e0, n), sub(s0, n)], "rgba(22,163,74,.25)", THEME.preview, 1.5);
    d.line(this.start, end, THEME.preview, 1, [6, 4]);
    d.dimension(this.start, end, this.editor.wallOptions.thickness / 2 + 0.35, THEME.preview, 1.5);
    const ang = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
    d.text(add(end, { x: d.vp.px(28), y: d.vp.px(18) }), `${formatNumber((ang + 360) % 360, 0)}°`, THEME.preview, THEME.font, 0, THEME.paper);
  }
}
class Viewport {
  /** pixels por metro */
  scale = 60;
  /** posição na tela da origem do mundo */
  ox = 200;
  oy = 500;
  width = 800;
  height = 600;
  toScreen(p) {
    return { x: this.ox + p.x * this.scale, y: this.oy - p.y * this.scale };
  }
  toWorld(s) {
    return { x: (s.x - this.ox) / this.scale, y: (this.oy - s.y) / this.scale };
  }
  /** metros correspondentes a `px` pixels */
  px(px) {
    return px / this.scale;
  }
  zoomAt(screen, factor) {
    const before = this.toWorld(screen);
    this.scale = Math.min(2e3, Math.max(5, this.scale * factor));
    this.ox = screen.x - before.x * this.scale;
    this.oy = screen.y + before.y * this.scale;
  }
  pan(dx, dy) {
    this.ox += dx;
    this.oy += dy;
  }
  fit(points, margin = 60) {
    if (points.length === 0) {
      this.scale = 60;
      this.ox = this.width / 2;
      this.oy = this.height / 2;
      return;
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 1);
    const hgt = Math.max(maxY - minY, 1);
    this.scale = Math.min((this.width - 2 * margin) / w, (this.height - 2 * margin) / hgt, 400);
    this.ox = this.width / 2 - (minX + maxX) / 2 * this.scale;
    this.oy = this.height / 2 + (minY + maxY) / 2 * this.scale;
  }
}
const choiceFor = (m) => ({
  modelId: m.id,
  size: [...m.default],
  material: m.materials[0] ?? "madeira",
  sill: m.sill,
  options: defaultOptions(m)
});
const SNAP_PX = 10;
class PlanEditor extends EventTarget {
  constructor(canvas2, store2) {
    super();
    this.canvas = canvas2;
    this.store = store2;
    this.ctx = canvas2.getContext("2d");
    this.renderer = new PlanRenderer(this.ctx, this.vp);
    const s = store2.project.settings;
    this.wallOptions = { thickness: s.wallThickness, height: s.wallHeight, align: "eixo" };
    this.tools = {
      select: new SelectTool(this),
      wall: new WallTool(this),
      door: new OpeningTool(this, "door"),
      window: new OpeningTool(this, "window"),
      dimension: new DimensionTool(this)
    };
    this.tool = this.tools.select;
    this.bindEvents();
    store2.addEventListener("change", () => this.requestRender());
    store2.addEventListener("selection", () => this.requestRender());
    new ResizeObserver(() => this.resize()).observe(canvas2.parentElement);
    this.resize();
  }
  canvas;
  store;
  vp = new Viewport();
  renderer;
  tools;
  tool;
  hover = null;
  cursorWorld = null;
  lastSnap = null;
  wallOptions;
  openingChoice = {
    door: choiceFor(DOOR_MODELS[0]),
    window: choiceFor(WINDOW_MODELS[0])
  };
  ctx;
  frame = 0;
  panning = null;
  spaceDown = false;
  static choiceFor = choiceFor;
  setTool(name) {
    if (this.tool.name === name) return;
    this.tool.deactivate?.();
    this.tool = this.tools[name];
    this.tool.activate?.();
    this.hover = null;
    this.canvas.style.cursor = this.tool.cursor;
    this.dispatchEvent(new Event("tool"));
    this.emitStatus();
    this.requestRender();
  }
  /** tolerância de captura em metros para o zoom atual */
  tolerance() {
    return this.vp.px(SNAP_PX);
  }
  snap(p, extra = {}) {
    const r = snapPoint(p, {
      walls: this.store.project.walls,
      tolerance: this.tolerance(),
      gridStep: this.store.project.settings.gridStep,
      ...extra
    });
    this.lastSnap = r;
    return r;
  }
  drawSnap(d, s) {
    if (s.kind === "grade" || s.kind === "livre") return;
    const p = d.vp.toScreen(s.point);
    const ctx = d.ctx;
    ctx.strokeStyle = THEME.snap;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (s.kind === "extremidade") ctx.rect(p.x - 5, p.y - 5, 10, 10);
    else if (s.kind === "meio") {
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x + 6, p.y + 5);
      ctx.lineTo(p.x - 6, p.y + 5);
      ctx.closePath();
    } else if (s.kind === "parede") {
      ctx.moveTo(p.x - 5, p.y - 5);
      ctx.lineTo(p.x + 5, p.y + 5);
      ctx.moveTo(p.x + 5, p.y - 5);
      ctx.lineTo(p.x - 5, p.y + 5);
    } else ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  fit() {
    const pts = this.store.project.walls.flatMap((w) => [w.a, w.b]);
    this.vp.fit(pts.length ? pts : [{ x: -1, y: -1 }, { x: 10, y: 8 }]);
    this.requestRender();
  }
  requestRender() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }
  render() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.render(this.store, this.hover);
    this.tool.drawOverlay?.(this.renderer.draw);
  }
  resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h2 = parent.clientHeight;
    const first = this.vp.width === 800 && this.vp.height === 600;
    this.vp.width = w;
    this.vp.height = h2;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h2 * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h2}px`;
    if (first) this.fit();
    this.render();
  }
  info(e) {
    const r = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    return { screen, world: this.vp.toWorld(screen), button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey };
  }
  emitStatus() {
    this.dispatchEvent(new Event("status"));
  }
  bindEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      if (e.button === 1 || e.button === 0 && this.spaceDown) {
        this.panning = { x: e.clientX, y: e.clientY };
        c.style.cursor = "grabbing";
        return;
      }
      if (e.button === 2) {
        if (!this.tool.cancel?.()) this.setTool("select");
      } else {
        this.tool.pointerDown?.(this.info(e));
      }
      this.emitStatus();
      this.requestRender();
    });
    c.addEventListener("pointermove", (e) => {
      if (this.panning) {
        this.vp.pan(e.clientX - this.panning.x, e.clientY - this.panning.y);
        this.panning = { x: e.clientX, y: e.clientY };
        this.requestRender();
        return;
      }
      const info = this.info(e);
      this.cursorWorld = info.world;
      this.lastSnap = null;
      this.tool.pointerMove?.(info);
      this.emitStatus();
      this.requestRender();
    });
    c.addEventListener("pointerup", (e) => {
      if (this.panning) {
        this.panning = null;
        c.style.cursor = this.tool.cursor;
        return;
      }
      this.tool.pointerUp?.(this.info(e));
      this.requestRender();
    });
    c.addEventListener("dblclick", (e) => {
      this.tool.doubleClick?.(this.info(e));
      this.requestRender();
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const info = this.info(e);
      this.vp.zoomAt(info.screen, Math.exp(-e.deltaY * 15e-4));
      this.requestRender();
    }, { passive: false });
    c.addEventListener("pointerleave", () => {
      this.cursorWorld = null;
      this.hover = null;
      this.requestRender();
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === " ") this.spaceDown = false;
    });
  }
  /** Teclas para o editor (chamado pelo atalho global quando o foco não está num campo). */
  keyDown(e) {
    if (e.key === " ") {
      this.spaceDown = true;
      return true;
    }
    if (this.tool.keyDown?.(e)) {
      this.emitStatus();
      this.requestRender();
      return true;
    }
    if (e.key === "Escape") {
      if (!this.tool.cancel?.()) this.setTool("select");
      this.emitStatus();
      this.requestRender();
      return true;
    }
    return false;
  }
}
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = String(v);
    else if (k === "style") el.setAttribute("style", String(v));
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}
function append(el, ...children) {
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
}
function select(value, options, onchange, attrs = {}) {
  return h(
    "select",
    { ...attrs, onchange: (e) => onchange(e.target.value) },
    options.map(([v, label]) => h("option", { value: v, selected: v === value }, label))
  );
}
function numberInput(value, onchange, attrs = {}) {
  const decimals = attrs.decimals ?? 2;
  const input = h("input", {
    type: "text",
    inputMode: "decimal",
    class: "num",
    ...attrs,
    value: value.toFixed(decimals).replace(".", ",")
  });
  const commit = () => {
    const v = parseFloat(input.value.replace(",", "."));
    if (Number.isFinite(v) && (attrs.min == null || v >= attrs.min)) onchange(v);
    else input.value = value.toFixed(decimals).replace(".", ",");
  };
  input.addEventListener("change", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    e.stopPropagation();
  });
  return input;
}
function field(label, control) {
  return h("label", { class: "field" }, h("span", {}, label), control);
}
const THICKNESSES$1 = ["0.1", "0.12", "0.15", "0.2", "0.25"].map((t) => [t, `${Math.round(Number(t) * 100)} cm`]);
function renderProperties(el, store2) {
  const sel = store2.selection;
  const p = store2.project;
  el.replaceChildren();
  if (sel?.kind === "wall") {
    const w = p.walls.find((x) => x.id === sel.id);
    if (!w) return;
    const len2 = wallLength(w);
    const ops = p.openings.filter((o) => o.wallId === w.id);
    const setLength = (v) => store2.edit("Comprimento da parede", (proj) => {
      const x = proj.walls.find((y) => y.id === w.id);
      const f = wallFrame(x);
      x.b = add(x.a, scale(f.dir, v));
    });
    append(
      el,
      h("h3", {}, store2.plan.exteriorWalls.has(w.id) ? "Parede externa" : "Parede interna"),
      field("Comprimento (m)", numberInput(len2, setLength, { min: 0.05 })),
      field("Espessura", select(
        String(+w.thickness.toFixed(3)),
        THICKNESSES$1.some(([t]) => Number(t) === +w.thickness.toFixed(3)) ? THICKNESSES$1 : [...THICKNESSES$1, [String(w.thickness), `${formatNumber(w.thickness * 100, 1)} cm`]],
        (v) => store2.edit("Espessura da parede", (proj) => {
          proj.walls.find((y) => y.id === w.id).thickness = Number(v);
        })
      )),
      field("Altura (m)", numberInput(w.height, (v) => store2.edit("Altura da parede", (proj) => {
        proj.walls.find((y) => y.id === w.id).height = v;
      }), { min: 0.1 })),
      ops.length ? h("h4", {}, "Vãos nesta parede") : null,
      h("ul", { class: "list" }, ops.map((o) => h("li", { onclick: () => store2.select({ kind: "opening", id: o.id }) }, `${findOpeningModel(o.modelId)?.name ?? o.modelId} — ${formatNumber(o.width)} × ${formatNumber(o.height)}`))),
      h("button", { class: "danger", onclick: () => store2.deleteSelection() }, "Excluir parede")
    );
    return;
  }
  if (sel?.kind === "opening") {
    const o = p.openings.find((x) => x.id === sel.id);
    if (!o) return;
    append(el, openingProperties(o, store2));
    return;
  }
  if (sel?.kind === "dimension") {
    const d = p.dimensions.find((x) => x.id === sel.id);
    if (!d) return;
    append(
      el,
      h("h3", {}, "Cota"),
      h("p", {}, `Medida: ${formatMeters(dist(d.a, d.b))}`),
      field("Afastamento (m)", numberInput(d.offset, (v) => store2.edit("Mover cota", (proj) => {
        proj.dimensions.find((x) => x.id === d.id).offset = v;
      }))),
      h("button", { class: "danger", onclick: () => store2.deleteSelection() }, "Excluir cota")
    );
    return;
  }
  const room = store2.selectedRoom();
  if (room) {
    const perimeter = room.inner.reduce((s, q, i) => s + dist(q, room.inner[(i + 1) % room.inner.length]), 0);
    const name = h("input", { type: "text", value: room.name, class: "text", name: "room-name" });
    name.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") name.blur();
    });
    name.addEventListener("change", () => {
      const v = name.value.trim();
      if (!v) return;
      store2.edit("Renomear cômodo", (proj) => {
        const meta = room.metaId ? proj.rooms.find((r) => r.id === room.metaId) : void 0;
        if (meta) meta.name = v;
        else proj.rooms.push({ id: newId("room"), name: v, anchor: { ...room.label } });
      });
    });
    append(
      el,
      h("h3", {}, "Cômodo"),
      field("Nome", name),
      h("p", {}, `Área útil: ${formatArea(room.area)}`),
      h("p", {}, `Perímetro interno: ${formatMeters(perimeter)}`)
    );
    return;
  }
  append(el, projectSummary(p, store2));
}
function openingProperties(o, store2) {
  const model = findOpeningModel(o.modelId);
  const wall = store2.project.walls.find((w) => w.id === o.wallId);
  const models = model?.kind === "janela" ? WINDOW_MODELS : DOOR_MODELS;
  const set = (label, fn) => store2.edit(label, (proj) => fn(proj.openings.find((x) => x.id === o.id)));
  const errors = openingErrors(store2.project, o);
  const custom = !model?.sizes.some(([w, hh]) => w === o.width && hh === o.height);
  const options = Object.entries(model?.options ?? {});
  return [
    h("h3", {}, model?.kind === "janela" ? "Janela" : "Porta"),
    field("Modelo", select(o.modelId, models.map((m) => [m.id, m.name]), (v) => set("Trocar modelo", (x) => {
      const m = findOpeningModel(v);
      x.modelId = m.id;
      [x.width, x.height] = m.default;
      x.sill = m.sill;
      x.options = defaultOptions(m);
      if (!m.materials.includes(x.material)) x.material = m.materials[0];
    }))),
    field("Tamanho padrão", select(
      custom ? "custom" : `${o.width}x${o.height}`,
      [...(model?.sizes ?? []).map(([w, hh]) => [`${w}x${hh}`, `${formatNumber(w)} × ${formatNumber(hh)} m`]), ["custom", "Personalizado"]],
      (v) => {
        if (v !== "custom") set("Tamanho do vão", (x) => {
          [x.width, x.height] = v.split("x").map(Number);
        });
      }
    )),
    h(
      "div",
      { class: "row" },
      field("Largura", numberInput(o.width, (v) => set("Largura do vão", (x) => {
        x.width = v;
      }), { min: 0.2 })),
      field("Altura", numberInput(o.height, (v) => set("Altura do vão", (x) => {
        x.height = v;
      }), { min: 0.2 }))
    ),
    h(
      "div",
      { class: "row" },
      field("Peitoril", numberInput(o.sill, (v) => set("Peitoril", (x) => {
        x.sill = v;
      }), { min: 0 })),
      field("Dist. do início", numberInput(o.offset, (v) => set("Posição do vão", (x) => {
        x.offset = v;
      }), { min: 0 }))
    ),
    field("Material", select(o.material, (model?.materials ?? []).map((k) => [k, MATERIALS[k].name]), (v) => set("Material", (x) => {
      x.material = v;
    }))),
    ...options.map(([k, values]) => field(OPTION_LABELS[k], select(String(o.options[k] ?? values[0]), values.map((v) => [v, v]), (v) => set(OPTION_LABELS[k], (x) => {
      x.options[k] = v;
    })))),
    errors.length ? h("ul", { class: "errors" }, errors.map((e) => h("li", {}, e.msg))) : null,
    wall ? h("p", { class: "help" }, `Parede de ${formatMeters(wallLength(wall))}, altura ${formatMeters(wall.height)}.`) : null,
    h("button", { class: "danger", onclick: () => store2.deleteSelection() }, "Excluir")
  ];
}
function projectSummary(p, store2) {
  const plan = store2.plan;
  const built = plan.outlines.reduce((s, o) => s + o.area, 0);
  const useful = plan.rooms.reduce((s, r) => s + r.area, 0);
  const name = h("input", { type: "text", value: p.name, class: "text" });
  name.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") name.blur();
  });
  name.addEventListener("change", () => {
    if (name.value.trim()) store2.edit("Renomear projeto", (proj) => {
      proj.name = name.value.trim();
    });
  });
  return [
    h("h3", {}, "Projeto"),
    field("Nome", name),
    field("Grade de captura", select(
      String(p.settings.gridStep),
      [["0.01", "1 cm"], ["0.05", "5 cm"], ["0.1", "10 cm"], ["0.25", "25 cm"]],
      (v) => store2.edit("Grade", (proj) => {
        proj.settings.gridStep = Number(v);
      })
    )),
    h("h4", {}, "Áreas"),
    h(
      "dl",
      { class: "stats" },
      h("dt", {}, "Construída"),
      h("dd", {}, formatArea(built)),
      h("dt", {}, "Útil (cômodos)"),
      h("dd", {}, formatArea(useful)),
      h("dt", {}, "Paredes"),
      h("dd", {}, String(p.walls.length)),
      h("dt", {}, "Portas/janelas"),
      h("dd", {}, String(p.openings.length))
    ),
    plan.rooms.length ? h("h4", {}, "Cômodos") : null,
    h("ul", { class: "list" }, plan.rooms.map((r) => h("li", { onclick: () => store2.select({ kind: "room", at: r.label }) }, h("span", {}, r.name), h("span", { class: "muted" }, formatArea(r.area)))))
  ];
}
const TILE_FAMILIES = {
  colonial: "Colonial",
  plan: "Plan",
  isotelha: "Isotelha (termoacústica)"
};
const ROOF_TILES = {
  colonial: {
    family: "colonial",
    name: "Colonial cerâmica (capa-canal)",
    kind: "ceramica",
    piecesPerM2: 24,
    minSlope: 0.25,
    recommendedSlope: 0.3,
    gauge: 0.38,
    weightKgM2: 55,
    ridge: { name: "Cumeeira colonial", piecesPerM: 3 }
  },
  plan: {
    family: "plan",
    name: "Plan cerâmica",
    kind: "ceramica",
    piecesPerM2: 26,
    minSlope: 0.3,
    recommendedSlope: 0.35,
    gauge: 0.33,
    weightKgM2: 55,
    ridge: { name: "Cumeeira plan", piecesPerM: 3 }
  },
  "isotelha-eps30": {
    family: "isotelha",
    name: "Isotelha trapezoidal EPS 30 mm",
    kind: "painel",
    usefulWidth: 1,
    maxLength: 12,
    lengthStep: 0.05,
    minSlope: 0.05,
    recommendedSlope: 0.1,
    maxPurlinSpacing: 1.8,
    fixingsPerSupport: 4,
    weightKgM2: 11,
    ridge: { name: "Cumeeira trapezoidal", usefulLength: 1 }
  },
  "isotelha-eps50": {
    family: "isotelha",
    name: "Isotelha trapezoidal EPS 50 mm",
    kind: "painel",
    usefulWidth: 1,
    maxLength: 12,
    lengthStep: 0.05,
    minSlope: 0.05,
    recommendedSlope: 0.1,
    maxPurlinSpacing: 2.2,
    fixingsPerSupport: 4,
    weightKgM2: 12,
    ridge: { name: "Cumeeira trapezoidal", usefulLength: 1 }
  }
};
const tilesOfFamily = (family) => Object.keys(ROOF_TILES).filter((id) => ROOF_TILES[id].family === family);
const STRUCTURE_SYSTEMS = {
  madeira: {
    name: "Madeira",
    material: "madeira",
    rules: {
      ceramica: { trussSpacing: 3, purlinSpacing: 1.5, rafterSpacing: 0.5, battens: true },
      painel: { trussSpacing: 3, purlinSpacing: 1.8 }
    },
    members: {
      tesoura: { name: "Tesoura", section: "6 × 16 cm", b: 0.06, h: 0.16 },
      terca: { name: "Terça", section: "6 × 12 cm", b: 0.06, h: 0.12 },
      caibro: { name: "Caibro", section: "5 × 6 cm", b: 0.05, h: 0.06 },
      ripa: { name: "Ripa", section: "1,5 × 5 cm", b: 0.015, h: 0.05 }
    }
  },
  aco: {
    name: "Aço (perfis formados a frio)",
    material: "aco",
    rules: {
      // tesouras leves próximas + ripas metálicas direto no banzo: dispensa terças e caibros
      ceramica: { trussSpacing: 1.2, battens: true },
      painel: { trussSpacing: 3, purlinSpacing: 1.8 }
    },
    members: {
      tesoura: { name: "Tesoura", section: "Ue 100×40×17 #2,00", kgPerM: 3.2 },
      terca: { name: "Terça", section: "Ue 75×40×15 #2,00", kgPerM: 2.6 },
      ripa: { name: "Ripa metálica", section: "Cartola 20×30 #0,65", kgPerM: 0.55 }
    }
  }
};
const ROOF_TYPES = {
  "duas-aguas": "Duas águas",
  "uma-agua": "Uma água",
  platibanda: "Uma água com platibanda"
};
const slopeFactor = (i) => Math.hypot(1, i);
const makePlane = (run, k, width) => ({
  run,
  rafter: run * k,
  width,
  area: run * k * width
});
function roofGeometry({
  width,
  depth,
  type = "duas-aguas",
  slope = 0.3,
  overhang = 0.5,
  ridgeAxis = "auto",
  parapetFreeboard = 0.3
}) {
  if (!(width > 0 && depth > 0)) throw new Error("Projeção do telhado precisa ter largura e profundidade > 0");
  if (!ROOF_TYPES[type]) throw new Error(`Tipo de telhado desconhecido: ${type}`);
  const alongX = ridgeAxis === "auto" ? width >= depth : ridgeAxis === "x";
  const length = alongX ? width : depth;
  const span = alongX ? depth : width;
  const k = slopeFactor(slope);
  const base = { type, slope, span, length, ridgeAxis: alongX ? "x" : "y" };
  if (type === "duas-aguas") {
    const rise2 = span / 2 * slope;
    const plane2 = makePlane(span / 2 + overhang, k, length + 2 * overhang);
    return {
      ...base,
      overhang,
      rise: rise2,
      planes: [plane2, { ...plane2 }],
      area: 2 * plane2.area,
      supportedSlopeLength: span / 2 * k,
      ridge: plane2.width,
      eaves: 2 * plane2.width,
      rakes: 4 * plane2.rafter,
      gutters: 0,
      flashing: 0,
      gableArea: span * rise2,
      parapetHeight: 0
    };
  }
  const rise = span * slope;
  if (type === "uma-agua") {
    const plane2 = makePlane(span + 2 * overhang, k, length + 2 * overhang);
    return {
      ...base,
      overhang,
      rise,
      planes: [plane2],
      area: plane2.area,
      supportedSlopeLength: span * k,
      ridge: 0,
      eaves: plane2.width,
      rakes: 2 * plane2.rafter,
      gutters: 0,
      flashing: plane2.width,
      gableArea: span * rise,
      parapetHeight: 0
    };
  }
  const plane = makePlane(span, k, length);
  return {
    ...base,
    overhang: 0,
    rise,
    planes: [plane],
    area: plane.area,
    supportedSlopeLength: span * k,
    ridge: 0,
    eaves: 0,
    rakes: 0,
    gutters: length,
    flashing: length + 2 * span,
    gableArea: 0,
    parapetHeight: rise + parapetFreeboard
  };
}
function trussMemberLength(geom) {
  const { span, rise, slope } = geom;
  const k = slopeFactor(slope);
  if (geom.type === "duas-aguas") {
    return span + span * k + rise + 2 * Math.hypot(span / 4, rise / 2);
  }
  return span + span * k + rise + rise / 2 + Math.hypot(span / 2, rise / 2);
}
function memberItem(key, member, material, count, unitLength, waste) {
  const totalLength = count * unitLength * (1 + waste);
  const item = { key, name: member.name, section: member.section, count, unitLength, totalLength };
  if (material === "madeira") item.volumeM3 = totalLength * (member.b ?? 0) * (member.h ?? 0);
  else item.massKg = totalLength * (member.kgPerM ?? 0);
  return item;
}
function roofStructure(geom, tile, systemKey = "madeira", { waste = 0.05, overrides = {} } = {}) {
  const system = STRUCTURE_SYSTEMS[systemKey];
  if (!system) throw new Error(`Sistema estrutural desconhecido: ${systemKey}`);
  const rules = { ...system.rules[tile.kind], ...overrides };
  const { members, material } = system;
  const items = [];
  const planes = geom.planes;
  const plane = planes[0];
  if (members.tesoura) {
    const trusses = Math.ceil(geom.length / rules.trussSpacing) + 1;
    items.push(memberItem("tesoura", members.tesoura, material, trusses, trussMemberLength(geom), waste));
  }
  if (rules.purlinSpacing && members.terca) {
    const maxSpacing = tile.kind === "painel" ? tile.maxPurlinSpacing : Infinity;
    const spacing = Math.min(rules.purlinSpacing, maxSpacing);
    const linesPerPlane = Math.ceil(geom.supportedSlopeLength / spacing) + 1;
    const lines = planes.length === 2 ? 2 * linesPerPlane - 1 : linesPerPlane;
    items.push(memberItem("terca", members.terca, material, lines, plane.width, waste));
  }
  if (rules.rafterSpacing && members.caibro) {
    const perPlane = Math.ceil(plane.width / rules.rafterSpacing) + 1;
    items.push(memberItem("caibro", members.caibro, material, perPlane * planes.length, plane.rafter, waste));
  }
  if (rules.battens && tile.kind === "ceramica" && members.ripa) {
    const rows = Math.ceil(plane.rafter / tile.gauge) + 1;
    items.push(memberItem("ripa", members.ripa, material, rows * planes.length, plane.width, waste));
  }
  const totals = material === "madeira" ? { volumeM3: items.reduce((s, i) => s + (i.volumeM3 ?? 0), 0) } : { massKg: items.reduce((s, i) => s + (i.massKg ?? 0), 0) };
  return { system: system.name, material, items, totals };
}
function roofCover(geom, tile, { waste = 0.05 } = {}) {
  const items = [];
  const warnings = [];
  if (geom.slope < tile.minSlope) {
    warnings.push(`Inclinação ${(geom.slope * 100).toFixed(0)}% abaixo da mínima de ${tile.name} (${(tile.minSlope * 100).toFixed(0)}%).`);
  }
  if (tile.kind === "ceramica") {
    items.push({ key: "telha", name: tile.name, unit: "peça", qty: Math.ceil(geom.area * tile.piecesPerM2 * (1 + waste)) });
    if (geom.ridge > 0) {
      items.push({ key: "cumeeira", name: tile.ridge.name, unit: "peça", qty: Math.ceil(geom.ridge * tile.ridge.piecesPerM * (1 + waste)) });
    }
  } else {
    let sheets = 0;
    let sheetArea = 0;
    const lengths = [];
    for (const plane of geom.planes) {
      const n = Math.ceil(plane.width / tile.usefulWidth - 1e-9);
      const len2 = Math.ceil(plane.rafter / tile.lengthStep - 1e-9) * tile.lengthStep;
      if (len2 > tile.maxLength) warnings.push(`Água com ${len2.toFixed(2)} m excede a chapa máxima de ${tile.maxLength} m: prever emenda.`);
      sheets += n;
      sheetArea += n * len2 * tile.usefulWidth;
      lengths.push({ count: n, length: len2 });
    }
    items.push({ key: "telha", name: tile.name, unit: "chapa", qty: sheets, lengths, areaM2: sheetArea });
    if (geom.ridge > 0) {
      items.push({ key: "cumeeira", name: tile.ridge.name, unit: "peça", qty: Math.ceil(geom.ridge / tile.ridge.usefulLength - 1e-9) });
    }
    const supportsPerSheet = Math.ceil(geom.planes[0].rafter / tile.maxPurlinSpacing) + 1;
    items.push({ key: "fixacao", name: "Parafuso autobrocante c/ vedação", unit: "un", qty: Math.ceil(sheets * supportsPerSheet * tile.fixingsPerSupport * (1 + waste)) });
  }
  if (geom.gutters > 0) items.push({ key: "calha", name: "Calha", unit: "m", qty: geom.gutters });
  if (geom.flashing > 0) items.push({ key: "rufo", name: "Rufo", unit: "m", qty: geom.flashing });
  return { items, warnings };
}
function calculateRoof({ tile: tileKey = "colonial", structure = "madeira", waste = 0.05, structureOverrides, ...geomParams }) {
  const tile = ROOF_TILES[tileKey];
  if (!tile) throw new Error(`Telha desconhecida: ${tileKey}`);
  const geometry = roofGeometry(geomParams);
  const cover = roofCover(geometry, tile, { waste });
  const struct = roofStructure(geometry, tile, structure, { waste, overrides: structureOverrides });
  return { geometry, cover, structure: struct, loadKg: geometry.area * tile.weightKgM2, warnings: cover.warnings };
}
const DEFAULT_ROOF = {
  width: 10,
  depth: 8,
  type: "duas-aguas",
  slope: 0.3,
  overhang: 0.5,
  tile: "colonial",
  structure: "madeira"
};
function planExtents(store2) {
  const pts = store2.plan.outlines.flatMap((o) => o.inner);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}
function renderRoofPanel(el, store2) {
  const params = { ...DEFAULT_ROOF, ...store2.project.roof };
  const set = (patch) => store2.edit("Telhado", (p) => {
    p.roof = { ...params, ...patch };
  });
  const tile = ROOF_TILES[params.tile];
  const family = tile.family;
  const variants = tilesOfFamily(family);
  const extents = planExtents(store2);
  const form = h(
    "div",
    { class: "roof-form" },
    field("Largura (m)", numberInput(params.width, (v) => set({ width: v }), { min: 0.5 })),
    field("Profundidade (m)", numberInput(params.depth, (v) => set({ depth: v }), { min: 0.5 })),
    field("Modelo", select(params.type, Object.entries(ROOF_TYPES), (v) => set({ type: v }))),
    field("Inclinação (%)", numberInput(params.slope * 100, (v) => set({ slope: v / 100 }), { min: 1, decimals: 0 })),
    params.type !== "platibanda" ? field("Beiral (m)", numberInput(params.overhang, (v) => set({ overhang: v }), { min: 0 })) : null,
    field("Telha", select(family, Object.entries(TILE_FAMILIES), (v) => {
      const first = tilesOfFamily(v)[0];
      set({ tile: first, slope: Math.max(params.slope, ROOF_TILES[first].minSlope) });
    })),
    variants.length > 1 ? field("Modelo da telha", select(params.tile, variants.map((id) => [id, ROOF_TILES[id].name]), (v) => set({ tile: v }))) : null,
    field("Estrutura", select(params.structure, Object.entries(STRUCTURE_SYSTEMS).map(([k, s]) => [k, s.name]), (v) => set({ structure: v })))
  );
  const result = h("section", { class: "roof-result" });
  try {
    const r = calculateRoof(params);
    const g = r.geometry;
    result.append(
      ...r.warnings.map((w) => h("p", { class: "warn" }, w)),
      h(
        "p",
        {},
        "Área de telhado: ",
        h("b", {}, `${formatNumber(g.area)} m²`),
        ` · desnível: ${formatNumber(g.rise)} m`,
        g.parapetHeight ? ` · platibanda: ${formatNumber(g.parapetHeight)} m` : "",
        ` · carga da cobertura ≈ ${formatNumber(r.loadKg, 0)} kg`
      ),
      h("h4", {}, "Cobertura"),
      h("table", {}, r.cover.items.map((i) => h(
        "tr",
        {},
        h("td", {}, i.name),
        h("td", { class: "n" }, `${formatNumber(i.qty, i.unit === "m" ? 2 : 0)} ${i.unit}`),
        h("td", { class: "muted" }, i.lengths ? i.lengths.map((l) => `${l.count} × ${formatNumber(l.length)} m`).join(" + ") : "")
      ))),
      h("h4", {}, `Estrutura — ${r.structure.system}`),
      h(
        "table",
        {},
        h("tr", {}, h("th", {}, "Peça"), h("th", {}, "Seção"), h("th", { class: "n" }, "Qtd."), h("th", { class: "n" }, "Total"), h("th", { class: "n" }, "")),
        r.structure.items.map((i) => h(
          "tr",
          {},
          h("td", {}, i.name),
          h("td", {}, i.section),
          h("td", { class: "n" }, String(i.count)),
          h("td", { class: "n" }, `${formatNumber(i.totalLength, 1)} m`),
          h("td", { class: "n" }, i.volumeM3 != null ? `${formatNumber(i.volumeM3, 3)} m³` : `${formatNumber(i.massKg ?? 0, 0)} kg`)
        ))
      ),
      h("p", { class: "help" }, "Quantitativo para orçamento (perda de 5% incluída). O dimensionamento estrutural definitivo é de responsabilidade de profissional habilitado.")
    );
  } catch (e) {
    result.append(h("p", { class: "warn" }, e.message));
  }
  el.replaceChildren(
    h(
      "div",
      { class: "roof" },
      h(
        "header",
        {},
        h("h2", {}, "Telhado"),
        extents ? h(
          "button",
          { onclick: () => set({ width: +extents.width.toFixed(2), depth: +extents.depth.toFixed(2) }) },
          `Usar contorno da planta (${formatNumber(extents.width)} × ${formatNumber(extents.depth)} m)`
        ) : null
      ),
      form,
      result,
      h("p", { class: "help" }, "Fase 3: telhados de 3 e 4 águas, plantas em L e visualização 3D das camadas de estrutura e cobertura.")
    )
  );
}
const THICKNESSES = [0.1, 0.12, 0.15, 0.2, 0.25];
const size = (w, hh) => `${formatNumber(w)} × ${formatNumber(hh)} m`;
const SHORTCUTS = [
  ["V", "Selecionar"],
  ["P", "Parede"],
  ["O", "Porta"],
  ["J", "Janela"],
  ["C", "Cota"],
  ["F", "Enquadrar planta"],
  ["Shift", "Ortogonal"],
  ["Espaço + arrastar", "Mover vista"],
  ["Roda do mouse", "Zoom"],
  ["Delete", "Excluir seleção"],
  ["Ctrl+Z / Ctrl+Y", "Desfazer / refazer"],
  ["Ctrl+S", "Salvar"],
  ["Esc", "Cancelar"]
];
function renderToolPanel(el, editor2) {
  const tool = editor2.tool.name;
  const rerender = () => renderToolPanel(el, editor2);
  el.replaceChildren();
  if (tool === "wall") {
    const o = editor2.wallOptions;
    append(
      el,
      h("h3", {}, "Parede"),
      h("div", { class: "chips" }, THICKNESSES.map((t) => h("button", { class: Math.abs(o.thickness - t) < 1e-9 ? "chip on" : "chip", onclick: () => {
        o.thickness = t;
        rerender();
      } }, `${Math.round(t * 100)} cm`))),
      field("Espessura (m)", numberInput(o.thickness, (v) => {
        o.thickness = v;
        rerender();
      }, { min: 0.03 })),
      field("Altura (m)", numberInput(o.height, (v) => {
        o.height = v;
        rerender();
      }, { min: 0.1 })),
      field("Linha de desenho", select(o.align, [["eixo", "Eixo da parede"], ["face-direita", "Face à direita do traço"], ["face-esquerda", "Face à esquerda do traço"]], (v) => {
        o.align = v;
        rerender();
      })),
      o.align !== "eixo" ? h("p", { class: "help" }, 'Para medir pelo lado de fora, desenhe o contorno no sentido anti-horário com "face à direita" (ou horário com "face à esquerda").') : null,
      h("p", { class: "help" }, "Clique ponto a ponto. Digite o comprimento (ex.: 3,45 ou 345cm) e Enter para fixar a medida. Clique no ponto inicial para fechar o contorno.")
    );
    return;
  }
  if (tool === "door" || tool === "window") {
    const models = tool === "door" ? DOOR_MODELS : WINDOW_MODELS;
    const choice = editor2.openingChoice[tool];
    const model = findOpeningModel(choice.modelId);
    const custom = !model.sizes.some(([w, hh]) => w === choice.size[0] && hh === choice.size[1]);
    const options = Object.entries(model.options);
    append(
      el,
      h("h3", {}, tool === "door" ? "Portas" : "Janelas"),
      h("div", { class: "catalog" }, models.map((m) => h("button", {
        class: m.id === model.id ? "item on" : "item",
        onclick: () => {
          editor2.openingChoice[tool] = PlanEditor.choiceFor(m);
          rerender();
        }
      }, m.name))),
      field("Tamanho padrão", select(
        custom ? "custom" : choice.size.join("x"),
        [...model.sizes.map(([w, hh]) => [`${w}x${hh}`, size(w, hh)]), ["custom", "Personalizado"]],
        (v) => {
          if (v !== "custom") choice.size = v.split("x").map(Number);
          rerender();
        }
      )),
      h(
        "div",
        { class: "row" },
        field("Largura", numberInput(choice.size[0], (v) => {
          choice.size = [v, choice.size[1]];
          rerender();
        }, { min: 0.2 })),
        field("Altura", numberInput(choice.size[1], (v) => {
          choice.size = [choice.size[0], v];
          rerender();
        }, { min: 0.2 }))
      ),
      tool === "window" ? field("Peitoril (m)", numberInput(choice.sill, (v) => {
        choice.sill = v;
      }, { min: 0 })) : null,
      field("Material", select(choice.material, model.materials.map((k) => [k, MATERIALS[k].name]), (v) => {
        choice.material = v;
      })),
      options.filter(([k]) => k !== "swing").map(([k, values]) => field(OPTION_LABELS[k], select(String(choice.options[k] ?? values[0]), values.map((v) => [v, v]), (v) => {
        choice.options[k] = v;
      }))),
      h("p", { class: "help" }, model.options.swing ? "O lado da parede em que está o cursor define se a folha abre para dentro ou para fora." : "")
    );
    return;
  }
  append(
    el,
    h("h3", {}, tool === "dimension" ? "Cota" : "Atalhos"),
    tool === "dimension" ? h("p", { class: "help" }, "Clique no ponto inicial, no final e depois onde a linha de cota deve ficar.") : null,
    h("dl", { class: "keys" }, SHORTCUTS.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]))
  );
}
const store = new Store();
let view = "planta";
const TOOLS = [
  { name: "select", label: "Selecionar", key: "V" },
  { name: "wall", label: "Parede", key: "P" },
  { name: "door", label: "Porta", key: "O" },
  { name: "window", label: "Janela", key: "J" },
  { name: "dimension", label: "Cota", key: "C" }
];
const canvas = h("canvas", { id: "plan" });
const planHost = h("div", { class: "canvas-host" }, canvas);
const roofHost = h("div", { class: "roof-host", hidden: true });
const toolPanel = h("aside", { class: "panel left" });
const props = h("aside", { class: "panel right", id: "props" });
const status = { hint: h("span", { class: "hint" }), coords: h("span", { class: "coords" }), snap: h("span", { class: "snap" }) };
const undoBtn = h("button", { title: "Desfazer (Ctrl+Z)", onclick: () => store.undo() }, "↶ Desfazer");
const redoBtn = h("button", { title: "Refazer (Ctrl+Y)", onclick: () => store.redo() }, "↷ Refazer");
const toolButtons = TOOLS.map((t) => h("button", { class: "tool", "data-tool": t.name, title: `${t.label} (${t.key})`, onclick: () => setTool(t.name) }, t.label, h("kbd", {}, t.key)));
const viewButtons = ["planta", "telhado"].map((v) => h("button", { class: "tab", "data-view": v, onclick: () => setView(v) }, v === "planta" ? "Planta" : "Telhado"));
document.getElementById("app").append(
  h(
    "header",
    { class: "toolbar" },
    h("strong", { class: "brand" }, "Casa3D"),
    h(
      "div",
      { class: "group" },
      h("button", { title: "Novo (Ctrl+N)", onclick: () => void newProject() }, "Novo"),
      h("button", { title: "Abrir (Ctrl+O)", onclick: () => void openProject() }, "Abrir"),
      h("button", { title: "Salvar (Ctrl+S)", onclick: () => void save(false) }, "Salvar"),
      h("button", { title: "Salvar como (Ctrl+Shift+S)", onclick: () => void save(true) }, "Salvar como")
    ),
    h("div", { class: "group" }, undoBtn, redoBtn),
    h("div", { class: "group tools" }, toolButtons),
    h("div", { class: "group tabs" }, viewButtons)
  ),
  toolPanel,
  h("main", { class: "center" }, planHost, roofHost),
  props,
  h("footer", { class: "statusbar" }, status.hint, status.snap, status.coords)
);
const editor = new PlanEditor(canvas, store);
function setTool(name) {
  if (view !== "planta") setView("planta");
  editor.setTool(name);
}
function setView(v) {
  view = v;
  planHost.hidden = v !== "planta";
  roofHost.hidden = v !== "telhado";
  toolPanel.hidden = v !== "planta";
  for (const b of viewButtons) b.classList.toggle("on", b.dataset["view"] === v);
  if (v === "telhado") renderRoofPanel(roofHost, store);
  else editor.requestRender();
}
const confirmDiscard = () => !store.dirty || window.confirm("Há alterações não salvas. Descartar?");
async function newProject() {
  if (!confirmDiscard()) return;
  store.load(createProject(), null);
  editor.fit();
}
async function openProject() {
  if (!confirmDiscard()) return;
  try {
    const res = await openProjectFile();
    if (!res) return;
    store.load(res.project, res.path);
    editor.fit();
  } catch (e) {
    window.alert(`Não foi possível abrir o projeto: ${e.message}`);
  }
}
async function save(saveAs) {
  try {
    const path = await saveProjectFile(store.project, store.filePath, saveAs);
    if (path) store.markSaved(path);
  } catch (e) {
    window.alert(`Não foi possível salvar: ${e.message}`);
  }
}
function refreshChrome() {
  undoBtn.disabled = !store.history.canUndo;
  redoBtn.disabled = !store.history.canRedo;
  undoBtn.title = store.history.undoLabel ? `Desfazer: ${store.history.undoLabel} (Ctrl+Z)` : "Desfazer (Ctrl+Z)";
  redoBtn.title = store.history.redoLabel ? `Refazer: ${store.history.redoLabel} (Ctrl+Y)` : "Refazer (Ctrl+Y)";
  document.title = `${store.project.name}${store.dirty ? " •" : ""} — Casa3D`;
}
function refreshStatus() {
  status.hint.textContent = editor.tool.hint();
  const c = editor.lastSnap?.point ?? editor.cursorWorld;
  status.coords.textContent = c ? `x ${formatNumber(c.x)}  y ${formatNumber(c.y)} m` : "";
  status.snap.textContent = editor.lastSnap && editor.lastSnap.kind !== "grade" ? `captura: ${editor.lastSnap.kind}` : "";
}
store.addEventListener("change", () => {
  refreshChrome();
  const editing = (host) => host.contains(document.activeElement) && !!document.activeElement?.matches("input, select");
  if (!editing(props)) renderProperties(props, store);
  if (view === "telhado" && !editing(roofHost)) renderRoofPanel(roofHost, store);
});
store.addEventListener("selection", () => renderProperties(props, store));
editor.addEventListener("tool", () => {
  for (const b of toolButtons) b.classList.toggle("on", b.dataset["tool"] === editor.tool.name);
  renderToolPanel(toolPanel, editor);
});
editor.addEventListener("status", refreshStatus);
editor.addEventListener("rename-room", () => {
  const input = props.querySelector("input[name=room-name]");
  input?.focus();
  input?.select();
});
window.addEventListener("keydown", (e) => {
  const target = e.target;
  if (target.closest("input, select, textarea")) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (ctrl) {
    if (k === "z" && !e.shiftKey) store.undo();
    else if (k === "y" || k === "z" && e.shiftKey) store.redo();
    else if (k === "s") void save(e.shiftKey);
    else if (k === "o") void openProject();
    else if (k === "n") void newProject();
    else return;
    e.preventDefault();
    return;
  }
  if (view === "planta" && editor.keyDown(e)) {
    e.preventDefault();
    return;
  }
  const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
  if (tool) setTool(tool.name);
  else if (k === "f") editor.fit();
  else if (e.key === "Delete" || e.key === "Backspace") store.deleteSelection();
  else return;
  e.preventDefault();
});
if (window.casa3d) {
  window.casa3d.onCloseRequest(() => {
    if (confirmDiscard()) void window.casa3d.closeConfirmed();
  });
} else {
  window.addEventListener("beforeunload", (e) => {
    if (store.dirty) e.preventDefault();
  });
}
setView("planta");
editor.setTool("select");
editor.dispatchEvent(new Event("tool"));
refreshChrome();
renderProperties(props, store);
refreshStatus();
Object.assign(window, { __casa3d: { store, editor } });
