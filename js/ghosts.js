/* ============================================================
   GHOST COUNT - original procedural inline-SVG ghost art
   NOKO, NOKORO, and NOKOMARU share one parameterized renderer.
   ============================================================ */
'use strict';

const Ghosts = (() => {
  let instance = 0;

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  function stageNumber(value) {
    const names = { noko: 1, nokoro: 2, nokomaru: 3 };
    const stage = names[String(value).toLowerCase()] || Math.round(finite(value, 1));
    return Math.max(1, Math.min(3, stage));
  }

  function expressionName(value) {
    const allowed = ['cheeky', 'happy', 'sleepy', 'surprised'];
    return allowed.includes(value) ? value : 'cheeky';
  }

  function star(cx, cy, outer, inner, points = 5) {
    const coords = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + i * Math.PI / points;
      coords.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
    }
    return coords.join(' ');
  }

  function defs(id, stage) {
    const colors = stage === 1
      ? ['#8FF3E0', '#4FD3C8']
      : stage === 2
        ? ['#9BE7F5', '#7C6BE0']
        : ['#5B4BC4', '#C86BE8'];
    const rim = stage === 3 ? '#F7CA78' : '#BFFFF5';
    return `<defs>
      <linearGradient id="${id}-body" x1="0" y1="0" x2="0.78" y2="1">
        <stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/>
      </linearGradient>
      <radialGradient id="${id}-glow" cx="36%" cy="24%" r="70%">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity=".48"/>
        <stop offset=".52" stop-color="${rim}" stop-opacity=".12"/>
        <stop offset="1" stop-color="#162459" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#FFF2A8"/><stop offset=".5" stop-color="#F4C65A"/><stop offset="1" stop-color="#C58A31"/>
      </linearGradient>
      <filter id="${id}-soft" x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur stdDeviation="4.2"/>
      </filter>
      <filter id="${id}-rim" x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur"/>
        <feFlood flood-color="${rim}" flood-opacity=".72" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="halo"/>
        <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;
  }

  function eye(cx, cy, options) {
    const { sleepy, surprised, starPupil } = options;
    if (sleepy) {
      return `<g class="ghost-eye ghost-eye--sleepy">
        <path d="M${cx - 13} ${cy} Q${cx} ${cy + 8} ${cx + 13} ${cy - 1}" fill="none" stroke="#20394A" stroke-width="5" stroke-linecap="round"/>
      </g>`;
    }
    const ry = surprised ? 19 : 16;
    const pupil = starPupil
      ? `<polygon points="${star(cx, cy + 2, 8, 3.4)}" fill="#352862"/>`
      : `<ellipse cx="${cx}" cy="${cy + 3}" rx="5.8" ry="7.4" fill="#20394A"/>`;
    return `<g class="ghost-eye">
      <ellipse cx="${cx}" cy="${cy}" rx="13.6" ry="${ry}" fill="#F8FFFF" stroke="#D6FFFA" stroke-width="2"/>
      ${pupil}<circle cx="${cx - 4}" cy="${cy - 5}" r="3.2" fill="#FFFFFF"/>
    </g>`;
  }

  function mouth(stage, expression) {
    if (expression === 'surprised') {
      return '<ellipse class="ghost-mouth" cx="0" cy="30" rx="8" ry="11" fill="#234052"><ellipse cx="-2" cy="34" rx="4" ry="3" fill="#FF9DAD"/>';
    }
    if (stage === 1 || expression === 'happy') {
      return `<g class="ghost-mouth">
        <path d="M-11 27 Q0 40 11 27 Q7 43 0 44 Q-7 43 -11 27Z" fill="#234052"/>
        <path d="M-5 39 Q0 35 5 39" fill="none" stroke="#FF9DAD" stroke-width="3" stroke-linecap="round"/>
      </g>`;
    }
    return `<g class="ghost-mouth">
      <path d="M-18 28 Q-2 41 17 25" fill="none" stroke="#33284D" stroke-width="5" stroke-linecap="round"/>
      <path d="M8 28 L14 28 L11 37Z" fill="#FFF7E4"/>
    </g>`;
  }

  function mistRuff() {
    return `<g class="ghost-ruff" fill="#D9FCFF" opacity=".5">
      <ellipse cx="-25" cy="42" rx="25" ry="12"/><ellipse cx="0" cy="46" rx="29" ry="13"/>
      <ellipse cx="27" cy="41" rx="24" ry="12"/>
    </g>`;
  }

  function hand(x, y, side, large, raised) {
    const scale = large ? 1.18 : 0.92;
    const rotate = raised ? (side < 0 ? -28 : 28) : (side < 0 ? 10 : -10);
    const fingers = side < 0
      ? '<path d="M-15 -2 Q-25 -7 -27 0 Q-27 6 -17 6"/><path d="M-13 -10 Q-20 -18 -24 -12 Q-26 -7 -16 -1"/>'
      : '<path d="M15 -2 Q25 -7 27 0 Q27 6 17 6"/><path d="M13 -10 Q20 -18 24 -12 Q26 -7 16 -1"/>';
    return `<g class="ghost-hand ghost-hand--${side < 0 ? 'left' : 'right'}${raised ? ' ghost-hand--wave' : ''}"
      transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" fill="url(#HAND_GRADIENT)" stroke="#D8FBFF" stroke-width="2.5" stroke-linecap="round">
      <ellipse cx="0" cy="0" rx="19" ry="15"/>${fingers}
    </g>`;
  }

  function noko(id, expression) {
    const sleepy = expression === 'sleepy';
    const surprised = expression === 'surprised';
    return `<g class="ghost-character ghost-character--noko" filter="url(#${id}-rim)">
      <ellipse class="ghost-cast-glow" cx="0" cy="83" rx="48" ry="13" fill="#72F4DF" opacity=".18" filter="url(#${id}-soft)"/>
      <g class="ghost-antenna">
        <path d="M-5 -64 C-26 -86 -7 -103 10 -91 C23 -82 14 -69 5 -73" fill="none" stroke="#7DE6D8" stroke-width="9" stroke-linecap="round"/>
        <circle cx="11" cy="-91" r="8" fill="#A9FFF0" stroke="#DFFFFA" stroke-width="2"/>
      </g>
      <path class="ghost-body-shape" d="M0 -70 C-48 -70 -66 -33 -59 8 C-55 33 -64 50 -72 66
        Q-54 82 -35 65 Q-18 88 0 67 Q19 88 36 65 Q54 82 72 65
        C62 49 57 33 59 8 C66 -33 48 -70 0 -70Z" fill="url(#${id}-body)" opacity=".82" stroke="#BFFFF5" stroke-width="3"/>
      <path d="M-39 -44 Q0 -68 39 -42 Q12 -52 -16 10 Q-31 -5 -39 -44Z" fill="url(#${id}-glow)" opacity=".75"/>
      <g class="ghost-eyes ghost-blink">
        ${eye(-22, 5, { sleepy, surprised })}${eye(22, 5, { sleepy, surprised })}
      </g>
      ${mouth(1, expression)}
      <ellipse cx="-40" cy="34" rx="9" ry="5" fill="#FFB1CB" opacity=".28"/>
      <ellipse cx="40" cy="34" rx="9" ry="5" fill="#FFB1CB" opacity=".28"/>
    </g>`;
  }

  function nokoro(id, expression) {
    const sleepy = expression === 'sleepy' || expression === 'cheeky';
    const surprised = expression === 'surprised';
    return `<g class="ghost-character ghost-character--nokoro" filter="url(#${id}-rim)">
      <ellipse class="ghost-cast-glow" cx="0" cy="93" rx="70" ry="15" fill="#806FE7" opacity=".2" filter="url(#${id}-soft)"/>
      <path class="ghost-tail ghost-tail--left" d="M-57 33
        C-61 49 -79 55 -73 70
        C-67 84 -82 97 -69 112
        C-52 104 -36 91 -31 75
        C-26 59 -35 49 -21 39Z" fill="url(#${id}-body)" opacity=".73"/>
      <path class="ghost-tail ghost-tail--middle" d="M-31 42
        C-34 62 -14 72 -20 90
        C-25 105 -10 121 1 132
        C13 116 27 103 20 87
        C14 72 32 59 28 41Z" fill="url(#${id}-body)" opacity=".82"/>
      <path class="ghost-tail ghost-tail--right" d="M21 39
        C35 50 28 64 43 72
        C57 80 49 93 67 103
        C77 86 70 72 62 58
        C55 46 61 36 57 31Z" fill="url(#${id}-body)" opacity=".68"/>
      <path class="ghost-body-shape" d="M0 -74 C-51 -74 -69 -33 -62 11 C-57 45 -38 66 0 68 C38 66 57 45 62 11 C69 -33 51 -74 0 -74Z" fill="url(#${id}-body)" opacity=".86" stroke="#C8F8FF" stroke-width="3"/>
      <path d="M-43 -48 Q-1 -69 41 -43 Q7 -55 -15 19 Q-38 2 -43 -48Z" fill="url(#${id}-glow)" opacity=".66"/>
      ${mistRuff()}
      <path class="ghost-crest" d="M0 -62
        A20 20 0 1 0 0 -22
        A20 20 0 1 0 0 -62Z
        M6 -56
        A14 14 0 1 0 6 -28
        A14 14 0 1 0 6 -56Z"
        fill="url(#${id}-gold)" fill-rule="evenodd"/>
      <g class="ghost-eyes ghost-blink">
        ${eye(-22, 1, { sleepy, surprised })}${eye(22, 1, { sleepy, surprised })}
      </g>
      ${mouth(2, expression)}
      ${hand(-80, 26, -1, false, false).replaceAll('HAND_GRADIENT', `${id}-body`)}
      ${hand(80, 19, 1, false, false).replaceAll('HAND_GRADIENT', `${id}-body`)}
    </g>`;
  }

  function nokomaru(id, expression) {
    const sleepy = expression === 'sleepy';
    const surprised = expression === 'surprised';
    const motes = [[-91, -45, 5], [-88, 40, 3.6], [-46, 92, 4.4], [49, 89, 3.4], [94, 31, 5.3], [82, -52, 3.8]];
    return `<g class="ghost-character ghost-character--nokomaru" filter="url(#${id}-rim)">
      <ellipse class="ghost-cast-glow" cx="0" cy="124" rx="92" ry="18" fill="#D66DE9" opacity=".23" filter="url(#${id}-soft)"/>
      <g class="ghost-cape">
        <g class="ghost-cape-layer ghost-cape-layer--back">
          <path class="ghost-tail ghost-tail--1" d="M-70 21 C-79 43 -96 75 -88 110 C-75 105 -59 89 -50 68 C-44 54 -42 37 -38 28 C-49 23 -59 21 -70 21Z" fill="url(#${id}-body)" opacity=".6" stroke="#AA8DEB" stroke-width="1.5"/>
          <path class="ghost-tail ghost-tail--5" d="M39 28 C45 45 54 68 69 87 C75 95 82 101 88 104 C96 78 85 48 70 21 C59 22 48 24 39 28Z" fill="url(#${id}-body)" opacity=".64" stroke="#D18EEA" stroke-width="1.5"/>
        </g>
        <g class="ghost-cape-layer ghost-cape-layer--middle">
          <path class="ghost-tail ghost-tail--2" d="M-54 43 C-60 69 -61 103 -43 127 C-31 119 -21 98 -18 72 C-16 59 -19 50 -28 45 C-36 41 -45 40 -54 43Z" fill="url(#${id}-body)" opacity=".78" stroke="#B89CF2" stroke-width="1.7"/>
          <path class="ghost-tail ghost-tail--4" d="M19 56 C22 83 29 108 44 119 C55 99 58 71 51 42 C42 40 33 43 26 48 C22 51 20 53 19 56Z" fill="url(#${id}-body)" opacity=".74" stroke="#D79BEF" stroke-width="1.7"/>
        </g>
        <path class="ghost-tail ghost-tail--3" d="M-27 58 C-25 89 -18 122 0 140 C18 119 25 88 27 58 C18 52 9 50 0 50 C-10 50 -19 52 -27 58Z" fill="url(#${id}-body)" opacity=".92" stroke="#E0A3F3" stroke-width="1.9"/>
      </g>
      <path class="ghost-body-shape" d="M0 -79 C-47 -79 -65 -53 -67 -22 C-69 8 -75 40 -88 73 C-67 87 -37 94 0 94 C37 94 67 87 88 73 C75 40 69 8 67 -22 C65 -53 47 -79 0 -79Z" fill="url(#${id}-body)" opacity=".9" stroke="#F4B5FF" stroke-width="3.4"/>
      <path d="M-51 -47 Q1 -78 50 -45 Q8 -62 -17 21 Q-45 -1 -51 -47Z" fill="url(#${id}-glow)" opacity=".62"/>
      <g class="ghost-crown">
        <path d="M-31 -68 C-52 -99 -23 -111 -10 -79 C-24 -91 -33 -82 -31 -68Z" fill="none" stroke="url(#${id}-gold)" stroke-width="8" stroke-linecap="round"/>
        <path d="M31 -68 C52 -99 23 -111 10 -79 C24 -91 33 -82 31 -68Z" fill="none" stroke="url(#${id}-gold)" stroke-width="8" stroke-linecap="round"/>
        <path class="ghost-crest" d="M0 -65 C-22 -48 -17 -19 0 -10 C17 -19 22 -48 0 -65Z M0 -51 C8 -39 7 -27 0 -22 C-7 -27 -8 -39 0 -51Z" fill="url(#${id}-gold)" fill-rule="evenodd"/>
      </g>
      <g class="ghost-eyes ghost-blink">
        ${eye(-25, 5, { sleepy, surprised, starPupil: !sleepy })}${eye(25, 5, { sleepy, surprised, starPupil: !sleepy })}
      </g>
      ${mouth(3, expression)}
      ${hand(-94, 25, -1, true, false).replaceAll('HAND_GRADIENT', `${id}-body`)}
      ${hand(91, -8, 1, true, true).replaceAll('HAND_GRADIENT', `${id}-body`)}
      <g class="ghost-motes">${motes.map((mote, index) => `<circle class="ghost-mote ghost-mote--${index + 1}" cx="${mote[0]}" cy="${mote[1]}" r="${mote[2]}" fill="${index % 2 ? '#F8E598' : '#D9B8FF'}"/>`).join('')}</g>
    </g>`;
  }

  function svg(options = {}) {
    const stage = stageNumber(options.stage);
    const size = Math.max(24, finite(options.size, 180));
    const flip = options.flip ? -1 : 1;
    const hue = Math.max(-28, Math.min(28, finite(options.hueJitter ?? options.hue, 0)));
    const expression = expressionName(options.expression);
    const id = `gcg-${++instance}`;
    const names = ['', 'NOKO', 'NOKORO', 'NOKOMARU'];
    const art = stage === 1 ? noko(id, expression) : stage === 2 ? nokoro(id, expression) : nokomaru(id, expression);
    const className = ['ghost-svg', `ghost-svg--stage-${stage}`, `ghost-svg--${names[stage].toLowerCase()}`, options.className || '']
      .filter(Boolean).map(esc).join(' ');
    const label = options.label === false ? '' : esc(options.label || names[stage]);
    const role = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';

    return `<svg class="${className}" data-ghost-stage="${stage}" data-ghost-name="${names[stage]}"
      viewBox="-125 -125 250 270" width="${size}" height="${Math.round(size * 1.08)}" ${role}
      style="--ghost-hue:${hue}deg;--ghost-float-phase:${finite(options.phase, 0)}s;filter:hue-rotate(var(--ghost-hue))">
      ${defs(id, stage)}
      <g class="ghost-float" style="transform-origin:0 10px">
        <g class="ghost-flip" transform="scale(${flip} 1)">${art}</g>
      </g>
    </svg>`;
  }

  function silhouette(stage = 1, size = 180) {
    const markup = svg({ stage, size, label: false, expression: 'sleepy' });
    return markup.replace('class="ghost-svg ', 'class="ghost-svg ghost-svg--silhouette ');
  }

  return Object.freeze({
    svg,
    render: svg,
    silhouette,
    noko: options => svg({ ...options, stage: 1 }),
    nokoro: options => svg({ ...options, stage: 2 }),
    nokomaru: options => svg({ ...options, stage: 3 }),
  });
})();
