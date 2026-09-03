/* ============================================================
   GHOST COUNT — demo scenes + camera-frame placement analysis
   Creates offline backgrounds and finds quiet, person-safe places.
   ============================================================ */
'use strict';

const Scene = (() => {
  const WORK_LONG_EDGE = 96;
  const COMPOSITE_LONG_EDGE = 256;
  const DEMO_NAMES = ['classroom', 'playground', 'desktop'];
  const demoSources = typeof WeakMap === 'function' ? new WeakMap() : null;
  let demoIndex = 0;

  function hashSeed(value) {
    const text = String(value == null ? Date.now() : value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomFrom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return () => {
      state += 0x6d2b79f5;
      let n = state;
      n = Math.imul(n ^ (n >>> 15), n | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function fillRound(ctx, x, y, width, height, radius, fill) {
    roundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function seededSpeckles(ctx, width, height, random, color, count) {
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const r = 0.4 + random() * 1.7;
      ctx.globalAlpha = 0.08 + random() * 0.11;
      ctx.beginPath();
      ctx.arc(random() * width, random() * height, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawClassroom(ctx, width, height, random) {
    const horizon = height * 0.63;
    const wall = ctx.createLinearGradient(0, 0, 0, horizon);
    wall.addColorStop(0, '#b8d9dc');
    wall.addColorStop(1, '#d3e2e0');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, horizon);
    ctx.fillStyle = '#596477';
    ctx.fillRect(0, horizon, width, height - horizon);
    for (let y = horizon; y < height; y += Math.max(18, height * 0.065)) {
      ctx.fillStyle = y % 2 ? 'rgba(255,255,255,.035)' : 'rgba(41,25,30,.035)';
      ctx.fillRect(0, y, width, 2);
    }

    const boardX = width * 0.1, boardY = height * 0.1;
    const boardW = width * 0.8, boardH = height * 0.29;
    ctx.shadowColor = 'rgba(24,35,47,.28)';
    ctx.shadowBlur = width * 0.018;
    fillRound(ctx, boardX, boardY, boardW, boardH, width * 0.012, '#315b55');
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#afd4dc';
    ctx.lineWidth = Math.max(5, width * 0.012);
    roundedRect(ctx, boardX, boardY, boardW, boardH, width * 0.012);
    ctx.stroke();
    ctx.fillStyle = 'rgba(235,247,229,.7)';
    ctx.font = `600 ${Math.max(17, width * 0.045)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HELLO!', width * 0.5, boardY + boardH * 0.58);
    ctx.lineWidth = Math.max(2, width * 0.005);
    ctx.strokeStyle = 'rgba(235,247,229,.55)';
    ctx.beginPath();
    ctx.moveTo(width * 0.38, boardY + boardH * 0.72);
    ctx.quadraticCurveTo(width * 0.5, boardY + boardH * 0.77, width * 0.62, boardY + boardH * 0.71);
    ctx.stroke();

    const windowX = width * 0.04, windowY = height * 0.43;
    ctx.fillStyle = '#7fcbd5';
    ctx.fillRect(windowX, windowY, width * 0.22, height * 0.16);
    ctx.fillStyle = '#f6d768';
    ctx.beginPath();
    ctx.arc(windowX + width * 0.055, windowY + height * 0.04, width * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f7f1dc';
    ctx.lineWidth = Math.max(3, width * 0.008);
    ctx.strokeRect(windowX, windowY, width * 0.22, height * 0.16);
    ctx.beginPath();
    ctx.moveTo(windowX + width * 0.11, windowY);
    ctx.lineTo(windowX + width * 0.11, windowY + height * 0.16);
    ctx.stroke();

    const deskY = height * 0.67;
    for (let row = 0; row < 2; row++) {
      const y = deskY + row * height * 0.16;
      for (let col = 0; col < 3; col++) {
        const x = width * (0.08 + col * 0.31) + (row ? width * 0.035 : 0);
        ctx.fillStyle = '#39455d';
        ctx.fillRect(x + width * 0.025, y + height * 0.035, width * 0.018, height * 0.14);
        ctx.fillRect(x + width * 0.19, y + height * 0.035, width * 0.018, height * 0.14);
        const wood = ctx.createLinearGradient(x, y, x, y + height * 0.05);
        wood.addColorStop(0, '#74a9c2');
        wood.addColorStop(1, '#526f9e');
        fillRound(ctx, x, y, width * 0.23, height * 0.058, width * 0.012, wood);
        ctx.fillStyle = ['#ef7181', '#617dd2', '#67a978'][(row + col) % 3];
        ctx.fillRect(x + width * (0.05 + random() * 0.04), y - height * 0.012, width * 0.095, height * 0.012);
      }
    }

    /* A deliberately simple demo pupil. The exposed head is kept separate
       from the clothes so the same local skin-mask path used for camera
       photos can discover it; the front desk provides a natural depth cue. */
    const personX = width * 0.7;
    const headY = height * 0.48;
    ctx.save();
    ctx.fillStyle = '#27334d';
    ctx.fillRect(personX - width * 0.034, height * 0.67, width * 0.026, height * 0.18);
    ctx.fillRect(personX + width * 0.008, height * 0.67, width * 0.026, height * 0.18);
    ctx.fillStyle = '#e56f82';
    ctx.beginPath();
    ctx.moveTo(personX - width * 0.067, height * 0.535);
    ctx.quadraticCurveTo(personX, height * 0.505, personX + width * 0.067, height * 0.535);
    ctx.lineTo(personX + width * 0.053, height * 0.7);
    ctx.lineTo(personX - width * 0.053, height * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d69a78';
    ctx.lineWidth = Math.max(8, width * 0.024);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(personX - width * 0.052, height * 0.55);
    ctx.lineTo(personX - width * 0.09, height * 0.665);
    ctx.moveTo(personX + width * 0.052, height * 0.55);
    ctx.lineTo(personX + width * 0.094, height * 0.63);
    ctx.stroke();
    ctx.fillStyle = '#d69a78';
    ctx.beginPath();
    ctx.arc(personX, headY, width * 0.047, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#30364e';
    ctx.beginPath();
    ctx.arc(personX, headY - width * 0.012, width * 0.049, Math.PI * 1.03, Math.PI * 1.97);
    ctx.quadraticCurveTo(personX + width * 0.015, headY - width * 0.052, personX + width * 0.044, headY - width * 0.006);
    ctx.fill();
    ctx.fillStyle = '#26304a';
    ctx.beginPath();
    ctx.arc(personX - width * 0.017, headY + width * 0.005, width * 0.004, 0, Math.PI * 2);
    ctx.arc(personX + width * 0.017, headY + width * 0.005, width * 0.004, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    seededSpeckles(ctx, width, height, random, '#ffffff', 90);
  }

  function drawPlayground(ctx, width, height, random) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#76c7e8');
    sky.addColorStop(0.56, '#c9eae4');
    sky.addColorStop(0.57, '#82bd68');
    sky.addColorStop(1, '#477c4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,.76)';
    [[0.12, 0.13, 0.19], [0.62, 0.21, 0.25]].forEach(cloud => {
      const x = cloud[0] * width, y = cloud[1] * height, size = cloud[2] * width;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + i * size * 0.2, y + Math.sin(i) * size * 0.055, size * (0.18 + i * 0.012), 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.fillStyle = '#507048';
    for (let x = 0; x < width; x += width * 0.12) {
      const treeH = height * (0.16 + random() * 0.1);
      ctx.fillStyle = '#526273';
      ctx.fillRect(x + width * 0.045, height * 0.51 - treeH * 0.32, width * 0.025, treeH * 0.7);
      ctx.fillStyle = random() > 0.5 ? '#4b8552' : '#5b974f';
      ctx.beginPath();
      ctx.arc(x + width * 0.055, height * 0.49 - treeH * 0.3, width * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#6eaa74';
    ctx.beginPath();
    ctx.ellipse(width * 0.49, height * 0.84, width * 0.37, height * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e64f63';
    ctx.lineWidth = Math.max(7, width * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height * 0.72);
    ctx.lineTo(width * 0.15, height * 0.48);
    ctx.lineTo(width * 0.4, height * 0.48);
    ctx.lineTo(width * 0.4, height * 0.72);
    ctx.stroke();
    ctx.strokeStyle = '#f7d96e';
    ctx.lineWidth = Math.max(5, width * 0.014);
    for (let i = 0; i < 4; i++) {
      const x = width * (0.2 + i * 0.052);
      ctx.beginPath();
      ctx.moveTo(x, height * 0.5);
      ctx.lineTo(x, height * 0.66);
      ctx.stroke();
    }
    ctx.fillStyle = '#f1c44d';
    ctx.beginPath();
    ctx.moveTo(width * 0.66, height * 0.46);
    ctx.lineTo(width * 0.9, height * 0.75);
    ctx.lineTo(width * 0.77, height * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5f69c6';
    ctx.fillRect(width * 0.66, height * 0.43, width * 0.14, height * 0.055);
    seededSpeckles(ctx, width, height, random, '#f8edc7', 120);
  }

  function drawDesktop(ctx, width, height, random) {
    const desk = ctx.createLinearGradient(0, 0, width, height);
    desk.addColorStop(0, '#426e82');
    desk.addColorStop(0.5, '#355670');
    desk.addColorStop(1, '#293b5b');
    ctx.fillStyle = desk;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(18,39,62,.24)';
    ctx.lineWidth = Math.max(1, width * 0.004);
    for (let y = 0; y < height; y += height * 0.055) {
      ctx.beginPath();
      ctx.moveTo(0, y + random() * 8);
      ctx.bezierCurveTo(width * 0.3, y - 8, width * 0.65, y + 13, width, y + random() * 8);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(width * 0.48, height * 0.43);
    ctx.rotate(-0.06);
    ctx.shadowColor = 'rgba(28,18,28,.34)';
    ctx.shadowBlur = width * 0.03;
    fillRound(ctx, -width * 0.28, -height * 0.28, width * 0.56, height * 0.57, width * 0.018, '#e4f1ee');
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#86b3c4';
    ctx.lineWidth = Math.max(2, width * 0.004);
    for (let y = -height * 0.2; y < height * 0.22; y += height * 0.05) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.23, y);
      ctx.lineTo(width * 0.23, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#596985';
    ctx.font = `700 ${Math.max(15, width * 0.04)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('1  2  3', 0, -height * 0.105);
    ctx.restore();

    ctx.save();
    ctx.translate(width * 0.79, height * 0.25);
    ctx.rotate(0.12);
    fillRound(ctx, -width * 0.065, -height * 0.16, width * 0.13, height * 0.32, width * 0.018, '#e5cb58');
    fillRound(ctx, -width * 0.052, -height * 0.145, width * 0.104, height * 0.055, width * 0.01, '#f4edba');
    ctx.restore();
    ctx.fillStyle = '#477d70';
    ctx.beginPath();
    ctx.arc(width * 0.13, height * 0.8, width * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9e3d2';
    ctx.beginPath();
    ctx.arc(width * 0.13, height * 0.8, width * 0.072, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a4b1a5';
    ctx.lineWidth = Math.max(2, width * 0.005);
    ctx.beginPath();
    ctx.moveTo(width * 0.13, height * 0.8);
    ctx.lineTo(width * 0.13, height * 0.755);
    ctx.moveTo(width * 0.13, height * 0.8);
    ctx.lineTo(width * 0.17, height * 0.82);
    ctx.stroke();
    seededSpeckles(ctx, width, height, random, '#ffd7a2', 100);
  }

  function drawDemo(canvas, name, seed) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('Scene.drawDemo needs a canvas.');
    if (!canvas.width) canvas.width = 720;
    if (!canvas.height) canvas.height = 1280;
    const sceneName = DEMO_NAMES.includes(name) ? name : DEMO_NAMES[demoIndex % DEMO_NAMES.length];
    const actualSeed = seed == null ? `${sceneName}-${Date.now()}` : seed;
    const random = randomFrom(actualSeed);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (sceneName === 'classroom') drawClassroom(ctx, canvas.width, canvas.height, random);
    if (sceneName === 'playground') drawPlayground(ctx, canvas.width, canvas.height, random);
    if (sceneName === 'desktop') drawDesktop(ctx, canvas.width, canvas.height, random);
    const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, 'rgba(17,31,59,.08)');
    shade.addColorStop(0.52, 'rgba(255,244,214,0)');
    shade.addColorStop(1, 'rgba(22,17,38,.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (demoSources) demoSources.set(canvas, sceneName);
    return { name: sceneName, seed: actualSeed };
  }

  function nextDemo(canvas, seed) {
    const name = DEMO_NAMES[demoIndex % DEMO_NAMES.length];
    demoIndex = (demoIndex + 1) % DEMO_NAMES.length;
    return drawDemo(canvas, name, seed);
  }

  function copyFrame(source, canvas) {
    if (!source || !canvas || typeof canvas.getContext !== 'function') return false;
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
    if (!sourceWidth || !sourceHeight) return false;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return true;
  }

  function sourcePixels(source) {
    if (source && source.data && source.width && source.height) {
      return { data: source.data, width: source.width, height: source.height };
    }
    if (!source || typeof document === 'undefined') throw new TypeError('Scene analyzer needs a canvas, image, video, or ImageData.');
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
    if (!sourceWidth || !sourceHeight) throw new Error('The source frame has no pixels yet.');
    const scale = WORK_LONG_EDGE / Math.max(sourceWidth, sourceHeight);
    const width = Math.max(24, Math.round(sourceWidth * scale));
    const height = Math.max(24, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height };
  }

  function resizePixels(input) {
    if (Math.max(input.width, input.height) <= WORK_LONG_EDGE) return input;
    const scale = WORK_LONG_EDGE / Math.max(input.width, input.height);
    const width = Math.max(24, Math.round(input.width * scale));
    const height = Math.max(24, Math.round(input.height * scale));
    const output = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const sourceY = Math.min(input.height - 1, Math.floor(y / scale));
      for (let x = 0; x < width; x++) {
        const sourceX = Math.min(input.width - 1, Math.floor(x / scale));
        const si = (sourceY * input.width + sourceX) * 4;
        const di = (y * width + x) * 4;
        output[di] = input.data[si];
        output[di + 1] = input.data[si + 1];
        output[di + 2] = input.data[si + 2];
        output[di + 3] = input.data[si + 3] == null ? 255 : input.data[si + 3];
      }
    }
    return { data: output, width, height };
  }

  function pixelsAtLongEdge(source, longEdge) {
    if (!source) throw new TypeError('Scene analyzer needs a source frame.');
    if (source.data && source.width && source.height) {
      const input = { data: source.data, width: source.width, height: source.height };
      if (Math.max(input.width, input.height) <= longEdge) return input;
      const scale = longEdge / Math.max(input.width, input.height);
      const width = Math.max(24, Math.round(input.width * scale));
      const height = Math.max(24, Math.round(input.height * scale));
      const output = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        const sy = Math.min(input.height - 1, Math.floor(y / scale));
        for (let x = 0; x < width; x++) {
          const sx = Math.min(input.width - 1, Math.floor(x / scale));
          const si = (sy * input.width + sx) * 4, di = (y * width + x) * 4;
          output[di] = input.data[si]; output[di + 1] = input.data[si + 1];
          output[di + 2] = input.data[si + 2]; output[di + 3] = input.data[si + 3] == null ? 255 : input.data[si + 3];
        }
      }
      return { data: output, width, height };
    }
    if (typeof document === 'undefined') throw new TypeError('Canvas pixel extraction needs a browser document.');
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
    if (!sourceWidth || !sourceHeight) throw new Error('The source frame has no pixels yet.');
    const scale = Math.min(1, longEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(24, Math.round(sourceWidth * scale));
    const height = Math.max(24, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height };
  }

  function dilate(mask, width, height, radius) {
    const result = new Uint8Array(mask.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y * width + x]) continue;
        for (let dy = -radius; dy <= radius; dy++) {
          const py = y + dy;
          if (py < 0 || py >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const px = x + dx;
            if (px >= 0 && px < width && dx * dx + dy * dy <= radius * radius + 1) result[py * width + px] = 1;
          }
        }
      }
    }
    return result;
  }

  function skinAndLuma(pixels) {
    const { data, width, height } = pixels;
    const skin = new Uint8Array(width * height);
    const luma = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      luma[i] = y;
      if (y > 60 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) skin[i] = 1;
    }
    return { skin, luma };
  }

  function addBodyCones(mask, width, height) {
    const visited = new Uint8Array(mask.length);
    const output = mask.slice();
    const queueX = [], queueY = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const start = y * width + x;
        if (!mask[start] || visited[start]) continue;
        let head = 0, minX = x, maxX = x, minY = y, maxY = y, area = 0;
        queueX.length = 0; queueY.length = 0;
        queueX.push(x); queueY.push(y); visited[start] = 1;
        while (head < queueX.length) {
          const px = queueX[head], py = queueY[head++];
          area++;
          minX = Math.min(minX, px); maxX = Math.max(maxX, px);
          minY = Math.min(minY, py); maxY = Math.max(maxY, py);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = px + dx, ny = py + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const ni = ny * width + nx;
              if (mask[ni] && !visited[ni]) { visited[ni] = 1; queueX.push(nx); queueY.push(ny); }
            }
          }
        }
        if (area < 3) continue;
        const blobHeight = Math.max(2, maxY - minY + 1);
        const center = (minX + maxX) / 2;
        const bottom = Math.min(height - 1, Math.round(maxY + blobHeight * 2.5));
        for (let py = maxY; py <= bottom; py++) {
          const progress = (py - maxY) / Math.max(1, bottom - maxY);
          const half = (maxX - minX + 1) * (0.65 + progress * 0.85);
          const left = Math.max(0, Math.floor(center - half));
          const right = Math.min(width - 1, Math.ceil(center + half));
          for (let px = left; px <= right; px++) output[py * width + px] = 1;
        }
      }
    }
    return output;
  }

  function connectedComponents(mask, width, height) {
    const visited = new Uint8Array(mask.length);
    const components = [];
    const queue = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
      queue.length = 0;
      queue.push(start);
      visited[start] = 1;
      let cursor = 0, area = 0;
      let minX = width, minY = height, maxX = 0, maxY = 0;
      while (cursor < queue.length) {
        const index = queue[cursor++];
        const x = index % width, y = Math.floor(index / width);
        area++;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (mask[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
          }
        }
      }
      components.push({ area, minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 });
    }
    return components;
  }

  function fillBox(mask, width, height, left, top, right, bottom) {
    for (let y = Math.max(0, top); y <= Math.min(height - 1, bottom); y++) {
      for (let x = Math.max(0, left); x <= Math.min(width - 1, right); x++) mask[y * width + x] = 1;
    }
  }

  function maskBounds(mask, width, height) {
    let minX = width, minY = height, maxX = -1, maxY = -1, area = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y * width + x]) continue;
        area++;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (!area) return null;
    return {
      x: minX / width,
      y: minY / height,
      width: (maxX - minX + 1) / width,
      height: (maxY - minY + 1) / height,
      minX, minY, maxX, maxY, area,
    };
  }

  function makePersonModel(skin, width, height, boxes, sourceWidth, sourceHeight) {
    const headMask = new Uint8Array(skin.length);
    const personHeads = [];
    const softenedSkin = dilate(skin, width, height, Math.max(1, Math.round(Math.max(width, height) / 96)));
    const minDimension = Math.max(4, Math.round(Math.min(width, height) * 0.06));
    connectedComponents(softenedSkin, width, height).forEach(component => {
      const aspect = component.width / component.height;
      const fill = component.area / (component.width * component.height);
      const plausible = component.width >= minDimension && component.height >= minDimension &&
        component.width <= width * 0.28 && component.height <= height * 0.28 &&
        aspect >= 0.52 && aspect <= 1.78 && fill >= 0.28 && component.minY < height * 0.8;
      if (!plausible) return;
      personHeads.push(component);
      fillBox(headMask, width, height, component.minX, component.minY, component.maxX, component.maxY);
    });

    (boxes || []).forEach(item => {
      const box = item.boundingBox || item;
      if (!box) return;
      const sx = width / (sourceWidth || width), sy = height / (sourceHeight || height);
      const boxX = box.x * sx, boxY = box.y * sy, boxW = box.width * sx, boxH = box.height * sy;
      const left = Math.floor(boxX - boxW * 0.28), right = Math.ceil(boxX + boxW * 1.28);
      const top = Math.floor(boxY - boxH * 0.28), bottom = Math.ceil(boxY + boxH * 1.18);
      fillBox(headMask, width, height, left, top, right, bottom);
      personHeads.push({ minX: left, minY: top, maxX: right, maxY: bottom, width: right - left + 1, height: bottom - top + 1, area: boxW * boxH });
    });

    const detected = personHeads.length > 0;
    if (!detected) return { detected: false, headMask, personMask: new Uint8Array(skin.length), bounds: null, heads: [] };
    const expandedHeads = dilate(headMask, width, height, Math.max(1, Math.round(Math.max(width, height) * 0.012)));
    const personMask = compositePersonSilhouette({ skin }, { heads: personHeads }, width, height);
    return { detected: true, headMask: expandedHeads, personMask, bounds: maskBounds(personMask, width, height), heads: personHeads };
  }

  function outwardDistance(mask, width, height) {
    const distance = new Float32Array(mask.length);
    distance.fill(Infinity);
    const queue = new Int32Array(mask.length);
    let head = 0, tail = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      distance[i] = 0;
      queue[tail++] = i;
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width, y = Math.floor(index / width);
      for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + offset[0], ny = y + offset[1];
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (distance[next] <= distance[index] + 1) continue;
          distance[next] = distance[index] + 1;
          queue[tail++] = next;
      }
    }
    return distance;
  }

  function applyFaceBoxes(mask, width, height, boxes, sourceWidth, sourceHeight) {
    if (!boxes || !boxes.length) return mask;
    const output = mask.slice();
    boxes.forEach(item => {
      const box = item.boundingBox || item;
      if (!box) return;
      const sx = width / (sourceWidth || width), sy = height / (sourceHeight || height);
      const boxX = box.x * sx, boxY = box.y * sy, boxW = box.width * sx, boxH = box.height * sy;
      const expandedW = boxW * 1.6;
      const left = Math.max(0, Math.floor(boxX + boxW / 2 - expandedW / 2));
      const right = Math.min(width - 1, Math.ceil(boxX + boxW / 2 + expandedW / 2));
      const top = Math.max(0, Math.floor(boxY - boxH * 0.3));
      const bottom = Math.min(height - 1, Math.ceil(boxY + boxH * 5));
      for (let y = top; y <= bottom; y++) {
        const widening = Math.max(0, (y - (boxY + boxH)) * 0.12);
        for (let x = Math.max(0, Math.floor(left - widening)); x <= Math.min(width - 1, Math.ceil(right + widening)); x++) output[y * width + x] = 1;
      }
    });
    return output;
  }

  function varianceMap(luma, width, height) {
    const map = new Float32Array(luma.length);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0, square = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const value = luma[(y + dy) * width + x + dx];
            sum += value; square += value * value;
          }
        }
        const mean = sum / 9;
        map[y * width + x] = Math.max(0, square / 9 - mean * mean);
      }
    }
    return map;
  }

  function footprintSafe(mask, width, height, x, y, scale) {
    const radiusX = Math.max(3, Math.round(width * 0.045 * Math.max(0.7, scale)));
    const radiusY = Math.max(4, Math.round(height * 0.055 * Math.max(0.7, scale)));
    for (let dy = -radiusY; dy <= radiusY; dy++) {
      const py = y + dy;
      if (py < 0 || py >= height) return false;
      for (let dx = -radiusX; dx <= radiusX; dx++) {
        const px = x + dx;
        if (px < 0 || px >= width) return false;
        if ((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1 && mask[py * width + px]) return false;
      }
    }
    return true;
  }

  function makeDepthPlan(count, random, surprise) {
    const roles = Array(count).fill('normal');
    const jitter = Array.from({ length: count }, () => random() * 2 - 1);
    if (count >= 4) {
      const tiny = Math.floor(random() * count);
      let large = Math.floor(random() * (count - 1));
      if (large >= tiny) large++;
      roles[tiny] = 'tiny';
      roles[large] = 'large';
    } else {
      let special = surprise;
      if (!special) {
        const roll = random();
        if (roll < 0.045) special = 'tiny';
        else if (roll < 0.09) special = 'large';
      }
      if (count && (special === 'tiny' || special === 'large')) roles[Math.floor(random() * count)] = special;
    }
    return { roles, jitter };
  }

  function scaleForPosition(y, role, jitter) {
    if (role === 'tiny') return Math.max(0.32, Math.min(0.42, 0.32 + y * 0.09 + jitter * 0.018));
    if (role === 'large') return Math.max(1.55, Math.min(1.74, 1.47 + y * 0.25 + jitter * 0.035));
    return Math.max(0.7, Math.min(1.1, 0.65 + y * 0.5 + jitter * 0.045));
  }

  function shuffled(values, random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function makeRegionPlan(count, depthPlan, random) {
    const regions = Array(count).fill(null);
    const unused = new Set(Array.from({ length: 9 }, (_, index) => index));
    const rowCounts = [0, 0, 0];

    function claim(index, preferredRow) {
      const availableRows = shuffled([0, 1, 2], random).sort((a, b) => {
        if (a === preferredRow) return -1;
        if (b === preferredRow) return 1;
        return rowCounts[a] - rowCounts[b];
      });
      for (const row of availableRows) {
        const cells = shuffled([0, 1, 2].map(col => row * 3 + col).filter(cell => unused.has(cell)), random);
        if (!cells.length) continue;
        const cell = cells[0];
        unused.delete(cell);
        rowCounts[row]++;
        regions[index] = cell;
        return;
      }
    }

    for (let i = 0; i < count && i < 9; i++) {
      if (depthPlan.roles[i] === 'tiny') claim(i, 0);
      else if (depthPlan.roles[i] === 'large') claim(i, 2);
    }
    for (let i = 0; i < count && i < 9; i++) {
      if (regions[i] != null) continue;
      const leastUsed = Math.min(...rowCounts);
      const preferred = shuffled([0, 1, 2].filter(row => rowCounts[row] === leastUsed), random)[0];
      claim(i, preferred);
    }
    return regions;
  }

  function sameHorizontalBand(positions, y) {
    return positions.filter(position => Math.abs(position.y - y) < 0.085).length >= 2;
  }

  function fallbackPositions(count, seed, exclusion, width, height, depthPlan) {
    const random = randomFrom(seed);
    const plan = depthPlan || makeDepthPlan(count, random);
    const regions = makeRegionPlan(count, plan, random);
    const anchors = [
      [0.17, 0.16], [0.5, 0.19], [0.82, 0.24],
      [0.19, 0.48], [0.51, 0.53], [0.81, 0.45],
      [0.18, 0.77], [0.48, 0.82], [0.81, 0.74],
    ];
    const positions = [];
    for (let i = 0; i < count; i++) {
      const base = anchors[regions[i] == null ? i % anchors.length : regions[i]];
      let best = null;
      for (let attempt = 0; attempt < 120; attempt++) {
        const nx = Math.min(0.91, Math.max(0.09, base[0] + (random() - 0.5) * (attempt < 30 ? 0.12 : 0.62)));
        const ny = Math.min(0.9, Math.max(0.1, base[1] + (random() - 0.5) * (attempt < 30 ? 0.12 : 0.62)));
        const scale = scaleForPosition(ny, plan.roles[i], plan.jitter[i]);
        const x = Math.round(nx * (width - 1)), y = Math.round(ny * (height - 1));
        const safe = !exclusion || footprintSafe(exclusion, width, height, x, y, scale);
        const separated = positions.every(p => Math.hypot(nx - p.x, (ny - p.y) * 0.82) > 0.16);
        if (safe && separated && insideVisibleFrame(nx, ny, scale) && !sameHorizontalBand(positions, ny)) { best = [nx, ny, scale]; break; }
      }
      if (!best) {
        let greatest = -1;
        for (let y = 4; y < height - 4; y += 2) {
          for (let x = 4; x < width - 4; x += 2) {
            if (exclusion && exclusion[y * width + x]) continue;
            const nx = x / width, ny = y / height;
            const scale = scaleForPosition(ny, plan.roles[i], plan.jitter[i]);
            if ((exclusion && !footprintSafe(exclusion, width, height, x, y, scale)) || !insideVisibleFrame(nx, ny, scale) || sameHorizontalBand(positions, ny)) continue;
            const spacing = positions.length ? Math.min(...positions.map(p => Math.hypot(nx - p.x, (ny - p.y) * 0.82))) : 1;
            if (spacing > greatest) { greatest = spacing; best = [nx, ny, scale]; }
          }
        }
      }
      const fallback = best || [base[0], base[1], scaleForPosition(base[1], plan.roles[i], plan.jitter[i])];
      positions.push(decoratePosition(fallback[0], fallback[1], fallback[2], random, -1));
    }
    return positions;
  }

  function decoratePosition(x, y, scale, random, score) {
    return {
      x: Math.min(0.98, Math.max(0.02, x)),
      y: Math.min(0.97, Math.max(0.03, y)),
      scale,
      rotation: -8 + random() * 16,
      flip: random() < 0.5,
      floatAmplitude: 4 + random() * 9,
      floatPhase: random() * Math.PI * 2,
      expression: Math.floor(random() * 4),
      distance: scale < 0.5 ? 'far' : (scale > 1.35 ? 'close' : 'normal'),
      score,
    };
  }

  function insideVisibleFrame(x, y, scale) {
    const marginX = Math.min(0.14, 0.045 + scale * 0.038);
    const marginY = Math.min(0.15, 0.045 + scale * 0.045);
    return x >= marginX && x <= 1 - marginX && y >= marginY && y <= 1 - marginY;
  }

  function insideVisibleRegion(x, y, scale, rect) {
    if (!rect) return insideVisibleFrame(x, y, scale);
    const marginX = Math.min(0.14, 0.045 + scale * 0.038);
    const marginY = Math.min(0.15, 0.045 + scale * 0.045);
    return x >= rect.x + marginX && x <= rect.x + rect.width - marginX &&
      y >= rect.y + marginY && y <= rect.y + rect.height - marginY;
  }

  function footprintStats(mask, headMask, width, height, x, y, scale) {
    const radiusX = Math.max(3, Math.round(width * 0.045 * Math.max(0.7, scale)));
    const radiusY = Math.max(4, Math.round(height * 0.055 * Math.max(0.7, scale)));
    let total = 0, covered = 0, faceTotal = 0, faceCovered = 0;
    for (let dy = -radiusY; dy <= radiusY; dy++) {
      const py = y + dy;
      if (py < 0 || py >= height) continue;
      for (let dx = -radiusX; dx <= radiusX; dx++) {
        const px = x + dx;
        if (px < 0 || px >= width) continue;
        if ((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) > 1) continue;
        total++;
        if (mask[py * width + px]) covered++;
        const inGhostFace = Math.abs(dx) <= radiusX * 0.52 && dy >= -radiusY * 0.58 && dy <= radiusY * 0.08;
        if (inGhostFace) {
          faceTotal++;
          if (mask[py * width + px] || (headMask && headMask[py * width + px])) faceCovered++;
        }
      }
    }
    return {
      overlap: total ? covered / total : 0,
      faceOverlap: faceTotal ? faceCovered / faceTotal : 0,
    };
  }

  function personScaleFor(model) {
    return Math.max(0.86, Math.min(1.28, 0.73 + (model.bounds ? model.bounds.height : 0.32) * 0.92));
  }

  function placeAroundPerson(count, seed, pixels, channels, variance, model, depthPlan, surprise, visibleRect) {
    const { width, height } = pixels;
    const random = randomFrom(`${seed}-person`);
    const distance = outwardDistance(model.personMask, width, height);
    const headWidth = model.heads.length ? Math.max(...model.heads.map(head => head.width)) : width * 0.09;
    const bandMax = Math.max(5, Math.min(Math.max(width, height) * 0.16, headWidth * 2.1));
    const basePersonScale = personScaleFor(model);
    const awayCount = count >= 5 ? 2 : (count >= 3 ? 1 : 0);
    const awayIndices = [];
    const tinyIndex = depthPlan.roles.indexOf('tiny');
    const largeIndex = depthPlan.roles.indexOf('large');
    if (tinyIndex >= 0) awayIndices.push(tinyIndex);
    if (awayCount > awayIndices.length && largeIndex >= 0 && largeIndex !== tinyIndex) awayIndices.push(largeIndex);
    for (let i = 0; awayIndices.length < awayCount && i < count; i++) if (!awayIndices.includes(i)) awayIndices.push(i);
    const nearIndices = Array.from({ length: count }, (_, index) => index).filter(index => !awayIndices.includes(index));
    const behindIndex = nearIndices.find(index => depthPlan.roles[index] === 'normal') == null ? nearIndices[0] : nearIndices.find(index => depthPlan.roles[index] === 'normal');
    const order = [behindIndex, ...nearIndices.filter(index => index !== behindIndex), ...awayIndices].filter(index => index != null);
    const placedByIndex = Array(count);
    const positions = [];

    function scaleAt(index, ny, near) {
      if (!near) return scaleForPosition(ny, depthPlan.roles[index], depthPlan.jitter[index]);
      if (depthPlan.roles[index] === 'large') return Math.max(1.38, Math.min(1.55, basePersonScale * 1.18));
      return Math.max(0.78, Math.min(1.32, basePersonScale + depthPlan.jitter[index] * 0.09 + (ny - 0.5) * 0.08));
    }

    function candidateList(index, kind, relax) {
      const list = [];
      for (let y = 3; y < height - 3; y++) {
        for (let x = 3; x < width - 3; x++) {
          const i = y * width + x;
          const nx = x / (width - 1), ny = y / (height - 1);
          const near = kind !== 'away';
          const scale = scaleAt(index, ny, near);
          if (model.headMask[i] || !insideVisibleRegion(nx, ny, scale, visibleRect)) continue;
          const proximity = distance[i];
          if (near && (proximity < 0.5 || proximity > bandMax * (relax ? 1.45 : 1))) continue;
          if (!near && proximity < bandMax * (relax ? 1.15 : 1.65)) continue;
          const stats = footprintStats(model.personMask, model.headMask, width, height, x, y, scale);
          if (stats.overlap > 0.45 || stats.faceOverlap > 0) continue;
          if (kind === 'behind' && (stats.overlap < 0.25 || stats.overlap > 0.45)) continue;
          if (kind === 'near' && stats.overlap > 0.24) continue;
          const minSeparation = Math.max(0.115, 0.19 - count * 0.008);
          if (positions.some(item => Math.hypot(nx - item.x, (ny - item.y) * 0.82) < minSeparation)) continue;
          if (!relax && sameHorizontalBand(positions, ny)) continue;
          const centerDistance = Math.hypot(nx - 0.5, (ny - 0.5) * 0.85);
          const centerPenalty = Math.max(0, 1 - centerDistance / 0.25) * 0.35;
          const edgePenalty = Math.max(0, 0.07 - Math.min(nx, 1 - nx, ny, 1 - ny)) * 4;
          const quiet = 1 / (1 + variance[i] / 145);
          const lightBalance = 0.7 + 0.3 * (1 - Math.abs(channels.luma[i] - 145) / 145);
          let score = Math.max(0.005, quiet * lightBalance * (1 - centerPenalty) * (1 - edgePenalty));
          if (near) {
            const idealDistance = Math.max(1.5, bandMax * 0.46);
            score *= 2.2 + 4.2 * Math.max(0, 1 - Math.abs(proximity - idealDistance) / bandMax);
          }
          if (kind === 'behind') score *= 2 + 5 * Math.max(0, 1 - Math.abs(stats.overlap - 0.34) / 0.12);
          list.push({ x, y, nx, ny, scale, score, proximity, stats });
        }
      }
      return list;
    }

    order.forEach(index => {
      const kind = index === behindIndex ? 'behind' : (awayIndices.includes(index) ? 'away' : 'near');
      let pool = candidateList(index, kind, false);
      if (!pool.length) pool = candidateList(index, kind, true);
      if (!pool.length && kind === 'behind') pool = candidateList(index, 'near', true);
      if (!pool.length) return;
      let total = 0;
      pool.forEach(candidate => { total += candidate.score; });
      let needle = random() * total, chosen = pool[pool.length - 1];
      for (const candidate of pool) {
        needle -= candidate.score;
        if (needle <= 0) { chosen = candidate; break; }
      }
      const position = decoratePosition(chosen.nx, chosen.ny, chosen.scale, random, chosen.score);
      position.nearPerson = kind !== 'away';
      position.behind = kind === 'behind' && chosen.stats.overlap >= 0.25;
      position.behindPerson = position.behind;
      position.personOverlap = chosen.stats.overlap;
      position.faceOverlap = chosen.stats.faceOverlap;
      position.personDistance = chosen.proximity;
      position.proximityBand = bandMax;
      position.depthCue = position.behind ? { brightness: 0.89, saturation: 0.82, contrast: 0.93, hueRotate: 7 } : null;
      positions.push(position);
      placedByIndex[index] = position;
    });

    /* Retain the ordinary safe fallback if an exceptionally crowded person
       frame cannot satisfy the bounded-overlap composition. */
    if (positions.length < count) {
      const missing = count - positions.length;
      fallbackPositions(missing, `${seed}-person-fallback`, model.headMask, width, height).forEach(position => {
        position.nearPerson = false;
        position.behind = false;
        position.behindPerson = false;
        position.personOverlap = 0;
        position.faceOverlap = 0;
        position.personDistance = distance[Math.round(position.y * (height - 1)) * width + Math.round(position.x * (width - 1))];
        position.proximityBand = bandMax;
        positions.push(position);
      });
    }
    return { positions: positions.slice(0, count), proximityMap: distance, proximityBand: bandMax };
  }

  function computeAnalysis(source, options) {
    const opts = options || {};
    const count = Math.max(1, Math.min(10, Math.floor(opts.count || 1)));
    const seed = opts.seed == null ? Date.now() : opts.seed;
    const random = randomFrom(seed);
    const pixels = resizePixels(sourcePixels(source));
    const { width, height } = pixels;
    const channels = skinAndLuma(pixels);
    const dilatedSkin = dilate(channels.skin, width, height, 2);
    let exclusion = addBodyCones(dilatedSkin, width, height);
    exclusion = applyFaceBoxes(exclusion, width, height, opts.faceBoxes, opts.sourceWidth, opts.sourceHeight);
    const variance = varianceMap(channels.luma, width, height);
    const depthPlan = makeDepthPlan(count, random, opts.surprise);
    const knownDemo = demoSources && source && demoSources.get(source);
    const personModel = knownDemo && knownDemo !== 'classroom' ?
      { detected: false, headMask: new Uint8Array(width * height), personMask: new Uint8Array(width * height), bounds: null, heads: [] } :
      makePersonModel(channels.skin, width, height, opts.faceBoxes, opts.sourceWidth, opts.sourceHeight);
    if (personModel.detected) {
      const personPlacement = placeAroundPerson(count, seed, pixels, channels, variance, personModel, depthPlan, opts.surprise, opts.visibleRect);
      return {
        positions: personPlacement.positions,
        width,
        height,
        skinMask: channels.skin,
        exclusionMask: personModel.headMask,
        legacyExclusionMask: exclusion,
        headMask: personModel.headMask,
        personMask: personModel.personMask,
        personDetected: true,
        personBounds: personModel.bounds,
        personHeads: personModel.heads,
        proximityMap: personPlacement.proximityMap,
        proximityBand: personPlacement.proximityBand,
        variance,
      };
    }
    const regionPlan = makeRegionPlan(count, depthPlan, random);
    const candidates = [];

    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        const i = y * width + x;
        if (exclusion[i]) continue;
        const nx = x / (width - 1), ny = y / (height - 1);
        const centerDistance = Math.hypot(nx - 0.5, (ny - 0.5) * 0.85);
        const centerPenalty = Math.max(0, 1 - centerDistance / 0.25) * 0.52;
        const edgePenalty = Math.max(0, 0.08 - Math.min(nx, 1 - nx, ny, 1 - ny)) * 4;
        const quiet = 1 / (1 + variance[i] / 145);
        const lightBalance = 0.7 + 0.3 * (1 - Math.abs(channels.luma[i] - 145) / 145);
        const score = Math.max(0.005, quiet * lightBalance * (1 - centerPenalty) * (1 - edgePenalty));
        candidates.push({ x, y, nx, ny, score });
      }
    }
    const pool = candidates.slice();
    const positions = [];
    const claimedRegions = new Set();

    for (let p = 0; p < count; p++) {
      let chosen = null;
      let chosenScale = 1;
      const targetRegion = regionPlan[p];
      const unclaimed = shuffled(Array.from({ length: 9 }, (_, index) => index).filter(region => region !== targetRegion && !claimedRegions.has(region)), random);
      const regionOrder = targetRegion == null ? [] : [targetRegion, ...unclaimed];
      for (const region of regionOrder) {
        const regionalPool = pool.filter(candidate => {
          const col = Math.min(2, Math.floor(candidate.nx * 3));
          const row = Math.min(2, Math.floor(candidate.ny * 3));
          return row * 3 + col === region;
        });
        for (let attempt = 0; attempt < 180 && regionalPool.length; attempt++) {
          let total = 0;
          for (let i = 0; i < regionalPool.length; i++) total += regionalPool[i].score;
          let needle = random() * total, index = 0;
          while (index < regionalPool.length - 1 && (needle -= regionalPool[index].score) > 0) index++;
          const candidate = regionalPool[index];
          const scale = scaleForPosition(candidate.ny, depthPlan.roles[p], depthPlan.jitter[p]);
          const minSeparation = Math.max(0.13, 0.205 - count * 0.008);
          const separated = positions.every(item => Math.hypot(candidate.nx - item.x, (candidate.ny - item.y) * 0.82) >= minSeparation);
          if (separated && !sameHorizontalBand(positions, candidate.ny) && insideVisibleFrame(candidate.nx, candidate.ny, scale) && footprintSafe(exclusion, width, height, candidate.x, candidate.y, scale)) {
            chosen = candidate;
            chosenScale = scale;
            claimedRegions.add(region);
            const poolIndex = pool.indexOf(candidate);
            if (poolIndex >= 0) pool.splice(poolIndex, 1);
            break;
          }
          regionalPool.splice(index, 1);
        }
        if (chosen) break;
      }
      if (!chosen) break;
      positions.push(decoratePosition(chosen.nx, chosen.ny, chosenScale, random, chosen.score));
    }

    if (positions.length < count) {
      const remainingPlan = {
        roles: depthPlan.roles.slice(positions.length),
        jitter: depthPlan.jitter.slice(positions.length),
      };
      const fallback = fallbackPositions(count - positions.length, `${seed}-fallback`, exclusion, width, height, remainingPlan);
      fallback.forEach(candidate => {
        const px = Math.round(candidate.x * (width - 1));
        const py = Math.round(candidate.y * (height - 1));
        const safe = footprintSafe(exclusion, width, height, px, py, candidate.scale);
        if (safe && insideVisibleFrame(candidate.x, candidate.y, candidate.scale) && !sameHorizontalBand(positions, candidate.y) && positions.length < count && positions.every(item => Math.hypot(candidate.x - item.x, (candidate.y - item.y) * 0.82) > 0.075)) positions.push(candidate);
      });
    }

    /* A crowded frame may leave only thin safe strips. Fill those before
       considering spacing; avoiding a person always outranks composition. */
    while (positions.length < count) {
      const i = positions.length;
      let chosen = null, chosenSpacing = -1;
      let placementScale = 1;
      for (let pass = 0; pass < 2 && !chosen; pass++) {
        for (let y = 3; y < height - 3; y++) {
          for (let x = 3; x < width - 3; x++) {
            if (exclusion[y * width + x]) continue;
            const nx = x / (width - 1), ny = y / (height - 1);
            placementScale = scaleForPosition(ny, depthPlan.roles[i], depthPlan.jitter[i]);
            if (!insideVisibleFrame(nx, ny, placementScale) || !footprintSafe(exclusion, width, height, x, y, placementScale)) continue;
            if (pass === 0 && sameHorizontalBand(positions, ny)) continue;
            const spacing = positions.length ? Math.min(...positions.map(item => Math.hypot(nx - item.x, (ny - item.y) * 0.82))) : 1;
            const offCenter = Math.hypot(nx - 0.5, (ny - 0.5) * 0.85) * 0.08;
            if (spacing + offCenter > chosenSpacing) {
              chosenSpacing = spacing + offCenter;
              chosen = { nx, ny, scale: placementScale };
            }
          }
        }
      }
      if (!chosen) {
        /* An entirely excluded frame has no honest placement. Returning only
           safe positions is preferable to drawing over a detected person. */
        break;
      }
      positions.push(decoratePosition(chosen.nx, chosen.ny, chosen.scale, random, -2));
    }

    return {
      positions,
      width,
      height,
      skinMask: channels.skin,
      exclusionMask: exclusion,
      legacyExclusionMask: exclusion,
      headMask: new Uint8Array(width * height),
      personMask: new Uint8Array(width * height),
      personDetected: false,
      personBounds: null,
      personHeads: [],
      proximityMap: null,
      proximityBand: 0,
      variance,
    };
  }

  function normalizedOptions(countOrOptions, options) {
    if (typeof countOrOptions === 'number') return Object.assign({}, options, { count: countOrOptions });
    return Object.assign({}, countOrOptions || {});
  }

  function analyzeSync(source, countOrOptions, options) {
    return computeAnalysis(source, normalizedOptions(countOrOptions, options)).positions;
  }

  async function detectFaces(source) {
    if (!window.FaceDetector) return [];
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 8 });
      return await detector.detect(source);
    } catch (error) {
      return [];
    }
  }

  function featherAlpha(mask, width, height, radius) {
    const horizontal = new Float32Array(mask.length);
    const output = new Uint8ClampedArray(mask.length);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) if (x >= 0 && x < width) sum += mask[y * width + x];
      for (let x = 0; x < width; x++) {
        horizontal[y * width + x] = sum / (radius * 2 + 1);
        const remove = x - radius;
        const add = x + radius + 1;
        if (remove >= 0) sum -= mask[y * width + remove];
        if (add < width) sum += mask[y * width + add];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) if (y >= 0 && y < height) sum += horizontal[y * width + x];
      for (let y = 0; y < height; y++) {
        const blurred = sum / (radius * 2 + 1);
        /* Slight erosion before the soft ramp avoids a bright fringe sampled
           from just outside the silhouette. */
        output[y * width + x] = Math.round(255 * Math.max(0, Math.min(1, (blurred - 0.16) / 0.7)));
        const remove = y - radius;
        const add = y + radius + 1;
        if (remove >= 0) sum -= horizontal[remove * width + x];
        if (add < height) sum += horizontal[add * width + x];
      }
    }
    return output;
  }

  function scaledMask(mask, fromWidth, fromHeight, toWidth, toHeight) {
    const output = new Uint8Array(toWidth * toHeight);
    for (let y = 0; y < toHeight; y++) {
      const sy = Math.min(fromHeight - 1, Math.floor(y * fromHeight / toHeight));
      for (let x = 0; x < toWidth; x++) {
        const sx = Math.min(fromWidth - 1, Math.floor(x * fromWidth / toWidth));
        output[y * toWidth + x] = mask[sy * fromWidth + sx];
      }
    }
    return output;
  }

  function compositePersonSilhouette(channels, model, width, height) {
    const silhouette = new Uint8Array(width * height);
    let skinReach = 2;

    model.heads.forEach(component => {
      const rawWidth = Math.max(4, component.width);
      const rawHeight = Math.max(4, component.height);
      const fill = component.area / Math.max(1, rawWidth * rawHeight);
      /* A connected head-and-hands blob is wider/taller than the actual
         head. Its topmost compact portion remains a reliable head anchor. */
      const diameter = fill < 0.62 ?
        Math.min(rawWidth, rawHeight, width * 0.14) :
        Math.min(rawWidth, rawHeight, width * 0.24);
      const headWidth = Math.max(5, diameter);
      const headHeight = Math.max(5, Math.min(rawHeight, diameter * 1.08));
      const centerX = (component.minX + component.maxX) / 2;
      const headTop = Math.max(0, component.minY);
      const centerY = headTop + headHeight * 0.5;
      const torsoTop = centerY + headHeight * 0.43;
      const torsoBottom = Math.min(height - 1, torsoTop + headHeight * 2.45);
      const legsBottom = Math.min(height - 1, torsoBottom + headHeight * 2.05);
      skinReach = Math.max(skinReach, Math.round(headWidth * 0.16));

      const left = Math.max(0, Math.floor(centerX - headWidth * 1.08));
      const right = Math.min(width - 1, Math.ceil(centerX + headWidth * 1.08));
      const top = Math.max(0, Math.floor(headTop - 2));
      const bottom = Math.min(height - 1, Math.ceil(legsBottom));
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          const headDx = (x - centerX) / (headWidth * 0.52);
          const headDy = (y - centerY) / (headHeight * 0.53);
          let inside = headDx * headDx + headDy * headDy <= 1;

          if (!inside && y >= torsoTop && y <= torsoBottom) {
            const progress = (y - torsoTop) / Math.max(1, torsoBottom - torsoTop);
            let halfWidth;
            if (progress < 0.18) halfWidth = headWidth * (0.42 + progress / 0.18 * 0.38);
            else halfWidth = headWidth * (0.8 - (progress - 0.18) / 0.82 * 0.18);
            const roundedTop = progress < 0.12 ? Math.sqrt(Math.max(0, 1 - Math.pow((progress - 0.12) / 0.12, 2))) : 1;
            inside = Math.abs(x - centerX) <= halfWidth * Math.max(0.72, roundedTop);
          }

          if (!inside && y > torsoBottom && y <= legsBottom) {
            const legProgress = (y - torsoBottom) / Math.max(1, legsBottom - torsoBottom);
            const legHalf = headWidth * (0.2 - legProgress * 0.035);
            const legOffset = headWidth * 0.32;
            const footRound = legProgress > 0.88 ? Math.sqrt(Math.max(0, 1 - Math.pow((legProgress - 0.88) / 0.12, 2))) : 1;
            inside = Math.abs(x - (centerX - legOffset)) <= legHalf * Math.max(0.55, footRound) ||
              Math.abs(x - (centerX + legOffset)) <= legHalf * Math.max(0.55, footRound);
          }
          if (inside) silhouette[y * width + x] = 1;
        }
      }
    });

    /* Preserve real exposed arms/hands near the conservative body shape,
       without admitting unrelated skin-coloured furniture farther away. */
    const reachable = dilate(silhouette, width, height, skinReach);
    const exactSkin = dilate(channels.skin, width, height, 1);
    for (let i = 0; i < silhouette.length; i++) if (reachable[i] && exactSkin[i]) silhouette[i] = 1;
    return silhouette;
  }

  function buildPersonCutout(source, analysis, options) {
    if (!analysis || !analysis.personDetected || typeof document === 'undefined') return null;
    const opts = options || {};
    const pixels = pixelsAtLongEdge(source, COMPOSITE_LONG_EDGE);
    const channels = skinAndLuma(pixels);
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
    const highModel = makePersonModel(channels.skin, pixels.width, pixels.height, opts.faceBoxes, sourceWidth, sourceHeight);
    const mask = highModel.detected ?
      compositePersonSilhouette(channels, highModel, pixels.width, pixels.height) :
      scaledMask(analysis.personMask, analysis.width, analysis.height, pixels.width, pixels.height);
    const alpha = featherAlpha(mask, pixels.width, pixels.height, Math.max(2, Math.round(COMPOSITE_LONG_EDGE / 110)));
    const rgba = new Uint8ClampedArray(pixels.data);
    for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i];
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width; canvas.height = pixels.height;
    canvas.className = 'person-cutout';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.getContext('2d').putImageData(new ImageData(rgba, pixels.width, pixels.height), 0, 0);
    return { canvas, mask, alpha, width: pixels.width, height: pixels.height, bounds: maskBounds(mask, pixels.width, pixels.height) };
  }

  async function analyze(source, countOrOptions, options) {
    const opts = normalizedOptions(countOrOptions, options);
    if (!opts.faceBoxes && typeof window !== 'undefined' && window.FaceDetector) {
      opts.faceBoxes = await detectFaces(source);
      opts.sourceWidth = source.videoWidth || source.naturalWidth || source.width;
      opts.sourceHeight = source.videoHeight || source.naturalHeight || source.height;
    }
    return computeAnalysis(source, opts).positions;
  }

  async function analyzeDetailed(source, countOrOptions, options) {
    const opts = normalizedOptions(countOrOptions, options);
    if (!opts.faceBoxes && typeof window !== 'undefined' && window.FaceDetector) {
      opts.faceBoxes = await detectFaces(source);
      opts.sourceWidth = source.videoWidth || source.naturalWidth || source.width;
      opts.sourceHeight = source.videoHeight || source.naturalHeight || source.height;
    }
    const analysis = computeAnalysis(source, opts);
    const composite = buildPersonCutout(source, analysis, opts);
    analysis.personCutout = composite ? composite.canvas : null;
    analysis.cutoutCanvas = analysis.personCutout;
    analysis.compositeMask = composite ? composite.mask : null;
    analysis.compositeAlpha = composite ? composite.alpha : null;
    analysis.compositeWidth = composite ? composite.width : 0;
    analysis.compositeHeight = composite ? composite.height : 0;
    analysis.compositeBounds = composite ? composite.bounds : null;
    return analysis;
  }

  function createPersonCutout(source, analysis, options) {
    const composite = buildPersonCutout(source, analysis, options);
    return composite ? composite.canvas : null;
  }

  function inspectFrame(source, countOrOptions, options) {
    return computeAnalysis(source, normalizedOptions(countOrOptions, options));
  }

  return {
    demoNames: DEMO_NAMES.slice(),
    drawDemo,
    nextDemo,
    copyFrame,
    analyze,
    analyzeDetailed,
    createPersonCutout,
    analyzeSync,
    placeGhosts: analyze,
    placeGhostsSync: analyzeSync,
    fallbackPositions(count, seed) {
      const n = Math.max(1, Math.min(10, Math.floor(count || 1)));
      return fallbackPositions(n, seed, null, 96, 96);
    },
    __test: {
      analyze: inspectFrame,
      seededRandom: randomFrom,
      isExcluded(analysis, x, y) {
        const px = Math.max(0, Math.min(analysis.width - 1, Math.round(x * (analysis.width - 1))));
        const py = Math.max(0, Math.min(analysis.height - 1, Math.round(y * (analysis.height - 1))));
        return !!analysis.exclusionMask[py * analysis.width + px];
      },
      footprintOverlaps(analysis, position) {
        const px = Math.round(position.x * (analysis.width - 1));
        const py = Math.round(position.y * (analysis.height - 1));
        return !footprintSafe(analysis.exclusionMask, analysis.width, analysis.height, px, py, position.scale);
      },
      footprintPersonOverlap(analysis, position) {
        const px = Math.round(position.x * (analysis.width - 1));
        const py = Math.round(position.y * (analysis.height - 1));
        return footprintStats(analysis.personMask, analysis.headMask, analysis.width, analysis.height, px, py, position.scale);
      },
      personDistance(analysis, x, y) {
        if (!analysis.proximityMap) return Infinity;
        const px = Math.max(0, Math.min(analysis.width - 1, Math.round(x * (analysis.width - 1))));
        const py = Math.max(0, Math.min(analysis.height - 1, Math.round(y * (analysis.height - 1))));
        return analysis.proximityMap[py * analysis.width + px];
      },
    },
  };
})();
