/* ============================================================
   GHOST COUNT — friendly English speech input and output
   Recognition is the primary guess input; tapping is its rescue path.
   ============================================================ */
'use strict';

const Speech = (() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const WORDS = Object.freeze(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
  const ALIASES = Object.freeze({
    one: 1, won: 1,
    two: 2, to: 2, too: 2,
    three: 3, free: 3, tree: 3, sri: 3,
    four: 4, for: 4, fore: 4,
    five: 5, fife: 5,
    six: 6, sicks: 6,
    seven: 7,
    eight: 8, ate: 8,
    nine: 9,
    ten: 10, tan: 10,
  });
  const TIERS = Object.freeze({
    number: Object.freeze({ id: 'number', example: 'Five!' }),
    ghosts: Object.freeze({ id: 'ghosts', example: 'Five ghosts!' }),
    thereAre: Object.freeze({ id: 'thereAre', example: 'There are five ghosts!' }),
  });

  let recognition = null;
  let listening = false;
  let stopping = false;
  let callbacks = {};
  let restartTimer = 0;
  /* Recognition ends itself after a stretch of silence. Restarting is normal and
     must not be mistaken for failure, but a recognizer that never hears anything
     at all is not working - surface the tap rescue rather than listening forever. */
  const TERMINAL_ERRORS = ['not-allowed', 'service-not-allowed', 'audio-capture'];
  const EMPTY_SESSION_LIMIT = 3;
  let emptySessions = 0;
  let ttsEnabled = true;

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9'\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseNumber(text) {
    const normalized = normalize(text);
    if (!normalized) return null;
    const tokens = normalized.split(' ');
    for (let index = 0; index < tokens.length; index += 1) {
      if (/^(?:10|[1-9])$/.test(tokens[index])) return Number(tokens[index]);
      if (Object.prototype.hasOwnProperty.call(ALIASES, tokens[index])) return ALIASES[tokens[index]];
    }
    return null;
  }

  /* All current tiers accept shorter and longer target forms. The tier
     metadata is kept here so stricter classroom modes can be added later. */
  function matchAnswer(text, tier = 'number') {
    const normalized = normalize(text);
    const number = parseNumber(normalized);
    if (number === null) return null;
    return {
      number,
      transcript: normalized,
      tier: Object.prototype.hasOwnProperty.call(TIERS, tier) ? tier : 'number',
      hasGhostNoun: /\bghosts?\b/.test(normalized),
      hasThereAre: /\bthere\s+(?:are|is)\b/.test(normalized),
    };
  }

  function configure(options) {
    callbacks = typeof options === 'function' ? { onNumber: options } : (options || {});
  }

  function beginRecognizer() {
    if (!listening || stopping || !Recognition) return;
    try {
      const recognizer = new Recognition();
      recognition = recognizer;
      recognizer.lang = 'en-US';
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 5;
      let sawTranscript = false;
      recognizer.onresult = event => {
        let fallbackTranscript = '';
        for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
          const result = event.results[resultIndex];
          for (let altIndex = 0; altIndex < result.length; altIndex += 1) {
            const transcript = result[altIndex].transcript || '';
            if (transcript.trim()) sawTranscript = true;
            if (!fallbackTranscript) fallbackTranscript = transcript;
            const match = matchAnswer(transcript, callbacks.tier);
            if (match) {
              if (callbacks.onTranscript) callbacks.onTranscript(transcript, result.isFinal);
              if (callbacks.onNumber) callbacks.onNumber(match.number, match);
              return;
            }
          }
        }
        if (fallbackTranscript && callbacks.onTranscript) callbacks.onTranscript(fallbackTranscript, false);
      };
      recognizer.onerror = event => {
        /* Only a permission or hardware failure means speech cannot work. Transient
           errors such as no-speech or network fall through to onend and restart. */
        if (!TERMINAL_ERRORS.includes(event && event.error)) return;
        listening = false;
        if (callbacks.onUnavailable) callbacks.onUnavailable();
      };
      recognizer.onend = () => {
        if (recognition !== recognizer) return;
        recognition = null;
        if (listening && !stopping) {
          emptySessions = sawTranscript ? 0 : emptySessions + 1;
          if (emptySessions >= EMPTY_SESSION_LIMIT) {
            listening = false;
            if (callbacks.onUnavailable) callbacks.onUnavailable();
            return;
          }
          clearTimeout(restartTimer);
          restartTimer = setTimeout(beginRecognizer, 250);
        } else if (callbacks.onEnd) {
          callbacks.onEnd();
        }
      };
      recognizer.start();
    } catch (error) {
      recognition = null;
      listening = false;
      if (callbacks.onUnavailable) callbacks.onUnavailable();
    }
  }

  function startListening(options) {
    stopListening();
    if (!Recognition) {
      configure(options);
      if (callbacks.onUnavailable) callbacks.onUnavailable();
      return false;
    }
    configure(options);
    emptySessions = 0;
    listening = true;
    stopping = false;
    beginRecognizer();
    return true;
  }

  function stopListening() {
    clearTimeout(restartTimer);
    restartTimer = 0;
    listening = false;
    stopping = true;
    const active = recognition;
    recognition = null;
    if (active) {
      try { active.stop(); } catch (error) { /* It may already have stopped. */ }
    }
    stopping = false;
  }

  function abortListening() {
    clearTimeout(restartTimer);
    restartTimer = 0;
    listening = false;
    stopping = true;
    const active = recognition;
    recognition = null;
    if (active) {
      active.onend = null;
      active.onerror = null;
      active.onresult = null;
      try { active.abort(); } catch (error) { /* It may already have stopped. */ }
    }
    stopping = false;
  }

  function chooseVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(voice => /^en-US$/i.test(voice.lang))
      || voices.find(voice => /^en(?:-|$)/i.test(voice.lang))
      || null;
  }

  function speak(text, options = {}) {
    if (!ttsEnabled || options.enabled === false || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return Promise.resolve(false);
    }
    return new Promise(resolve => {
      if (options.interrupt !== false) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      const voice = chooseVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = 'en-US';
      utterance.rate = Number.isFinite(options.rate) ? options.rate : 0.85;
      utterance.pitch = Number.isFinite(options.pitch) ? options.pitch : 1;
      utterance.volume = Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume)) : 1;
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      window.speechSynthesis.speak(utterance);
    });
  }

  function cancel() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function setEnabled(enabled) {
    ttsEnabled = enabled !== false;
    if (!ttsEnabled) cancel();
  }

  function numberWord(number) {
    return WORDS[number] || String(number);
  }

  return {
    TIERS,
    supported: () => !!Recognition,
    recognitionSupported: () => !!Recognition,
    normalize,
    parseNumber,
    matchNumber: parseNumber,
    matchAnswer,
    startListening,
    stopListening,
    abortListening,
    startRecognition: startListening,
    stopRecognition: stopListening,
    abortRecognition: abortListening,
    isListening: () => listening,
    speak,
    speakNumber: number => speak(`${numberWord(number)}!`),
    speakTotal: number => speak(`${numberWord(number)} ghosts!`),
    cancel,
    setEnabled,
    numberWord,
  };
})();
