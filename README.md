# Ghost Count

A dependency-free, privacy-first ESL counting game for elementary learners. Take a photo (or use a built-in demo scene), make a playful guess, reveal hidden ghosts, and tap them while counting aloud.

## Run

Open `index.html` directly, or serve the folder with any static server. Add `?demo=1` to bypass camera access and use the procedural scene generator.

The game makes no network requests. Camera frames stay in memory only, are processed locally, and are discarded between rounds. The single `localStorage` entry `eslCounting.v1` contains settings and ghost progress only.

## Controls

- **Play:** Starts the camera/demo loop.
- **Ghost Book:** Shows the discovered NOKO evolution stages and future family silhouettes.
- **Gear:** Number range, speech input, spoken prompts, volume, and progress reset.
- **Evolution:** Tap anywhere to skip the short sequence.

The microphone panel speaks to the learner in Japanese; the question, the numerals and the words the learner says stay in English, since English is what the game teaches. Speech recognition stays set to `en-US`.

Speech is the primary guessing input when recognition is available and enabled. The three number options are always shown so learners can see what to say, but they are not tappable until speech cannot carry the round - when recognition is unsupported or unavailable, or when a teacher selects **Tap only** in Settings.

## Files

- `js/game.js` — screen state machine and round flow
- `js/scene.js` — local placement analysis and procedural demo scenes
- `js/ghosts.js` / `js/data.js` — original inline SVG ghost family and extensible data
- `js/speech.js` / `js/sfx.js` — browser speech and synthesized WebAudio
- `js/state.js` — settings and progress persistence

No build step or third-party dependencies are required.
