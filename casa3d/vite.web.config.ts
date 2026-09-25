import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Renderer isolado no navegador (sem Electron) — útil para desenvolver a interface e para
// testes automatizados; salvar/abrir cai no download/upload do navegador.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  server: { port: 5174 },
  build: { outDir: resolve(__dirname, 'out/web'), emptyOutDir: true, target: 'es2022' },
});
