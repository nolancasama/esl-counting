# Current State

## Status
Ghost Count is implemented as a dependency-free static web game and is ready for review.

## What Exists
- Camera and procedural demo-scene rounds with local-only image handling.
- Person-aware ghost placement that clusters most ghosts just outside the detected silhouette while excluding bodies, faces, and heads.
- Ghosts render fully above the frozen photo with no person occlusion layer.
- Speech-first guessing in one lower-third panel reading question -> three answers -> microphone. All three number options stay on screen as an inert vocabulary prompt and become clickable only as a rescue for unsupported or unavailable recognition, or in teacher-controlled **Tap only** mode.
- Tappable, count-once ghosts, results, progression/evolution, Ghost Book, settings, sound, and persistence.
- Playwright E2E coverage for the game loop, speech and rescue input states, placement safety, counting idempotence, offline behavior, and screenshots.

## Current Work
The person-occlusion removal and speech-first guessing changes are delivered for review.

## Known Issues
None open. Fixed 2026-09-03: at the final evolution stage the lucky-guess streak never reset, pinning the odds at 85% and producing runs of twenty correct guesses; consecutive correct guesses are now capped at three.

## Next Steps
Review the generated screenshots and deploy the static files from the repository root when approved.
