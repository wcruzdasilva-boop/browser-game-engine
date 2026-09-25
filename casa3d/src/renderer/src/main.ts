// Casca do aplicativo: barra de ferramentas, painéis, editor da planta, aba de telhado,
// barra de status e atalhos de teclado.

import './ui/style.css';
import { createProject } from '@shared/core/model/project';
import { formatNumber } from '@shared/core/units';
import { openProjectFile, saveProjectFile } from './app/fileio';
import { Store } from './app/store';
import { PlanEditor } from './editor2d/editor';
import type { ToolName } from './editor2d/tools/tool';
import { h } from './ui/dom';
import { renderProperties } from './ui/propertiesPanel';
import { renderRoofPanel } from './ui/roofPanel';
import { renderToolPanel } from './ui/toolPanel';

type View = 'planta' | 'telhado';

const store = new Store();
let view: View = 'planta';

const TOOLS: { name: ToolName; label: string; key: string }[] = [
  { name: 'select', label: 'Selecionar', key: 'V' },
  { name: 'wall', label: 'Parede', key: 'P' },
  { name: 'door', label: 'Porta', key: 'O' },
  { name: 'window', label: 'Janela', key: 'J' },
  { name: 'dimension', label: 'Cota', key: 'C' },
];

// ---- layout ---------------------------------------------------------------
const canvas = h('canvas', { id: 'plan' });
const planHost = h('div', { class: 'canvas-host' }, canvas);
const roofHost = h('div', { class: 'roof-host', hidden: true });
const toolPanel = h('aside', { class: 'panel left' });
const props = h('aside', { class: 'panel right', id: 'props' });
const status = { hint: h('span', { class: 'hint' }), coords: h('span', { class: 'coords' }), snap: h('span', { class: 'snap' }) };
const undoBtn = h('button', { title: 'Desfazer (Ctrl+Z)', onclick: () => store.undo() }, '↶ Desfazer');
const redoBtn = h('button', { title: 'Refazer (Ctrl+Y)', onclick: () => store.redo() }, '↷ Refazer');
const toolButtons = TOOLS.map((t) =>
  h('button', { class: 'tool', 'data-tool': t.name, title: `${t.label} (${t.key})`, onclick: () => setTool(t.name) }, t.label, h('kbd', {}, t.key)));
const viewButtons = (['planta', 'telhado'] as View[]).map((v) =>
  h('button', { class: 'tab', 'data-view': v, onclick: () => setView(v) }, v === 'planta' ? 'Planta' : 'Telhado'));

document.getElementById('app')!.append(
  h('header', { class: 'toolbar' },
    h('strong', { class: 'brand' }, 'Casa3D'),
    h('div', { class: 'group' },
      h('button', { title: 'Novo (Ctrl+N)', onclick: () => void newProject() }, 'Novo'),
      h('button', { title: 'Abrir (Ctrl+O)', onclick: () => void openProject() }, 'Abrir'),
      h('button', { title: 'Salvar (Ctrl+S)', onclick: () => void save(false) }, 'Salvar'),
      h('button', { title: 'Salvar como (Ctrl+Shift+S)', onclick: () => void save(true) }, 'Salvar como')),
    h('div', { class: 'group' }, undoBtn, redoBtn),
    h('div', { class: 'group tools' }, toolButtons),
    h('div', { class: 'group tabs' }, viewButtons),
  ),
  toolPanel,
  h('main', { class: 'center' }, planHost, roofHost),
  props,
  h('footer', { class: 'statusbar' }, status.hint, status.snap, status.coords),
);

const editor = new PlanEditor(canvas, store);

// ---- ações ----------------------------------------------------------------
function setTool(name: ToolName): void {
  if (view !== 'planta') setView('planta');
  editor.setTool(name);
}

function setView(v: View): void {
  view = v;
  planHost.hidden = v !== 'planta';
  roofHost.hidden = v !== 'telhado';
  toolPanel.hidden = v !== 'planta';
  for (const b of viewButtons) b.classList.toggle('on', b.dataset['view'] === v);
  if (v === 'telhado') renderRoofPanel(roofHost, store);
  else editor.requestRender();
}

