/* ============================================================
   GHOST COUNT — persistent settings and collection progress
   Stores one small, validated JSON document. Photos never enter it.
   ============================================================ */
'use strict';

const State = (() => {
  const KEY = 'eslCounting.v1';
  const DEFAULTS = Object.freeze({
    settings: Object.freeze({
      range: '1-6',
      speechMode: 'stt',
      tts: true,
      volume: 0.7,
      difficulty: 'number',
    }),
    progress: Object.freeze({
      family: '01',
      stage: 1,
      streak: 0,
      unlockedFamilies: Object.freeze(['01']),
      discovered: Object.freeze({ '01': Object.freeze([true, false, false]) }),
    }),
  });

  let current = makeDefaults();

  function makeDefaults() {
    return {
      settings: { ...DEFAULTS.settings },
      progress: {
        ...DEFAULTS.progress,
        unlockedFamilies: [...DEFAULTS.progress.unlockedFamilies],
        discovered: { '01': [...DEFAULTS.progress.discovered['01']] },
      },
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function sanitize(raw) {
    const clean = makeDefaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;

    const settings = raw.settings;
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      const range = settings.range === undefined ? settings.numberRange : settings.range;
      if (['1-5', '1-6', '1-10'].includes(range)) {
        clean.settings.range = range;
      }
      if (['stt', 'tap'].includes(settings.speechMode)) {
        clean.settings.speechMode = settings.speechMode;
      }
      const tts = settings.tts === undefined ? settings.ttsEnabled : settings.tts;
      if (typeof tts === 'boolean') {
        clean.settings.tts = tts;
      }
      clean.settings.volume = finiteNumber(settings.volume, clean.settings.volume, 0, 1);
      const difficulty = settings.difficulty === undefined ? settings.languageTier : settings.difficulty;
      if (['number', 'ghosts', 'thereAre'].includes(difficulty)) {
        clean.settings.difficulty = difficulty;
      }
    }

    const progress = raw.progress;
    if (progress && typeof progress === 'object' && !Array.isArray(progress)) {
      clean.progress.family = /^\d{2}$/.test(progress.family) ? progress.family : '01';
      clean.progress.stage = Math.round(finiteNumber(progress.stage, 1, 1, 3));
      clean.progress.streak = Math.round(finiteNumber(progress.streak, 0, 0, 3));

      const unlocked = Array.isArray(progress.unlockedFamilies)
        ? progress.unlockedFamilies.filter(id => typeof id === 'string' && /^\d{2}$/.test(id))
        : [];
      clean.progress.unlockedFamilies = [...new Set(['01', ...unlocked])];

      const discovered = {};
      if (progress.discovered && typeof progress.discovered === 'object' && !Array.isArray(progress.discovered)) {
        Object.keys(progress.discovered).forEach(id => {
          const stages = progress.discovered[id];
          if (/^\d{2}$/.test(id) && Array.isArray(stages)) {
            discovered[id] = [0, 1, 2].map(index => stages[index] === true);
          }
        });
      }
      discovered['01'] = discovered['01'] || [true, false, false];
      discovered['01'][0] = true;
      for (let index = 0; index < clean.progress.stage; index += 1) discovered['01'][index] = true;
      clean.progress.discovered = discovered;
    }
    return clean;
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
      return true;
    } catch (error) {
      return false;
    }
  }

  function load() {
    try {
      const stored = localStorage.getItem(KEY);
      current = stored ? sanitize(JSON.parse(stored)) : makeDefaults();
    } catch (error) {
      current = makeDefaults();
    }
    return get();
  }

  function get() {
    return clone(current);
  }

  function save(next) {
    current = sanitize(next);
    write();
    return get();
  }

  function update(updater) {
    const draft = get();
    const replacement = typeof updater === 'function' ? updater(draft) : updater;
    if (replacement === undefined) return save(draft);
    if (replacement && typeof replacement === 'object') {
      return save({
        ...draft,
        ...replacement,
        settings: { ...draft.settings, ...(replacement.settings || {}) },
        progress: { ...draft.progress, ...(replacement.progress || {}) },
      });
    }
    return save(replacement);
  }

  function setSetting(name, value) {
    const aliases = { numberRange: 'range', ttsEnabled: 'tts', languageTier: 'difficulty' };
    name = aliases[name] || name;
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS.settings, name)) return get();
    return update(draft => {
      draft.settings[name] = value;
      return draft;
    });
  }

  function recordGuess(isLucky) {
    let shouldEvolve = false;
    update(draft => {
      draft.progress.streak = isLucky ? Math.min(3, draft.progress.streak + 1) : 0;
      shouldEvolve = isLucky && draft.progress.streak === 3 && draft.progress.stage < 3;
      return draft;
    });
    return { ...get(), shouldEvolve };
  }

  function evolve() {
    let evolved = false;
    update(draft => {
      if (draft.progress.streak >= 3 && draft.progress.stage < 3) {
        draft.progress.stage += 1;
        draft.progress.streak = 0;
        draft.progress.discovered['01'][draft.progress.stage - 1] = true;
        evolved = true;
        if (draft.progress.stage === 3 && !draft.progress.unlockedFamilies.includes('02')) {
          draft.progress.unlockedFamilies.push('02');
          draft.progress.discovered['02'] = draft.progress.discovered['02'] || [false, false, false];
        }
      }
      return draft;
    });
    return { ...get(), evolved };
  }

  function resetProgress() {
    current.progress = makeDefaults().progress;
    write();
    return get();
  }

  function resetAll() {
    current = makeDefaults();
    try { localStorage.removeItem(KEY); } catch (error) { /* Storage may be unavailable. */ }
    return get();
  }

  load();

  return {
    KEY,
    defaults: makeDefaults,
    load,
    get,
    getState: get,
    save,
    update,
    setSetting,
    recordGuess,
    evolve,
    resetProgress,
    resetAll,
  };
})();
