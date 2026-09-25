// Processo principal do Electron: janela, diálogos e acesso a disco. Todo o app roda
// localmente; o renderer não tem Node habilitado e fala com este processo via preload.
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { convertModel } from './skp';

const PROJECT_FILTER = { name: 'Projeto Casa3D', extensions: ['casa3d'] };

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Casa3D',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // electron-vite define ELECTRON_RENDERER_URL no modo dev
  // fechar com alterações não salvas: o renderer confirma e responde com app:close-confirmed
  let allowClose = false;
  win.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    win.webContents.send('app:close-request');
  });
  ipcMain.removeHandler('app:close-confirmed');
  ipcMain.handle('app:close-confirmed', () => {
    allowClose = true;
    win.close();
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

ipcMain.handle('project:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [PROJECT_FILTER], properties: ['openFile'] });
  const file = filePaths[0];
  if (canceled || !file) return null;
  return { path: file, data: JSON.parse(await readFile(file, 'utf8')) as unknown };
});

ipcMain.handle('project:save', async (_e, { path: target, data, saveAs }: { path: string | null; data: unknown; saveAs?: boolean }) => {
  if (!target || saveAs) {
    const res = await dialog.showSaveDialog({ filters: [PROJECT_FILTER], defaultPath: target ?? undefined });
    if (res.canceled || !res.filePath) return null;
    target = res.filePath;
  }
  await writeFile(target, JSON.stringify(data, null, 2), 'utf8');
  return target;
});

ipcMain.handle('import:model', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'SketchUp', extensions: ['skp'] }, { name: 'Modelos 3D', extensions: ['dae', 'glb', 'gltf', 'obj'] }],
    properties: ['openFile'],
  });
  const file = filePaths[0];
  if (canceled || !file) return null;
  return convertModel(file);
});

void app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
