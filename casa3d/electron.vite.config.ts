import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

const alias = { '@shared': resolve(__dirname, 'src/shared') };

// main e preload rodam em Node (Electron); o renderer é uma página comum servida pelo Vite.
export default defineConfig({
  main: { resolve: { alias } },
  // preload em CommonJS para funcionar com sandbox: true
  preload: {
    resolve: { alias },
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    resolve: { alias },
    build: { target: 'es2022' },
  },
});
