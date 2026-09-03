/* ============================================================
   GHOST COUNT — game loop and screen state machine
   ============================================================ */
'use strict';

const Game = (() => {
  const app = document.getElementById('app');
  const flash = document.getElementById('flash');
  const toastEl = document.getElementById('toast');
  const params = new URLSearchParams(location.search);
  const demoForced = params.get('demo') === '1';
  const testMode = params.get('test') === '1';
  const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  let screen = 'loading';
  let stream = null;
  let demoCanvas = null;
  let photoCanvas = null;
  let round = null;
  let timers = [];
  let toastTimer = 0;
  let demoIndex = 0;
  let forceLuckyRounds = 0;
  let forcedSurprise = null;
  let evolutionTimer = 0;

  function state() { return State.get(); }
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; clearTimeout(evolutionTimer); evolutionTimer = 0; }
  function esc(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
  function shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function word(n) { return numberWords[n] || String(n); }
  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function setScreen(name) { screen = name; app.dataset.screen = name; }
  function announce(text, options) {
    if (state().settings.tts !== false) Speech.speak(text, options);
  }
  function toast(text) {
    toastEl.textContent = text; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }
  function sparkleAround(el) {
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'spark'; s.textContent = i % 2 ? '✦' : '·';
      s.style.left = `${rect.left + rect.width / 2}px`; s.style.top = `${rect.top + rect.height / 2}px`;
      const a = Math.PI * 2 * i / 9;
      s.style.setProperty('--sx', `${Math.cos(a) * (45 + Math.random() * 28)}px`);
      s.style.setProperty('--sy', `${Math.sin(a) * (45 + Math.random() * 28)}px`);
      document.body.appendChild(s); later(() => s.remove(), 800);
    }
  }

  function stageSvg(stage, extra) {
    return Ghosts.svg(Object.assign({ stage, expression: 'bright', size: 240 }, extra || {}));
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  function discardPhoto() {
    photoCanvas = null;
    if (round) round.personCutout = null;
  }

  function showTitle() {
    clearTimers(); Speech.abortListening(); Speech.cancel(); Sfx.ambienceStop(); stopCamera(); discardPhoto(); setScreen('title');
    const s = state();
    app.innerHTML = `
      <section class="screen title-screen">
        <div class="title-orb"></div>
        <nav class="title-tools" aria-label="More">
          <button class="icon-btn" id="book-btn" aria-label="Open Ghost Book">▤</button>
          <button class="icon-btn" id="settings-btn" aria-label="Teacher settings">⚙</button>
        </nav>
        <div class="title-card">
          <p class="eyebrow">A supernatural camera game</p>
          <div class="title-ghost">${stageSvg(s.progress.stage || 1, { expression: 'cheeky' })}</div>
          <h1 class="title-logo">Ghost <span>Count!</span></h1>
          <p class="title-sub">Take a photo. Find the hidden ghosts.</p>
          <button class="btn btn-primary round-btn title-play" id="play-btn">OPEN GHOST CAMERA</button>
        </div>
      </section>`;
    document.getElementById('play-btn').onclick = () => { Sfx.unlock(); Sfx.chime(); showCamera(); };
    document.getElementById('book-btn').onclick = () => { Sfx.click(); showGhostbook(); };
    document.getElementById('settings-btn').onclick = () => { Sfx.click(); showTeacher(); };
  }

  function cameraMarkup(isDemo) {
    return `
      <section class="screen camera-screen">
        <div class="photo-stage" id="camera-stage">
          ${isDemo ? '<canvas id="demo-view" aria-label="Demo scene preview"></canvas>' : '<video id="camera-video" autoplay muted playsinline aria-label="Camera preview"></video>'}
        </div>
        <div class="ui-layer camera-hud">
          <div class="camera-top"><span class="mode-chip">${isDemo ? '✦ DEMO SCENE' : '● GHOST CAMERA'}</span></div>
          <div class="shutter-wrap">
            <button class="shutter" id="shutter" aria-label="Take photo">TAKE<br>PHOTO</button>
            <span class="camera-tip">Point at a place ghosts could hide!</span>
          </div>
        </div>
      </section>`;
  }

  async function showCamera() {
    clearTimers(); Speech.abortListening(); Speech.cancel(); Sfx.ambienceStop(); stopCamera(); discardPhoto(); demoCanvas = null; round = null;
    setScreen('camera');
    let useDemo = demoForced || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia;
    app.innerHTML = cameraMarkup(useDemo);
    if (!useDemo) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (screen !== 'camera') { stopCamera(); return; }
        const video = document.getElementById('camera-video');
        video.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        const facing = track.getSettings ? track.getSettings().facingMode : '';
        if (facing === 'user') video.classList.add('mirror');
      } catch (err) {
        stopCamera(); useDemo = true; app.innerHTML = cameraMarkup(true); toast('Camera unavailable — demo scene ready!');
      }
    }
    if (useDemo) {
      demoCanvas = document.getElementById('demo-view');
      const ratio = innerWidth / innerHeight;
      demoCanvas.width = Math.round(900 * Math.max(.72, Math.min(1.6, ratio)));
      demoCanvas.height = 900;
      Scene.drawDemo(demoCanvas, ['classroom', 'playground', 'desktop'][demoIndex % 3], demoIndex + 11);
      demoIndex++;
    }
    document.getElementById('shutter').onclick = takePhoto;
  }

  function copyCanvas(source) {
    const c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
    c.getContext('2d').drawImage(source, 0, 0); return c;
  }

  function takePhoto() {
    if (screen !== 'camera') return;
    Sfx.shutter(); flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    if (demoCanvas) photoCanvas = copyCanvas(demoCanvas);
    else {
      const video = document.getElementById('camera-video');
      if (!video || !video.videoWidth) { toast('Camera is warming up…'); return; }
      photoCanvas = document.createElement('canvas');
      photoCanvas.width = video.videoWidth; photoCanvas.height = video.videoHeight;
      const ctx = photoCanvas.getContext('2d');
      if (video.classList.contains('mirror')) { ctx.translate(photoCanvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0);
    }
    stopCamera(); later(showGuess, 260);
  }

  function choicesFor(max) {
    const all = [];
    for (let a = 1; a <= max - 2; a++) for (let b = a + 1; b <= max - 1; b++) for (let c = b + 1; c <= max; c++) {
      all.push({ vals: [a,b,c], score: Math.min(b-a,c-b) * 4 + (c-a) + Math.random() * 2 });
    }
    all.sort((x,y) => y.score - x.score);
    const pool = all.slice(0, Math.max(1, Math.ceil(all.length * .3)));
    return shuffle(pool[Math.floor(Math.random() * pool.length)].vals);
  }

  function photoStageMarkup(extraClass) {
    return `<div class="photo-stage ${extraClass || ''}" id="photo-stage"><canvas class="frozen-photo" id="frozen-photo"></canvas><div class="reveal-mist"></div><div class="ghost-layer" id="ghost-layer"></div><canvas class="person-cutout" id="person-cutout" aria-hidden="true"></canvas></div>`;
  }
  function paintFrozen() {
    const dest = document.getElementById('frozen-photo');
    if (!dest || !photoCanvas) return;
    dest.width = photoCanvas.width; dest.height = photoCanvas.height;
    dest.getContext('2d').drawImage(photoCanvas, 0, 0);
  }

  function paintPersonCutout() {
    const dest = document.getElementById('person-cutout');
    const cutout = round && round.personCutout;
    if (!dest || !cutout || !photoCanvas) return;
    dest.width = photoCanvas.width; dest.height = photoCanvas.height;
    const ctx = dest.getContext('2d');
    ctx.clearRect(0, 0, dest.width, dest.height);
    try {
      const image = cutout.canvas || cutout.imageData || cutout;
      if (typeof ImageData !== 'undefined' && image instanceof ImageData) {
        const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
        source.getContext('2d').putImageData(image, 0, 0);
        ctx.drawImage(source, 0, 0, dest.width, dest.height);
      } else ctx.drawImage(image, 0, 0, dest.width, dest.height);
      dest.classList.add('has-person');
    } catch (error) {
      ctx.clearRect(0, 0, dest.width, dest.height);
    }
  }

  function alignGhostLayer() {
    const stage = document.getElementById('photo-stage');
    const layer = document.getElementById('ghost-layer');
    if (!stage || !layer || !photoCanvas) return;
    if (!round || !round.personDetected) {
      layer.style.width = '100%'; layer.style.height = '100%';
      layer.style.left = '0'; layer.style.top = '0';
      return;
    }
    const scale = Math.max(stage.clientWidth / photoCanvas.width, stage.clientHeight / photoCanvas.height);
    const width = photoCanvas.width * scale, height = photoCanvas.height * scale;
    layer.style.width = `${width}px`; layer.style.height = `${height}px`;
    layer.style.left = `${(stage.clientWidth - width) / 2}px`;
    layer.style.top = `${(stage.clientHeight - height) / 2}px`;
  }

  function visiblePhotoRect() {
    const stage = document.getElementById('photo-stage');
    if (!stage || !photoCanvas) return null;
    const sourceAspect = photoCanvas.width / photoCanvas.height;
    const stageAspect = stage.clientWidth / stage.clientHeight;
    if (sourceAspect > stageAspect) {
      const width = stageAspect / sourceAspect;
      return { x: (1 - width) / 2, y: 0, width, height: 1 };
    }
    const height = sourceAspect / stageAspect;
    return { x: 0, y: (1 - height) / 2, width: 1, height };
  }

  function showGuess() {
    clearTimers(); setScreen('guess');
    const rangeValue = state().settings.range || '1-6';
    const max = Number(String(rangeValue).split('-').pop()) || 6;
    const choices = choicesFor(max);
    const speechReady = state().settings.speechMode !== 'tap' && Speech.supported();
    round = { choices, guess: null, total: null, counted: 0, positions: [], surprise: null, correct: false, stage: state().progress.stage || 1 };
    app.innerHTML = `
      <section class="screen">
        ${photoStageMarkup('')}
        <div class="ui-layer game-hud">
          <div class="question-box"><div class="question">HOW MANY GHOSTS?</div><div class="feedback-line" id="feedback"></div></div>
          <div class="guess-panel">
            <div class="say-prompt ${speechReady ? 'is-listening' : ''}" id="speech-prompt">
              <span class="mic-orb" aria-hidden="true"><span class="mic-icon">🎤</span><span class="mic-live" id="mic-dot"></span></span>
              <span class="say-copy"><b id="say-line">Say your guess!</b><small id="listening-state">${speechReady ? 'Listening…' : 'Tap is ready too'}</small></span>
            </div>
            <div class="choice-label">or tap a number</div>
            <div class="choices">${choices.map(n => `<button class="btn number-btn" data-choice="${n}" aria-label="${word(n)}">${n}</button>`).join('')}</div>
          </div>
        </div>
      </section>`;
    paintFrozen();
    document.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = () => chooseGuess(Number(btn.dataset.choice), btn, 'tap'));
    announce('How many ghosts?');
    if (speechReady) {
      Speech.startListening({
        tier: state().settings.difficulty || 'number',
        onNumber(n) {
          if (screen === 'guess' && round.guess === null && round.choices.includes(n)) chooseGuess(n, document.querySelector(`[data-choice="${n}"]`), 'speech');
        },
        onUnavailable() {
          const prompt = document.getElementById('speech-prompt');
          const status = document.getElementById('listening-state');
          if (prompt) prompt.classList.remove('is-listening');
          if (status) status.textContent = 'Tap a number anytime';
        }
      });
    }
  }

  function decideTotal(guess) {
    if (forceLuckyRounds > 0) { forceLuckyRounds--; return guess; }
    const streak = Math.max(0, Math.min(2, state().progress.streak || 0));
    const lucky = Math.random() < [.5, .65, .85][streak];
    if (lucky) return guess;
    const others = round.choices.filter(n => n !== guess);
    return others[Math.floor(Math.random() * others.length)];
  }

  function chooseGuess(n, btn, source) {
    if (screen !== 'guess' || round.guess !== null || !round.choices.includes(n)) return;
    round.guess = n; round.total = decideTotal(n); round.correct = round.total === n;
    Speech.abortListening();
    document.querySelectorAll('[data-choice]').forEach(el => { el.disabled = true; });
    if (btn) { btn.classList.add('chosen'); sparkleAround(btn); }
    document.getElementById('feedback').textContent = `${titleCase(word(n))}? Let's see!`;
    document.getElementById('say-line').textContent = source === 'speech' ? 'Great speaking!' : 'Great guess!';
    const speechPrompt = document.getElementById('speech-prompt');
    const listeningState = document.getElementById('listening-state');
    if (speechPrompt) speechPrompt.classList.remove('is-listening');
    if (listeningState) listeningState.textContent = source === 'speech' ? 'I heard you!' : 'Guess received!';
    Sfx.sparkle(); announce(`${titleCase(word(n))}? Let's see!`);
    later(startReveal, 850);
  }

  function chooseSurprise() {
    if (forcedSurprise) { const value = forcedSurprise; forcedSurprise = null; return value; }
    if (Math.random() >= .18) return null;
    return ['vanish', 'tiny', 'large', 'peek'][Math.floor(Math.random() * 4)];
  }

  async function startReveal() {
    if (!round || !photoCanvas) return;
    clearTimers(); setScreen('reveal'); round.surprise = chooseSurprise();
    app.innerHTML = `<section class="screen">${photoStageMarkup('haunted')}<div class="reveal-caption"><span class="prompt-chip">Something is here…</span></div></section>`;
    paintFrozen(); Sfx.ambienceStart();
    const count = round.total;
    try {
      const options = { count, seed: Date.now() % 100000, visibleRect: visiblePhotoRect() };
      const analysis = typeof Scene.analyzeDetailed === 'function'
        ? await Scene.analyzeDetailed(photoCanvas, options)
        : await Scene.analyze(photoCanvas, options);
      round.positions = Array.isArray(analysis) ? analysis : analysis.positions;
      round.personDetected = !Array.isArray(analysis) && analysis.personDetected === true;
      round.personBounds = !Array.isArray(analysis) ? analysis.personBounds : null;
      round.proximityBand = !Array.isArray(analysis) ? analysis.proximityBand : 0;
      round.personCutout = Array.isArray(analysis) ? null : (analysis.personCutout || analysis.cutoutCanvas || null);
      if (!round.personCutout && typeof Scene.createPersonCutout === 'function') {
        try { round.personCutout = await Scene.createPersonCutout(photoCanvas, Array.isArray(analysis) ? null : analysis); }
        catch (cutoutError) { round.personCutout = null; }
      }
    }
    catch (err) { round.positions = Scene.fallbackPositions(count, Date.now() % 100000); round.personDetected = false; round.personBounds = null; round.proximityBand = 0; }
    if (screen !== 'reveal') return;
    paintPersonCutout();
    if (round.surprise === 'tiny' && round.positions[0]) round.positions[0].scale = .35;
    if (round.surprise === 'large' && round.positions[0]) round.positions[0].scale = 1.7;
    renderGhosts(round.positions, round.surprise === 'vanish');
    later(() => document.querySelector('.reveal-caption').classList.add('show'), 220);
    const all = Array.from(document.querySelectorAll('.ghost-target'));
    all.forEach((el, i) => later(() => el.classList.add('materialize'), 430 + i * 330));
    const fake = document.querySelector('.ghost-target.fake');
    const lastAt = 430 + (all.length - 1) * 330 + 850;
    if (fake) later(() => fake.classList.add('vanish'), lastAt + 280);
    later(beginCounting, lastAt + (fake ? 950 : 420));
  }

  function ghostButton(pos, index, fake) {
    const scale = Math.max(.3, Math.min(1.75, Number(pos.scale) || 1));
    const rot = `${Number(pos.rotation || 0).toFixed(1)}deg`;
    const classes = `ghost-target${fake ? ' fake' : ''}${pos.x > .55 ? ' badge-left' : ''}${pos.behind || pos.behindPerson ? ' behind-person' : ''}${round.surprise === 'peek' && index === 0 ? ' peeker' : ''}`;
    const badgeGap = scale < .5 ? 48 : 18;
    const badgeOut = (-28 - badgeGap / scale).toFixed(1);
    return `<button class="${classes}" data-ghost="${index}" ${fake ? 'data-fake="1"' : ''} aria-label="Hidden ghost" style="left:${(pos.x*100).toFixed(2)}%;top:${(pos.y*100).toFixed(2)}%;--scale:${scale};--badge-scale:${(1 / scale).toFixed(3)};--badge-out:${badgeOut}px;--rot:${rot};--float-y:${8 + index%3*3}px;--float-dur:${2.8 + index%4*.45}s;--delay:${-index*.27}s">${Ghosts.svg({ stage: round.stage, flip: !!pos.flip, expression: ['cheeky','bright','sleepy'][index%3], hueJitter: (index%5-2)*5 })}<span class="count-badge"></span></button>`;
  }

  function renderGhosts(positions, addFake) {
    alignGhostLayer();
    const list = positions.map((p, i) => ghostButton(p, i, false));
    if (addFake) {
      const fp = Scene.fallbackPositions(1, 991 + round.total)[0];
      list.splice(Math.min(1, list.length), 0, ghostButton(fp, positions.length, true));
    }
    document.getElementById('ghost-layer').innerHTML = list.join('');
  }

  function beginCounting() {
    if (screen !== 'reveal') return;
    setScreen('count'); Sfx.ambienceStop(); Sfx.whoosh();
    const stage = document.getElementById('photo-stage'); stage.classList.add('count-ready');
    const revealCaption = document.querySelector('.reveal-caption'); if (revealCaption) revealCaption.remove();
    const fake = document.querySelector('.ghost-target.fake'); if (fake) fake.remove();
    document.querySelectorAll('.ghost-target').forEach(el => { el.classList.add('ready'); el.onclick = () => countGhost(el); });
    const caption = document.createElement('div'); caption.className = 'count-caption'; caption.innerHTML = '<span class="prompt-chip">Count the ghosts!</span>';
    app.querySelector('.screen').appendChild(caption); announce('Count the ghosts!');
  }

  function countGhost(el) {
    if (screen !== 'count' || el.dataset.counted === '1' || el.dataset.fake === '1') return;
    el.dataset.counted = '1'; el.classList.add('counted', 'pop'); el.disabled = true;
    round.counted++;
    el.querySelector('.count-badge').textContent = round.counted;
    Sfx.count(round.counted); announce(`${titleCase(word(round.counted))}!`, { interrupt: true });
    if (round.counted === round.total) later(showResult, 520);
  }

  function recordResult(correct) {
    if (typeof State.recordGuess === 'function') return State.recordGuess(correct);
    return State.update(s => { s.progress.streak = correct ? Math.min(3, (s.progress.streak || 0) + 1) : 0; return s; });
  }

  function showResult() {
    if (screen !== 'count') return;
    setScreen('result');
    const countCaption = document.querySelector('.count-caption'); if (countCaption) countCaption.remove();
    document.getElementById('photo-stage').classList.add('resulting');
    const after = recordResult(round.correct) || state();
    const streak = (after.progress || state().progress).streak || 0;
    round.shouldEvolve = after.shouldEvolve === true || (round.correct && streak >= 3 && (state().progress.stage || 1) < 3);
    const totalLine = `${round.total} ${round.total === 1 ? 'GHOST' : 'GHOSTS'}!`;
    const note = round.correct ? 'Lucky guess!' : `Ooh! There ${round.total === 1 ? 'was' : 'were'} ${word(round.total)}!`;
    const overlay = document.createElement('div'); overlay.className = 'result-overlay';
    overlay.innerHTML = `<div class="result-card"><div class="result-kicker">${round.correct ? '✦ AMAZING! ✦' : '✦ SURPRISE! ✦'}</div><h2 class="result-total">${totalLine}</h2><p class="result-note">${esc(note)}</p><div class="streak" aria-label="${streak} of 3 lucky guesses">${[0,1,2].map(i => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')}</div><button class="btn btn-primary round-btn" id="again-btn">${round.shouldEvolve ? 'SEE EVOLUTION!' : 'TAKE ANOTHER PHOTO'}</button></div>`;
    app.querySelector('.screen').appendChild(overlay);
    Sfx.result(); announce(`${titleCase(word(round.total))} ${round.total === 1 ? 'ghost' : 'ghosts'}!`);
    if (!round.correct) later(() => announce(note), 1100);
    document.getElementById('again-btn').onclick = () => round.shouldEvolve ? showEvolution() : showCamera();
    if (round.shouldEvolve) evolutionTimer = setTimeout(showEvolution, testMode ? 1600 : 2400);
  }

  function doEvolve() {
    if (round && round.evolved) return state();
    if (round) round.evolved = true;
    if (typeof State.evolve === 'function') return State.evolve();
    return State.update(s => { s.progress.stage = Math.min(3, (s.progress.stage || 1) + 1); s.progress.streak = 0; return s; });
  }

  function showEvolution() {
    clearTimeout(evolutionTimer); evolutionTimer = 0;
    if (!round || !round.shouldEvolve) return;
    clearTimers(); Speech.cancel(); setScreen('evolution');
    const evolved = doEvolve() || state();
    const stage = (evolved.progress || state().progress).stage || 2;
    const info = (typeof DATA !== 'undefined' && DATA.getStage) ? DATA.getStage('family-01', stage) : null;
    const name = info ? info.name : ['','NOKO','NOKORO','NOKOMARU'][stage];
    const particles = Array.from({length:22}, (_,i) => `<i class="particle" style="--pa:${i*16.36}deg;--pd:${-(i%7)*.23}s"></i>`).join('');
    app.innerHTML = `<section class="screen evolution-screen" id="evolution-screen"><div class="evo-vortex"></div><div class="evo-fog"></div>${particles}<div class="evo-ghost">${stageSvg(stage, { expression: 'bright' })}</div><div class="evo-copy"><p class="eyebrow">Your ghost is changing…</p><h1 class="evo-title">EVOLUTION!</h1><p class="evo-name">Meet ${esc(name)}!</p><p class="evo-skip">Tap to continue</p></div></section>`;
    Sfx.evolution(); announce(`Evolution! Meet ${name}!`);
    const finish = () => { if (screen === 'evolution') showCamera(); };
    document.getElementById('evolution-screen').onclick = finish;
    evolutionTimer = setTimeout(finish, 6200);
  }

  function showGhostbook() {
    clearTimers(); Speech.cancel(); setScreen('ghostbook');
    const s = state(); const discovered = s.progress.discovered || { family01: s.progress.stage || 1 };
    const families = (DATA.FAMILIES || []).map((family, fi) => {
      const shortId = String(family.number || fi + 1).padStart(2, '0');
      const unlocked = fi === 0 || (s.progress.unlockedFamilies || []).includes(shortId);
      const discoveredEntry = discovered[shortId];
      const seen = Array.isArray(discoveredEntry) ? discoveredEntry.filter(Boolean).length : (fi === 0 ? s.progress.stage : 0);
      return `<article class="family-row"><div class="family-meta"><div><div class="family-name">GHOST ${shortId}</div><div class="family-theme">${esc(family.name || '')}</div></div><span class="eyebrow">${unlocked ? 'DISCOVERED' : 'MYSTERY'}</span></div><div class="stage-row">${family.stages.map((st, i) => {
        const known = unlocked && i < seen && fi === 0;
        const art = fi === 0 ? Ghosts.svg({ stage:i+1, expression:'bright' }) : Ghosts.silhouette ? Ghosts.silhouette() : '?';
        return `${i ? '<span class="arrow">→</span>' : ''}<div class="stage-card ${known ? '' : 'locked'}"><div class="ghost-book-art">${art}</div><strong>${known ? esc(st.name) : '?'}</strong></div>`;
      }).join('')}</div></article>`;
    }).join('');
    app.innerHTML = `<section class="screen panel-screen"><div class="panel-shell"><header class="panel-head"><div><p class="eyebrow">Collection</p><h1>Ghost Book</h1></div><button class="icon-btn" id="back-btn" aria-label="Back">←</button></header><div class="book-list">${families}</div></div></section>`;
    document.getElementById('back-btn').onclick = showTitle;
  }

  function updateSetting(key, value) {
    if (typeof State.setSetting === 'function') State.setSetting(key, value);
    else State.update(s => { s.settings[key] = value; return s; });
    if (key === 'volume') Sfx.setVolume(Number(value));
    showTeacher();
  }

  function showTeacher() {
    clearTimers(); Speech.cancel(); setScreen('teacher'); const s = state();
    const seg = (key, options) => `<div class="segmented">${options.map(([value,label]) => `<button data-setting="${key}" data-value="${value}" class="${String(s.settings[key]) === String(value) ? 'active' : ''}">${label}</button>`).join('')}</div>`;
    app.innerHTML = `<section class="screen panel-screen"><div class="panel-shell"><header class="panel-head"><div><p class="eyebrow">Grown-ups</p><h1>Teacher Settings</h1></div><button class="icon-btn" id="back-btn" aria-label="Back">←</button></header><div class="settings-card">
      <div class="setting"><div class="setting-label"><span>Number range</span><span>${String(s.settings.range).replace('-', '–')}</span></div>${seg('range', [['1-5','1–5'],['1-6','1–6'],['1-10','1–10']])}</div>
      <div class="setting"><div class="setting-label"><span>Answer input</span></div>${seg('speechMode', [['stt','Speech preferred'],['tap','Tap only']])}</div>
      <div class="setting"><div class="setting-label"><span>Spoken prompts</span></div>${seg('tts', [[true,'On'],[false,'Off']])}</div>
      <div class="setting"><label class="setting-label" for="volume"><span>Sound volume</span><span>${Math.round((s.settings.volume ?? .8)*100)}%</span></label><input id="volume" type="range" min="0" max="1" step=".05" value="${s.settings.volume ?? .8}"></div>
      <div class="setting"><button class="btn danger" id="reset-btn">RESET GHOST PROGRESS</button></div>
    </div><p class="privacy-note">Privacy: photos stay on this device, are never saved, and disappear after each round. Progress and these settings are stored locally.</p></div></section>`;
    document.getElementById('back-btn').onclick = showTitle;
    document.querySelectorAll('[data-setting]').forEach(el => el.onclick = () => {
      let value = el.dataset.value; if (value === 'true') value = true; else if (value === 'false') value = false; else if (/^\d+$/.test(value)) value = Number(value);
      updateSetting(el.dataset.setting, value);
    });
    document.getElementById('volume').onchange = e => updateSetting('volume', Number(e.target.value));
    const reset = document.getElementById('reset-btn');
    reset.onclick = () => {
      if (reset.dataset.armed !== '1') { reset.dataset.armed = '1'; reset.textContent = 'TAP AGAIN TO RESET'; return; }
      State.resetProgress(); toast('Ghost progress reset'); showTeacher();
    };
  }

  function init() {
    State.load(); const s = state(); Sfx.setVolume(Number(s.settings.volume ?? .8));
    window.addEventListener('pagehide', () => { stopCamera(); Speech.abortListening(); });
    window.addEventListener('resize', alignGhostLayer);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { Speech.abortListening(); Sfx.ambienceStop(); } });
    showTitle();
    if (testMode || demoForced) {
      window.GhostCountTest = {
        get screen() { return screen; },
        get round() { return round ? {
          choices: round.choices && round.choices.slice(), guess: round.guess, total: round.total, counted: round.counted,
          surprise: round.surprise, shouldEvolve: !!round.shouldEvolve, personDetected: !!round.personDetected,
          personBounds: round.personBounds ? { x:round.personBounds.x, y:round.personBounds.y, width:round.personBounds.width, height:round.personBounds.height } : null,
          proximityBand: round.proximityBand || 0,
          positions: (round.positions || []).map(p => ({
            x:p.x, y:p.y, scale:p.scale, nearPerson:!!p.nearPerson, behind:!!(p.behind || p.behindPerson),
            personOverlap:Number(p.personOverlap || 0), faceOverlap:Number(p.faceOverlap || 0),
            personDistance:Number.isFinite(p.personDistance) ? p.personDistance : null,
          }))
        } : null; },
        forceLucky(count) { forceLuckyRounds = Math.max(0, Number(count) || 1); },
        forceSurprise(type) { forcedSurprise = type; },
        showCamera, showTitle,
        choose(n) { const el = document.querySelector(`[data-choice="${n}"]`); if (el) el.click(); },
        tapAll() { document.querySelectorAll('.ghost-target.ready:not(.counted)').forEach(el => el.click()); },
        state() { return JSON.parse(JSON.stringify(state())); }
      };
    }
  }

  return { init, showTitle, showCamera };
})();

Game.init();
