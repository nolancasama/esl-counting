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

Speech recognition is progressive enhancement. Number buttons are always available.

## Files

- `js/game.js` — screen state machine and round flow
- `js/scene.js` — local placement analysis and procedural demo scenes
- `js/ghosts.js` / `js/data.js` — original inline SVG ghost family and extensible data
- `js/speech.js` / `js/sfx.js` — browser speech and synthesized WebAudio
- `js/state.js` — settings and progress persistence

No build step or third-party dependencies are required.
