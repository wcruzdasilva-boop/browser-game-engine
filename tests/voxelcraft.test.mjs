// VoxelCraft: the world streams in around the player and blocks can be edited.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openPage, waitWorldReady } from './helpers.mjs';

let server, browser, page, errors;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
  ({ page, errors } = await openPage(browser, server.url, 'index.html?seed=7&quality=low&fresh&t=12'));
  await waitWorldReady(page);
  await page.click('#play');
  await page.waitForTimeout(3000);
});
after(async () => { await browser?.close(); await server?.close(); });

test('world is generated around the player', async () => {
  const r = await page.evaluate(() => {
    const p = window.game.player.position, w = window.world;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    let y = 255;
    while (y > 0 && !w.getBlock(x, y, z)) y--;
    return { y, feet: p.y, id: w.getBlock(x, y, z) };
  });
  assert.ok(r.y > 0 && r.id > 0, 'solid ground under the player');
  assert.ok(r.feet >= r.y, 'player stands on (not inside) the terrain');
});

test('blocks can be removed and placed back', async () => {
  const r = await page.evaluate(() => {
    const p = window.game.player.position, w = window.world;
    const x = Math.floor(p.x) + 2, z = Math.floor(p.z);
    let y = 255;
    while (y > 0 && !w.getBlock(x, y, z)) y--;
    const id = w.getBlock(x, y, z);
    const removed = w.setBlock(x, y, z, 0) && w.getBlock(x, y, z) === 0;
    const placed = w.setBlock(x, y, z, id) && w.getBlock(x, y, z) === id;
    return { removed, placed };
  });
  assert.deepEqual(r, { removed: true, placed: true });
});

test('no runtime errors', () => assert.deepEqual(errors, []));
