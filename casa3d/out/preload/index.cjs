"use strict";
const electron = require("electron");
const api = {
  openProject: () => electron.ipcRenderer.invoke("project:open"),
  saveProject: (path, data, saveAs = false) => electron.ipcRenderer.invoke("project:save", { path, data, saveAs }),
  importModel: () => electron.ipcRenderer.invoke("import:model"),
  /** a janela pediu para fechar; chame `closeConfirmed` para fechar de fato */
  onCloseRequest: (cb) => {
    electron.ipcRenderer.on("app:close-request", () => cb());
  },
  closeConfirmed: () => electron.ipcRenderer.invoke("app:close-confirmed")
};
electron.contextBridge.exposeInMainWorld("casa3d", api);
