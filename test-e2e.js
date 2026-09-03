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

async function installSpeechRecognitionStub(context) {
  await context.addInitScript(() => {
    class TestSpeechRecognition {
      constructor() {
        window.__ghostCountRecognizers = window.__ghostCountRecognizers || [];
        window.__ghostCountRecognizers.push(this);
      }
      start() { window.__ghostCountRecognition = this; }
      stop() {}
      abort() {}
    }
    window.SpeechRecognition = TestSpeechRecognition;
    window.webkitSpeechRecognition = TestSpeechRecognition;
  });
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

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const local = server();
  await new Promise(resolve => local.once('listening', resolve));
  const port = local.address().port;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 1 });
  await installSpeechRecognitionStub(context);
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
    assert.strictEqual(await page.evaluate(() => Speech.supported()), true, 'speech recognition is available in the primary-input run');
    assert.strictEqual(await page.locator('[data-choice]').count(), 0, 'number buttons stay absent while speech is available');
    assert.strictEqual(await page.locator('.choice-label').count(), 0, 'speech-only state has no tap-number label');
    const micHeight = await page.locator('.say-prompt').evaluate(element => element.getBoundingClientRect().height);
    assert(micHeight >= 80, 'speech prompt is a prominent primary affordance');
    await page.screenshot({ path: path.join(SHOTS, 'guess.png') });
    await page.evaluate(() => { GhostCountTest.forceLucky(1); GhostCountTest.forceSurprise('vanish'); });
    const largestChoice = await page.evaluate(() => Math.max(...GhostCountTest.round.choices));
    await page.evaluate(choice => GhostCountTest.choose(choice), largestChoice);
    await waitScreen(page, 'reveal');
    await page.waitForFunction(() => document.querySelectorAll('.ghost-target.materialize').length >= 2);
    await page.screenshot({ path: path.join(SHOTS, 'person-reveal.png') });
    await waitScreen(page, 'count');
    assert.strictEqual(await page.locator('.ghost-target.fake').count(), 0, 'vanished ghost is removed before counting');
    const visibleCount = await page.locator('.ghost-target.ready').count();
    const announced = await page.evaluate(() => GhostCountTest.round.total);
    assert.strictEqual(visibleCount, announced, 'revealed count equals announced total');
    const personRound = await page.evaluate(() => GhostCountTest.round);
    assert(personRound.personDetected, 'classroom demo detects its person');
    assert(personRound.positions.filter(position => position.nearPerson).length >= Math.ceil(announced * 0.6), 'most ghosts occupy the person proximity band');
    assert(personRound.positions.every(position => position.personOverlap <= 0.02), 'ghost footprints do not meaningfully overlap the person silhouette');
    assert(personRound.positions.every(position => position.faceOverlap === 0), 'faces and heads remain hard-excluded placement targets');
    assert.strictEqual(await page.locator('.person-cutout').count(), 0, 'the person occlusion layer is absent');
    assertPlacementSpread(personRound.positions, 'main counting round');
    await page.screenshot({ path: path.join(SHOTS, 'person-counting.png') });
    for (let index = 0; index < visibleCount; index += 1) {
      const before = await page.evaluate(() => GhostCountTest.round.counted);
      await clickGhostByIndex(page, index);
      await clickGhostByIndex(page, index);
      const after = await page.evaluate(() => GhostCountTest.round.counted);
      assert.strictEqual(after, before + 1, `person-scene ghost ${index + 1} counts exactly once`);
      if (index === 0) {
        await page.waitForTimeout(350);
        const badgeSize = await page.locator('.ghost-target.counted .count-badge').evaluate(element => element.getBoundingClientRect().width);
        assert(badgeSize >= 54, 'count badge is projector-legible');
        await page.screenshot({ path: path.join(SHOTS, 'counting.png') });
      }
    }
    assert.strictEqual(await page.evaluate(() => GhostCountTest.round.counted), announced, 'every person-scene ghost remains reachable by a real pointer click');
    await waitScreen(page, 'result');
    assert((await page.locator('.result-total').innerText()).startsWith(String(announced)), 'result announces actual total');
    assert.strictEqual(await page.locator('.count-caption').count(), 0, 'counting caption is dismissed on result');
    await page.waitForTimeout(550);
    await page.screenshot({ path: path.join(SHOTS, 'result.png') });

    for (let round = 0; round < 2; round += 1) {
      await startRound(page);
      await page.evaluate(() => GhostCountTest.forceLucky(1));
      assert.strictEqual(await page.locator('[data-choice]').count(), 0, 'each speech-ready guess starts without number buttons');
      if (round === 0) {
        /* A thinking child produces silence, and recognition ends itself on silence.
           Neither a transient error nor one quiet restart may demote speech. */
        await page.evaluate(() => {
          const recognizer = window.__ghostCountRecognition;
          recognizer.onerror({ error: 'no-speech' });
          recognizer.onend();
        });
        await page.waitForTimeout(400);
        assert.strictEqual(await page.locator('[data-choice]').count(), 0, 'a transient no-speech error does not demote speech to buttons');
        assert(/say your guess/i.test(await page.locator('#say-line').innerText()), 'the microphone prompt survives a silent restart');
        assert.strictEqual(await page.locator('.say-prompt.is-listening').count(), 1, 'the prompt still reads as listening after a restart');

        await page.evaluate(() => {
          const canvas = document.getElementById('frozen-photo');
          window.__guessSnapshot = { canvas, width: canvas.width, height: canvas.height, choices: GhostCountTest.round.choices.slice() };
          window.__ghostCountRecognition.onerror({ error: 'not-allowed' });
        });
        await page.waitForSelector('[data-choice]');
        assert.strictEqual(await page.locator('[data-choice]').count(), 3, 'recognition failure injects three rescue buttons');
        assert(/speech unavailable/i.test(await page.locator('#say-line').innerText()), 'rescue explains that speech is unavailable');
        assert(/tap a number/i.test(await page.locator('#listening-state').innerText()), 'rescue prompts the learner to tap a number');
        const preserved = await page.evaluate(() => {
          const snapshot = window.__guessSnapshot;
          const canvas = document.getElementById('frozen-photo');
          return snapshot.canvas === canvas && canvas.isConnected && snapshot.width === canvas.width && snapshot.height === canvas.height &&
            GhostCountTest.round.guess === null && JSON.stringify(snapshot.choices) === JSON.stringify(GhostCountTest.round.choices);
        });
        assert(preserved, 'live rescue keeps the same guess screen, frozen photo, and round choices');
        await page.locator('[data-choice]').nth(round % 3).click();
      } else {
        await page.evaluate(index => GhostCountTest.choose(GhostCountTest.round.choices[index]), round % 3);
      }
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
      /* A bare skin rectangle is not a person to the detector - this fixture covers
         generic skin-blob avoidance. Person proximity and overlap are asserted
         against the classroom demo scene above. */
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
    await page.evaluate(() => GhostCountTest.choose(GhostCountTest.round.choices[0]));
    await finishCount(page);
    assert((await page.locator('.result-note').innerText()).startsWith('Ooh!'), 'a mismatch is framed as a cheerful surprise');
    assert(!/wrong|try again|mistake/i.test(await page.locator('body').innerText()), 'mismatch UI contains no failure language');

    const placementContext = await browser.newContext({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 1 });
    await installSpeechRecognitionStub(placementContext);
    const placementPage = await placementContext.newPage();
    placementPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    placementPage.on('pageerror', err => consoleErrors.push(err.stack || err.message));
    placementPage.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${port}/`)) externalRequests.push(request.url()); });
    await placementPage.goto(`http://127.0.0.1:${port}/?demo=1&test=1`, { waitUntil: 'networkidle' });
    await placementPage.click('#settings-btn');
    await placementPage.click('[data-setting="speechMode"][data-value="tap"]');
    assert.strictEqual(await placementPage.evaluate(() => GhostCountTest.state().settings.speechMode), 'tap', 'Tap only remains a deliberate teacher setting');
    await placementPage.click('#back-btn');
    await placementPage.click('#play-btn');
    for (const [index, filename] of ['placement-a.png', 'placement-b.png'].entries()) {
      await startRound(placementPage);
      assert.strictEqual(await placementPage.locator('[data-choice]').count(), 3, 'Tap only renders three clickable number buttons');
      const maxChoice = await placementPage.locator('[data-choice]').evaluateAll(buttons => Math.max(...buttons.map(button => Number(button.dataset.choice))));
      await placementPage.evaluate(() => GhostCountTest.forceLucky(1));
      await placementPage.locator(`[data-choice="${maxChoice}"]`).click();
      await waitScreen(placementPage, 'count');
      const sampleRound = await placementPage.evaluate(() => GhostCountTest.round);
      assertPlacementSpread(sampleRound.positions, `placement sample ${index + 1}`);
      if (index === 0) assert(sampleRound.personDetected, 'classroom placement sample exercises person behavior');
      else {
        assert(!sampleRound.personDetected, 'playground remains on the person-free placement path');
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
    console.log('SHOTS person-counting.png placement-a.png placement-b.png');
  } finally {
    await browser.close();
    await new Promise(resolve => local.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
