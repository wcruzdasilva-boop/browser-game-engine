// Ponte mínima e tipada entre o renderer (sem Node) e o processo principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('casa3d', {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (path, data) => ipcRenderer.invoke('project:save', { path, data }),
  importModel: () => ipcRenderer.invoke('import:skp'),
});
