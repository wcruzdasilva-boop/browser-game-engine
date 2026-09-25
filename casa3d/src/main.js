// Renderer — casca inicial do app: painel de camadas e calculadora de telhado ligada ao
// módulo de cálculo. O editor 2D (src/editor2d) e a vista 3D (src/view3d) entram aqui
// nas próximas fases (ver docs/PROPOSTA.md).
import './ui/style.css';
import { LAYERS } from './view3d/layers.js';
import { ROOF_TYPES, calculateRoof } from './calc/roof.js';
import { ROOF_TILES } from './catalog/roofTiles.js';
import { STRUCTURE_SYSTEMS } from './catalog/roofStructure.js';

const fmt = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const options = (obj, label = (v) => v.name ?? v) =>
  Object.entries(obj).map(([k, v]) => `<option value="${k}">${label(v)}</option>`).join('');

document.getElementById('app').innerHTML = `
  <aside>
    <h1>Casa3D</h1>
    <h2>Camadas</h2>
    <ol class="layers">${LAYERS.map((l) => `<li><label><input type="checkbox" ${l.extra ? '' : 'checked'}> ${l.id}. ${l.name}</label></li>`).join('')}</ol>
  </aside>
  <main>
    <h2>Telhado</h2>
    <form id="roof">
      <label>Largura (m) <input name="width" type="number" step="0.01" value="10"></label>
      <label>Profundidade (m) <input name="depth" type="number" step="0.01" value="8"></label>
      <label>Modelo <select name="type">${options(ROOF_TYPES)}</select></label>
      <label>Inclinação (%) <input name="slope" type="number" step="1" value="30"></label>
      <label>Beiral (m) <input name="overhang" type="number" step="0.05" value="0.50"></label>
      <label>Telha <select name="tile">${options(ROOF_TILES)}</select></label>
      <label>Estrutura <select name="structure">${options(STRUCTURE_SYSTEMS)}</select></label>
    </form>
    <section id="result"></section>
  </main>`;

const form = document.getElementById('roof');
const result = document.getElementById('result');

function update() {
  const f = Object.fromEntries(new FormData(form));
  try {
    const r = calculateRoof({
      width: +f.width, depth: +f.depth, type: f.type, slope: +f.slope / 100,
      overhang: +f.overhang, tile: f.tile, structure: f.structure,
    });
    const g = r.geometry;
    const struct = r.structure.items.map((i) =>
      `<tr><td>${i.name}</td><td>${i.section}</td><td>${i.count}</td><td>${fmt(i.totalLength, 1)} m</td><td>${i.volumeM3 != null ? `${fmt(i.volumeM3, 3)} m³` : `${fmt(i.massKg, 0)} kg`}</td></tr>`).join('');
    result.innerHTML = `
      ${r.warnings.map((w) => `<p class="warn">${w}</p>`).join('')}
      <p>Área de telhado: <b>${fmt(g.area)} m²</b> · desnível da água: ${fmt(g.rise)} m${g.parapetHeight ? ` · platibanda: ${fmt(g.parapetHeight)} m` : ''} · carga da cobertura ≈ ${fmt(r.loadKg, 0)} kg</p>
      <h3>Cobertura</h3>
      <table>${r.cover.items.map((i) => `<tr><td>${i.name}</td><td>${i.qty} ${i.unit}</td></tr>`).join('')}</table>
      <h3>Estrutura — ${r.structure.system}</h3>
      <table><tr><th>Peça</th><th>Seção</th><th>Qtd.</th><th>Total</th><th></th></tr>${struct}</table>`;
  } catch (e) {
    result.innerHTML = `<p class="warn">${e.message}</p>`;
  }
}
form.addEventListener('input', update);
update();
