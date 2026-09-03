/* ============================================================
   GHOST COUNT — dev-only browser verification and screenshots
   Uses the workspace's Playwright install; not required by the game.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const ROOT = __dirname;
const SHOTS = path.join(ROOT, '.ai', 'shots');
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml' };

function server() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
}

async function waitScreen(page, name) {
  await page.waitForFunction(expected => document.getElementById('app').dataset.screen === expected, name, { timeout: 15000 });
}

async function startRound(page) {
  if ((await page.locator('#app').getAttribute('data-screen')) === 'result') await page.click('#again-btn');
  await waitScreen(page, 'camera');
  await page.click('#shutter');
  await waitScreen(page, 'guess');
}

async function clickGhostByIndex(page, index) {
  const box = await page.locator('.ghost-target.ready').nth(index).boundingBox();
  assert(box, `ghost ${index + 1} has a pointer target`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function finishCount(page) {
  await waitScreen(page, 'count');
  const before = await page.evaluate(() => GhostCountTest.round.counted);
  await clickGhostByIndex(page, 0);
  await clickGhostByIndex(page, 0);
  const after = await page.evaluate(() => GhostCountTest.round.counted);
  assert.strictEqual(after, before + 1, 'a ghost counts exactly once');
  await page.evaluate(() => GhostCountTest.tapAll());
  await waitScreen(page, 'result');
}

function assertPlacementSpread(positions, label) {
  assert(positions.length >= 4, `${label}: needs at least four ghosts`);
  const ys = positions.map(position => position.y);
  const scales = positions.map(position => position.scale);
  const verticalBands = new Set(ys.map(y => Math.min(2, Math.floor(y * 3))));
  assert(verticalBands.size >= 2, `${label}: ghosts span multiple vertical bands`);
  assert(Math.max(...ys) - Math.min(...ys) >= 0.2, `${label}: ghosts are not collinear`);
  assert(Math.max(...scales) - Math.min(...scales) >= 0.55, `${label}: scales show meaningful depth variation`);
  assert(scales.some(scale => scale <= 0.5), `${label}: includes a tiny/far ghost`);
  assert(scales.some(scale => scale >= 1.35), `${label}: includes a large/near ghost`);
}

async function personCloseupClip(page) {
  return page.evaluate(() => {
    const boundaryGhost = document.querySelector('.ghost-target.behind-person').getBoundingClientRect();
    const x = Math.max(0, boundaryGhost.left - 72), y = Math.max(0, boundaryGhost.top - 88);
    return {
      x,
      y,
      width: Math.min(innerWidth - x, boundaryGhost.width + 144),
      height: Math.min(innerHeight - y, boundaryGhost.height + 210),
    };
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const local = server();
  await new Promise(resolve => local.once('listening', resolve));
  const port = local.address().port;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.stack || err.message));
  page.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${port}/`)) externalRequests.push(request.url()); });

  try {
    await page.goto(`http://127.0.0.1:${port}/?demo=1&test=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    await page.click('#book-btn');
    await waitScreen(page, 'ghostbook');
    await page.click('#back-btn');

    await page.click('#play-btn');
    await startRound(page);
    assert.strictEqual(await page.locator('[data-choice]').count(), 3, 'three choices render');
    const micHeight = await page.locator('.say-prompt').evaluate(element => element.getBoundingClientRect().height);
    assert(micHeight >= 80, 'speech prompt is a prominent primary affordance');
    await page.screenshot({ path: path.join(SHOTS, 'guess.png') });
    await page.evaluate(() => { GhostCountTest.forceLucky(1); GhostCountTest.forceSurprise('vanish'); });
    const largestChoice = await page.locator('[data-choice]').evaluateAll(buttons => Math.max(...buttons.map(button => Number(button.dataset.choice))));
    await page.locator(`[data-choice="${largestChoice}"]`).click();
    await waitScreen(page, 'reveal');
    await page.waitForFunction(() => document.querySelectorAll('.ghost-target.materialize').length >= 2);
    await page.waitForSelector('.person-cutout.has-person');
    await page.screenshot({ path: path.join(SHOTS, 'person-reveal.png') });
    await waitScreen(page, 'count');
    assert.strictEqual(await page.locator('.ghost-target.fake').count(), 0, 'vanished ghost is removed before counting');
    const visibleCount = await page.locator('.ghost-target.ready').count();
    const announced = await page.evaluate(() => GhostCountTest.round.total);
    assert.strictEqual(visibleCount, announced, 'revealed count equals announced total');
    const personRound = await page.evaluate(() => GhostCountTest.round);
    assert(personRound.personDetected, 'classroom demo detects its person');
    assert(personRound.positions.filter(position => position.nearPerson).length >= Math.ceil(announced * 0.6), 'most ghosts occupy the person proximity band');
    const behind = personRound.positions.filter(position => position.behind);
    assert(behind.length >= 1, 'at least one ghost is deliberately behind the person');
    assert(behind.every(position => position.personOverlap >= 0.25 && position.personOverlap <= 0.45), 'behind overlap stays within 25–45%');
    assert(personRound.positions.every(position => position.personOverlap <= 0.45), 'no ghost is hidden beyond the overlap cap');
    assert(personRound.positions.every(position => position.faceOverlap === 0), 'ghost face regions remain completely visible');
    assert.strictEqual(await page.locator('.ghost-target.behind-person').count(), behind.length, 'behind metadata reaches the rendered ghosts');
    assert.strictEqual(await page.locator('.person-cutout').evaluate(element => getComputedStyle(element).pointerEvents), 'none', 'person cutout cannot block taps');
    assertPlacementSpread(personRound.positions, 'main counting round');
    await page.screenshot({ path: path.join(SHOTS, 'person-counting.png') });
    await page.screenshot({ path: path.join(SHOTS, 'person-closeup.png'), clip: await personCloseupClip(page) });
    await clickGhostByIndex(page, 0);
    await page.waitForTimeout(350);
    const badgeSize = await page.locator('.ghost-target.counted .count-badge').evaluate(element => element.getBoundingClientRect().width);
    assert(badgeSize >= 54, 'count badge is projector-legible');
    await page.screenshot({ path: path.join(SHOTS, 'counting.png') });
    for (let index = 1; index < visibleCount; index += 1) await clickGhostByIndex(page, index);
    assert.strictEqual(await page.evaluate(() => GhostCountTest.round.counted), announced, 'every person-scene ghost remains reachable by a real pointer click');
    await waitScreen(page, 'result');
    assert((await page.locator('.result-total').innerText()).startsWith(String(announced)), 'result announces actual total');
    assert.strictEqual(await page.locator('.count-caption').count(), 0, 'counting caption is dismissed on result');
    await page.waitForTimeout(550);
    await page.screenshot({ path: path.join(SHOTS, 'result.png') });

    for (let round = 0; round < 2; round += 1) {
      await startRound(page);
      await page.evaluate(() => GhostCountTest.forceLucky(1));
      await page.locator('[data-choice]').nth(round % 3).click();
      await finishCount(page);
    }
    await waitScreen(page, 'evolution');
    await page.waitForTimeout(4100);
    await page.screenshot({ path: path.join(SHOTS, 'evolution.png') });
    const evolved = await page.evaluate(() => GhostCountTest.state().progress.stage);
    assert.strictEqual(evolved, 2, 'three lucky guesses evolve stage 1 to 2');

    const maskCheck = await page.evaluate(() => {
      const width = 96, height = 96, data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const skin = x >= 34 && x <= 62 && y >= 9 && y <= 62;
        const i = (y * width + x) * 4;
        data[i] = skin ? 205 : 62; data[i+1] = skin ? 154 : 118; data[i+2] = skin ? 118 : 170; data[i+3] = 255;
      }
      const analysis = Scene.__test.analyze({ data, width, height }, { count: 6, seed: 44 });
      return analysis.positions.every(p => !Scene.__test.isExcluded(analysis, p.x, p.y) && !Scene.__test.footprintOverlaps(analysis, p));
    });
    assert(maskCheck, 'placement footprints avoid the synthetic skin/body mask');

    await page.reload({ waitUntil: 'networkidle' });
    assert.strictEqual(await page.evaluate(() => GhostCountTest.state().progress.stage), 2, 'progress survives reload');
    const storageAudit = await page.evaluate(() => ({ count: localStorage.length, value: localStorage.getItem('eslCounting.v1') || '' }));
    assert.strictEqual(storageAudit.count, 1, 'only one localStorage key is used');
    assert(!/data:image|base64|photo/i.test(storageAudit.value), 'no image data is persisted');
    await page.setViewportSize({ width: 900, height: 500 });
    const titleFitsLandscape = await page.evaluate(() => {
      const button = document.getElementById('play-btn').getBoundingClientRect();
      return button.top >= 0 && button.bottom <= innerHeight && button.left >= 0 && button.right <= innerWidth;
    });
    assert(titleFitsLandscape, 'primary title control fits a short landscape viewport');
    await page.setViewportSize({ width: 430, height: 860 });
    await page.click('#play-btn');
    await startRound(page);
    await page.evaluate(() => { Math.random = () => 0.99; });
    await page.locator('[data-choice]').first().click();
    await finishCount(page);
    assert((await page.locator('.result-note').innerText()).startsWith('Ooh!'), 'a mismatch is framed as a cheerful surprise');
    assert(!/wrong|try again|mistake/i.test(await page.locator('body').innerText()), 'mismatch UI contains no failure language');

    const placementContext = await browser.newContext({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 1 });
    const placementPage = await placementContext.newPage();
    placementPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    placementPage.on('pageerror', err => consoleErrors.push(err.stack || err.message));
    placementPage.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${port}/`)) externalRequests.push(request.url()); });
    await placementPage.goto(`http://127.0.0.1:${port}/?demo=1&test=1`, { waitUntil: 'networkidle' });
    await placementPage.click('#play-btn');
    for (const [index, filename] of ['placement-a.png', 'placement-b.png'].entries()) {
      await startRound(placementPage);
      const maxChoice = await placementPage.locator('[data-choice]').evaluateAll(buttons => Math.max(...buttons.map(button => Number(button.dataset.choice))));
      await placementPage.evaluate(() => GhostCountTest.forceLucky(1));
      await placementPage.locator(`[data-choice="${maxChoice}"]`).click();
      await waitScreen(placementPage, 'count');
      const sampleRound = await placementPage.evaluate(() => GhostCountTest.round);
      assertPlacementSpread(sampleRound.positions, `placement sample ${index + 1}`);
      if (index === 0) assert(sampleRound.personDetected, 'classroom placement sample exercises person behavior');
      else {
        assert(!sampleRound.personDetected, 'playground remains on the person-free placement path');
        assert.strictEqual(await placementPage.locator('.person-cutout.has-person').count(), 0, 'person-free scene has no cutout layer content');
      }
      await placementPage.screenshot({ path: path.join(SHOTS, filename) });
      if (index === 0) { await placementPage.evaluate(() => GhostCountTest.tapAll()); await waitScreen(placementPage, 'result'); }
    }
    await placementPage.evaluate(() => {
      State.update(draft => {
        draft.progress.stage = 3;
        draft.progress.discovered['01'] = [true, true, true];
        return draft;
      });
      GhostCountTest.showTitle();
    });
    await placementPage.waitForSelector('.ghost-svg--nokomaru');
    await placementPage.screenshot({ path: path.join(SHOTS, 'nokomaru.png') });
    await placementContext.close();

    assert.deepStrictEqual(externalRequests, [], `external requests: ${externalRequests.join('\n')}`);
    assert.deepStrictEqual(consoleErrors, [], `console errors: ${consoleErrors.join('\n')}`);
    console.log('PASS full loop, counting idempotence, vanish, evolution, persistence, placement, console');
    console.log('SHOTS person-counting.png person-reveal.png person-closeup.png placement-b.png');
  } finally {
    await browser.close();
    await new Promise(resolve => local.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
