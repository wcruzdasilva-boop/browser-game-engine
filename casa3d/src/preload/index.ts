// Ponte mínima entre o renderer (sem Node) e o processo principal.
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openProject: (): Promise<{ path: string; data: unknown } | null> => ipcRenderer.invoke('project:open'),
  saveProject: (path: string | null, data: unknown, saveAs = false): Promise<string | null> =>
    ipcRenderer.invoke('project:save', { path, data, saveAs }),
  importModel: (): Promise<unknown> => ipcRenderer.invoke('import:model'),
  /** a janela pediu para fechar; chame `closeConfirmed` para fechar de fato */
  onCloseRequest: (cb: () => void): void => {
    ipcRenderer.on('app:close-request', () => cb());
  },
  closeConfirmed: (): Promise<void> => ipcRenderer.invoke('app:close-confirmed'),
};

export type Casa3DApi = typeof api;

contextBridge.exposeInMainWorld('casa3d', api);
