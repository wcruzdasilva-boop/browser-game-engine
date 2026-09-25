// Importação SketchUp (somente Windows). O formato .skp é proprietário: a leitura confiável
// é feita pelo SketchUp C SDK (Trimble). Um conversor nativo (native/skp-converter),
// empacotado em resources/skp-converter, é chamado como processo filho:
//   skp-converter.exe <entrada.skp> <saida.glb>
// Ele converte polegadas → metros e preserva tags/grupos/componentes como nós do glTF.
// Rodar em processo separado isola falhas do SDK e evita recompilar addon a cada Electron.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from 'electron';

export type ImportResult =
  | { ok: true; format: string; file: string; units: 'm' | 'origem' }
  | { ok: false; error: string };

function converterPath(): string | null {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'skp-converter')
    : path.join(app.getAppPath(), 'native', 'skp-converter', 'bin');
  const p = path.join(base, 'skp-converter.exe');
  return existsSync(p) ? p : null;
}

export async function convertModel(file: string): Promise<ImportResult> {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.skp') return { ok: true, format: ext.slice(1), file, units: 'origem' };
  const bin = converterPath();
  if (!bin) return { ok: false, error: 'Conversor SketchUp não encontrado nesta instalação.' };
  const out = path.join(tmpdir(), `casa3d-${Date.now()}.glb`);
  return new Promise((resolve) => {
    execFile(bin, [file, out], { timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) resolve({ ok: false, error: stderr || err.message });
      else resolve({ ok: true, format: 'glb', file: out, units: 'm' });
    });
  });
}
