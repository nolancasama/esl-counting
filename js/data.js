/* ============================================================
   GHOST COUNT - game and ghost-family data
   Add future ghost families here; gameplay reads this module.
   ============================================================ */
'use strict';

const DATA = (() => {
  const NUMBER_WORDS = Object.freeze([
    'zero', 'one', 'two', 'three', 'four', 'five',
    'six', 'seven', 'eight', 'nine', 'ten',
  ]);

  const NUMBER_ALIASES = Object.freeze({
    1: Object.freeze(['one', 'won']),
    2: Object.freeze(['two', 'too', 'to']),
    3: Object.freeze(['three', 'free', 'tree', 'sri']),
    4: Object.freeze(['four', 'for', 'fore']),
    5: Object.freeze(['five', 'fife']),
    6: Object.freeze(['six', 'sicks']),
    7: Object.freeze(['seven']),
    8: Object.freeze(['eight', 'ate']),
    9: Object.freeze(['nine']),
    10: Object.freeze(['ten', 'tan']),
  });

  const FAMILIES = Object.freeze([
    Object.freeze({
      id: 'family-01', number: 1, name: 'THE PEEKER LINE', concept: 'peeker',
      implemented: true, unlockAfter: null,
      stages: Object.freeze([
        Object.freeze({
          stage: 1, id: 'noko', name: 'NOKO',
          title: 'Mischievous Spirit',
          colors: Object.freeze(['#8FF3E0', '#4FD3C8']),
          description: 'A curious little spirit that loves to peek into photographs.',
        }),
        Object.freeze({
          stage: 2, id: 'nokoro', name: 'NOKORO',
          title: 'Moonlit Trickster',
          colors: Object.freeze(['#9BE7F5', '#7C6BE0']),
          description: 'Its floating mitts and three tails are always up to something.',
        }),
        Object.freeze({
          stage: 3, id: 'nokomaru', name: 'NOKOMARU',
          title: 'Regal Wisp',
          colors: Object.freeze(['#5B4BC4', '#C86BE8']),
          description: 'A confident spirit crowned with moonlight and orbiting motes.',
        }),
      ]),
    }),
    Object.freeze({
      id: 'family-02', number: 2, name: 'CANDLE SPIRITS', concept: 'candle',
      implemented: false, unlockAfter: 'family-01',
      stages: Object.freeze([null, null, null]),
    }),
    Object.freeze({
      id: 'family-03', number: 3, name: 'LANTERN GHOSTS', concept: 'lantern',
      implemented: false, unlockAfter: 'family-02',
      stages: Object.freeze([null, null, null]),
    }),
    Object.freeze({
      id: 'family-04', number: 4, name: 'PAPER GHOSTS', concept: 'paper',
      implemented: false, unlockAfter: 'family-03',
      stages: Object.freeze([null, null, null]),
    }),
  ]);

  const NUMBER_RANGES = Object.freeze({
    '1-5': Object.freeze({ min: 1, max: 5, label: '1-5' }),
    '1-6': Object.freeze({ min: 1, max: 6, label: '1-6' }),
    '1-10': Object.freeze({ min: 1, max: 10, label: '1-10' }),
  });

  const DEFAULT_SETTINGS = Object.freeze({
    numberRange: '1-6',
    speechMode: 'preferred',
    tts: true,
    volume: 0.8,
    languageTier: 'number',
  });

  const LANGUAGE_TIERS = Object.freeze({
    number: Object.freeze({ id: 'number', example: 'Five!' }),
    nounPhrase: Object.freeze({ id: 'nounPhrase', example: 'Five ghosts!' }),
    sentence: Object.freeze({ id: 'sentence', example: 'There are five ghosts.' }),
  });

  function getFamily(id) {
    return FAMILIES.find(family => family.id === id) || null;
  }

  function getStage(familyId, stage) {
    const family = getFamily(familyId);
    const index = Math.max(1, Math.min(3, Number(stage) || 1)) - 1;
    return family && family.stages[index] ? family.stages[index] : null;
  }

  function numberWord(number) {
    return NUMBER_WORDS[Number(number)] || String(number);
  }

  return Object.freeze({
    FAMILIES,
    NUMBER_WORDS,
    NUMBER_ALIASES,
    NUMBER_RANGES,
    DEFAULT_SETTINGS,
    LANGUAGE_TIERS,
    STORAGE_KEY: 'eslCounting.v1',
    getFamily,
    getStage,
    numberWord,
  });
})();
