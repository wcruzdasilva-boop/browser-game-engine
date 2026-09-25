import { app, ipcMain, dialog, BrowserWindow } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
function converterPath() {
  const base = app.isPackaged ? path.join(process.resourcesPath, "skp-converter") : path.join(app.getAppPath(), "native", "skp-converter", "bin");
  const p = path.join(base, "skp-converter.exe");
  return existsSync(p) ? p : null;
}
async function convertModel(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== ".skp") return { ok: true, format: ext.slice(1), file, units: "origem" };
  const bin = converterPath();
  if (!bin) return { ok: false, error: "Conversor SketchUp não encontrado nesta instalação." };
  const out = path.join(tmpdir(), `casa3d-${Date.now()}.glb`);
  return new Promise((resolve) => {
    execFile(bin, [file, out], { timeout: 12e4 }, (err, _stdout, stderr) => {
      if (err) resolve({ ok: false, error: stderr || err.message });
      else resolve({ ok: true, format: "glb", file: out, units: "m" });
    });
  });
}
const PROJECT_FILTER = { name: "Projeto Casa3D", extensions: ["casa3d"] };
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "Casa3D",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  let allowClose = false;
  win.on("close", (e) => {
    if (allowClose) return;
    e.preventDefault();
    win.webContents.send("app:close-request");
  });
  ipcMain.removeHandler("app:close-confirmed");
  ipcMain.handle("app:close-confirmed", () => {
    allowClose = true;
    win.close();
  });
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}
ipcMain.handle("project:open", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [PROJECT_FILTER], properties: ["openFile"] });
  const file = filePaths[0];
  if (canceled || !file) return null;
  return { path: file, data: JSON.parse(await readFile(file, "utf8")) };
});
ipcMain.handle("project:save", async (_e, { path: target, data, saveAs }) => {
  if (!target || saveAs) {
    const res = await dialog.showSaveDialog({ filters: [PROJECT_FILTER], defaultPath: target ?? void 0 });
    if (res.canceled || !res.filePath) return null;
    target = res.filePath;
  }
  await writeFile(target, JSON.stringify(data, null, 2), "utf8");
  return target;
});
ipcMain.handle("import:model", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: "SketchUp", extensions: ["skp"] }, { name: "Modelos 3D", extensions: ["dae", "glb", "gltf", "obj"] }],
    properties: ["openFile"]
  });
  const file = filePaths[0];
  if (canceled || !file) return null;
  return convertModel(file);
});
void app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
