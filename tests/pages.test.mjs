// Smoke test: every page of the build loads, finishes its setup and runs without errors.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openPage, waitWorldReady } from './helpers.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const PAGES = [
  { name: 'VoxelCraft', path: 'index.html?seed=42&quality=low&fresh', check: async (page) => assert.ok(await page.isVisible('#play'), 'menu with "Jogar" button') },
  { name: 'Reinos (RTS)', path: 'rts.html?autostart&seed=42&quality=low', check: async (page) => assert.match(await page.innerText('body'), /IDADE DAS TREVAS/i) },
  { name: 'Sandbox', path: 'sandbox.html?quality=low' },
  { name: 'Texture Lab', path: 'textures.html', check: async (page) => assert.ok(await page.locator('canvas').count() > 40, 'texture previews drawn') },
];

for (const { name, path, check } of PAGES) {
  test(`${name} loads without errors`, { timeout: 240_000 }, async () => {
    const { page, errors } = await openPage(browser, server.url, path);
    try {
      await waitWorldReady(page);
      await page.waitForTimeout(2000);   // a few frames of the main loop
      await check?.(page);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}
