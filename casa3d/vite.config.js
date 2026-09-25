import { defineConfig } from 'vite';

// O renderer é servido pelo Vite em dev e carregado de dist/ pelo Electron em produção.
export default defineConfig({
  base: './',
  server: { port: 5174 },
  build: { target: 'es2022', outDir: 'dist' },
});
