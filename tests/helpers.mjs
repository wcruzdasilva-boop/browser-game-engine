// Shared setup for the browser tests: serves the production build (dist/) with `vite preview`
// and drives it with a headless Chromium through Playwright.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Starts `vite preview` on a free port; returns { url, close }. */
export async function startServer() {
  if (!existsSync(`${root}/dist/index.html`)) throw new Error('dist/ not found: run `npm run build` first (or use `npm test`)');
  const server = await preview({ root, logLevel: 'silent', preview: { port: 0, host: '127.0.0.1', strictPort: false } });
  const url = server.resolvedUrls.local[0];
  return { url, close: () => new Promise((r) => server.httpServer.close(r)) };
}

/**
 * Headless Chromium with software WebGL2 (SwiftShader), so the tests also run on machines without a GPU.
 * CHROMIUM_PATH overrides the browser binary (e.g. when the Playwright-managed one is not installed).
 */
export async function launchBrowser() {
  let executablePath = process.env.CHROMIUM_PATH;
  if (!executablePath && !existsSync(chromium.executablePath()) && existsSync('/opt/pw-browsers/chromium')) executablePath = '/opt/pw-browsers/chromium';
  return chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

/** Opens `path` and records uncaught exceptions, console errors and failed requests in `errors`. */
export async function openPage(browser, baseUrl, path) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(new URL(path, baseUrl).href);
  return { page, errors };
}

/** Waits for the game's `window.worldReady` flag (world generated and first frame rendered). */
export function waitWorldReady(page, timeout = 180_000) {
  return page.waitForFunction(() => window.worldReady === true, null, { timeout, polling: 500 });
}
