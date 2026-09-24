// Reinos (RTS): gathering, a fast-forwarded match against the AI and simulation invariants.
// The match is advanced with game.step() (the same step the main loop uses) while the render loop is paused.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openPage, waitWorldReady } from './helpers.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

async function startMatch(query) {
  const { page, errors } = await openPage(browser, server.url, `rts.html?autostart&quality=low&${query}`);
  await waitWorldReady(page);
  await page.evaluate(() => { window.game.paused = true; });
  return { page, errors };
}

test('villagers reach and chop standing trees from every side', { timeout: 240_000 }, async () => {
  const { page, errors } = await startMatch('seed=42');
  try {
    const r = await page.evaluate(() => {
      const g = window.game, s = g.sim, P = g.world.path;
      g.ai.update = () => {};   // only our villagers act
      s.players[0].popCap = 500;
      const tc = s.buildings.find((b) => b.owner === 0 && b.kind === 'town_center');
      const trees = g.trees.trees.filter((t) => Math.hypot(t.x - tc.x, t.z - tc.z) < 70).slice(0, 48);
      const jobs = [];
      trees.forEach((t, i) => {
        const a = (i % 4) * Math.PI / 2;   // approach from E, S, W, N
        const x = t.x + Math.cos(a) * 3.2, z = t.z + Math.sin(a) * 3.2;
        if (!P.isFreeAt(x, z)) return;
        const v = s.addUnit('villager', 0, x, z);
        v.command({ type: 'gather', target: t, kind: 'tree' });
        jobs.push({ v, t });
      });
      for (let k = 0; k < 1000; k++) g.step(0.06);   // 60 s
      // the bug this guards against: pushing forever against an obstacle beside a tree that never comes down
      const stuck = jobs.filter((j) => j.t.state === 'standing' && j.v.order?.target === j.t);
      const chopped = jobs.filter((j) => j.t.amount < 100 || j.v.carry.amount > 0).length;
      return { jobs: jobs.length, chopped, stuck: stuck.map((j) => `tree (${j.t.x.toFixed(1)}, ${j.t.z.toFixed(1)}) villager (${j.v.x.toFixed(1)}, ${j.v.z.toFixed(1)})`) };
    });
    assert.ok(r.jobs >= 15, `enough trees tested (${r.jobs})`);
    assert.deepEqual(r.stuck, [], 'villagers stuck walking into an obstacle next to a standing tree');
    // a log can fall where its work spots need a long detour, so allow a few still on their way
    assert.ok(r.chopped >= r.jobs * 0.9, `trees being worked: ${r.chopped}/${r.jobs}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('a villager ordered through the controls gathers and deposits wood', { timeout: 240_000 }, async () => {
  const { page, errors } = await startMatch('seed=42');
  try {
    const wood = await page.evaluate(() => {
      const g = window.game, s = g.sim;
      g.ai.update = () => {};
      const tc = s.buildings.find((b) => b.owner === 0 && b.kind === 'town_center');
      const v = s.units.find((u) => u.owner === 0 && u.isVillager);
      const tree = s.findResource('tree', tc.x, tc.z, 80, v);
      g.controls.setSelection([v]);
      g.controls.commandAt(tree.x, tree.z, tree);
      for (let k = 0; k < 1500; k++) g.step(0.06);   // 90 s
      return s.players[0].gathered.wood;
    });
    assert.ok(wood >= 10, `wood deposited: ${wood}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

/** Advances `minutes` of game time checking invariants every minute; returns the per-minute log. */
function playMinutes(page, minutes) {
  return page.evaluate((minutes) => {
    const g = window.game, s = g.sim, log = [];
    for (let min = 1; min <= minutes && s.winner < 0; min++) {
      for (let k = 0; k < 1000 && s.winner < 0; k++) g.step(0.06);
      const badUnits = s.units.filter((u) => ![u.x, u.z, u.hp].every(Number.isFinite)).length;
      const badRes = s.players.flatMap((p, i) => Object.entries(p.res).filter(([, v]) => !(v >= 0)).map(([k, v]) => `p${i}.${k}=${v}`));
      const ai = s.players[1];
      const p0 = [...s.buildings, ...s.units].filter((e) => e.alive && e.owner === 0 && !e.isAnimal).map((e) => e.kind).join(',');
      const army = s.units.filter((u) => u.owner === 1 && u.isMilitary).length;
      log.push({ min, badUnits, badRes, winner: s.winner, age: ai.age, pop: ai.pop, army, p0, gathered: { ...ai.gathered }, res: { ...ai.res } });
    }
    return log;
  }, minutes);
}

function assertValid(log) {
  for (const m of log) {
    assert.equal(m.badUnits, 0, `units with invalid position/hp at minute ${m.min}`);
    assert.deepEqual(m.badRes, [], `invalid resources at minute ${m.min}`);
  }
}

test('AI builds up its economy and advances an age (normal)', { timeout: 480_000 }, async () => {
  const { page, errors } = await startMatch('seed=7&difficulty=normal');
  try {
    const log = await playMinutes(page, 18);
    assertValid(log);
    const end = log.at(-1);
    assert.ok(end.gathered.wood >= 400, `AI gathered wood: ${end.gathered.wood}`);
    assert.ok(end.gathered.food >= 800, `AI gathered food: ${end.gathered.food}`);
    assert.ok(end.age >= 1, `AI age: ${end.age}`);
    assert.ok(end.pop >= 25, `AI population: ${end.pop}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('AI defeats an idle player (hard)', { timeout: 480_000 }, async () => {
  const { page, errors } = await startMatch('seed=42&difficulty=hard');
  try {
    const log = await playMinutes(page, 25);
    assertValid(log);
    const summary = log.map((m) => `m${m.min}: AI army ${m.army}, player 0 has [${m.p0}]`).join('\n');
    assert.equal(log.at(-1).winner, 1, `winner after ${log.length} min\n${summary}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
