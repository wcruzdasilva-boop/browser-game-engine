// Importação SketchUp. O formato .skp é proprietário: a leitura confiável é feita pelo
// SketchUp C SDK (Trimble), disponível para Windows e macOS. Um conversor nativo
// (native/skp-converter) é empacotado junto ao app e chamado como processo filho:
//   skp-converter <entrada.skp> <saida.glb>
// Ele converte polegadas → metros e preserva tags/grupos/componentes como nós do glTF.
// Sem o conversor (ex.: Linux), o usuário importa um .dae/.glb exportado pelo SketchUp.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from 'electron';

const exe = process.platform === 'win32' ? 'skp-converter.exe' : 'skp-converter';

function converterPath() {
  const base = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'native', 'skp-converter', 'bin');
  const p = path.join(base, exe);
  return existsSync(p) ? p : null;
}

export async function convertSkp(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.skp') return { ok: true, format: ext.slice(1), file };
  const bin = converterPath();
  if (!bin) {
    return { ok: false, error: 'Conversor SketchUp indisponível nesta plataforma. No SketchUp, exporte como .dae (Collada) e importe esse arquivo.' };
  }
  const out = path.join(tmpdir(), `casa3d-${Date.now()}.glb`);
  return new Promise((resolve) => {
    execFile(bin, [file, out], { timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) resolve({ ok: false, error: stderr || err.message });
      else resolve({ ok: true, format: 'glb', file: out, units: 'm' });
    });
  });
}