const confirmDiscard = () => !store.dirty || window.confirm('Há alterações não salvas. Descartar?');

async function newProject(): Promise<void> {
  if (!confirmDiscard()) return;
  store.load(createProject(), null);
  editor.fit();
}

async function openProject(): Promise<void> {
  if (!confirmDiscard()) return;
  try {
    const res = await openProjectFile();
    if (!res) return;
    store.load(res.project, res.path);
    editor.fit();
  } catch (e) {
    window.alert(`Não foi possível abrir o projeto: ${(e as Error).message}`);
  }
}

async function save(saveAs: boolean): Promise<void> {
  try {
    const path = await saveProjectFile(store.project, store.filePath, saveAs);
    if (path) store.markSaved(path);
  } catch (e) {
    window.alert(`Não foi possível salvar: ${(e as Error).message}`);
  }
}

// ---- atualização da interface ----------------------------------------------
function refreshChrome(): void {
  undoBtn.disabled = !store.history.canUndo;
  redoBtn.disabled = !store.history.canRedo;
  undoBtn.title = store.history.undoLabel ? `Desfazer: ${store.history.undoLabel} (Ctrl+Z)` : 'Desfazer (Ctrl+Z)';
  redoBtn.title = store.history.redoLabel ? `Refazer: ${store.history.redoLabel} (Ctrl+Y)` : 'Refazer (Ctrl+Y)';
  document.title = `${store.project.name}${store.dirty ? ' •' : ''} — Casa3D`;
}

function refreshStatus(): void {
  status.hint.textContent = editor.tool.hint();
  const c = editor.lastSnap?.point ?? editor.cursorWorld;
  status.coords.textContent = c ? `x ${formatNumber(c.x)}  y ${formatNumber(c.y)} m` : '';
  status.snap.textContent = editor.lastSnap && editor.lastSnap.kind !== 'grade' ? `captura: ${editor.lastSnap.kind}` : '';
}

store.addEventListener('change', () => {
  refreshChrome();
  // não recria o painel enquanto o usuário edita um campo dele
  const editing = (host: HTMLElement) => host.contains(document.activeElement) && !!document.activeElement?.matches('input, select');
  if (!editing(props)) renderProperties(props, store);
  if (view === 'telhado' && !editing(roofHost)) renderRoofPanel(roofHost, store);
});
store.addEventListener('selection', () => renderProperties(props, store));
editor.addEventListener('tool', () => {
  for (const b of toolButtons) b.classList.toggle('on', b.dataset['tool'] === editor.tool.name);
  renderToolPanel(toolPanel, editor);
});
editor.addEventListener('status', refreshStatus);
editor.addEventListener('rename-room', () => {
  const input = props.querySelector<HTMLInputElement>('input[name=room-name]');
  input?.focus();
  input?.select();
});

// ---- teclado ---------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (ctrl) {
    if (k === 'z' && !e.shiftKey) store.undo();
    else if (k === 'y' || (k === 'z' && e.shiftKey)) store.redo();
    else if (k === 's') void save(e.shiftKey);
    else if (k === 'o') void openProject();
    else if (k === 'n') void newProject();
    else return;
    e.preventDefault();
    return;
  }
  if (view === 'planta' && editor.keyDown(e)) {
    e.preventDefault();
    return;
  }
  const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
  if (tool) setTool(tool.name);
  else if (k === 'f') editor.fit();
  else if (e.key === 'Delete' || e.key === 'Backspace') store.deleteSelection();
  else return;
  e.preventDefault();
});

if (window.casa3d) {
  window.casa3d.onCloseRequest(() => {
    if (confirmDiscard()) void window.casa3d!.closeConfirmed();
  });
} else {
  window.addEventListener('beforeunload', (e) => {
    if (store.dirty) e.preventDefault();
  });
}

// estado inicial
setView('planta');
editor.setTool('select');
editor.dispatchEvent(new Event('tool'));
refreshChrome();
renderProperties(props, store);
refreshStatus();

// acesso para testes automatizados e depuração
Object.assign(window, { __casa3d: { store, editor } });
