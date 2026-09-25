// Processo principal do Electron: janela, menus e acesso a disco. Todo o app roda
// localmente; o renderer não tem Node habilitado e fala com este processo via preload.
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { convertSkp } from './skp.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const devUrl = process.env.CASA3D_DEV_URL; // ex.: http://localhost:5174 durante `npm run dev`

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Casa3D',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(here, '..', 'dist', 'index.html'));
}

const PROJECT_FILTER = { name: 'Projeto Casa3D', extensions: ['casa3d'] };

ipcMain.handle('project:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [PROJECT_FILTER], properties: ['openFile'] });
  if (canceled) return null;
  return { path: filePaths[0], data: JSON.parse(await readFile(filePaths[0], 'utf8')) };
});

ipcMain.handle('project:save', async (_e, { path: target, data }) => {
  if (!target) {
    const res = await dialog.showSaveDialog({ filters: [PROJECT_FILTER] });
    if (res.canceled) return null;
    target = res.filePath;
  }
  await writeFile(target, JSON.stringify(data, null, 2), 'utf8');
  return target;
});

ipcMain.handle('import:skp', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'SketchUp', extensions: ['skp'] }, { name: 'Modelos 3D', extensions: ['dae', 'glb', 'gltf', 'obj'] }],
    properties: ['openFile'],
  });
  if (canceled) return null;
  return convertSkp(filePaths[0]);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
