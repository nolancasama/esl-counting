# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

## 2026-09-03 — Ghosts render above people

Person occlusion was removed so every ghost is drawn fully on top of the frozen photo and remains easy to find and tap. Person detection still drives proximity clustering beside and above the silhouette, while the person and head masks keep ghost footprints off bodies and faces. Previously, a feathered person-cutout canvas was composited above the ghost layer to make selected ghosts appear behind a person.

## 2026-09-03 — Guessing is speech-first

Speech recognition is the sole guessing affordance when it is available and permitted. Number buttons are a capability rescue when recognition is unsupported, becomes unavailable, or a teacher selects **Tap only**. Previously, speech and number buttons were offered equally on every guess screen.

## 2026-09-03 — Silence does not demote speech

Only a permission or hardware failure (`not-allowed`, `service-not-allowed`, `audio-capture`) drops the learner to the number-button rescue. Transient recognition errors such as `no-speech` or `network` restart the recognizer instead, because browsers end a recognition session after a few seconds of quiet and a child thinking about the answer produces exactly that. As a safety net, three consecutive sessions that hear nothing at all are treated as speech not working and do surface the rescue. Rejected alternative: treating every error and every session end as unavailability, which demoted a hesitating child to buttons on their first pause.

## 2026-09-03 — The number options stay on screen, inert

All three number options are always visible on the guess screen, even while speech owns the round, labelled **Say one of these** and rendered non-interactive. A learner cannot say a number they have not been shown, so removing the options entirely took away the vocabulary prompt along with the buttons. They become tappable, and relabel to **Tap a number**, only on the rescue path. Rejected alternative: rendering nothing but the microphone while speech is available.

## 2026-09-03 — The guess screen is one activity, not two HUD regions

The question, the three answers and the microphone are now a single translucent panel anchored to the lower third, reading top to bottom as question → possible answers → speak one. Previously "HOW MANY GHOSTS?" sat in a box at the top of the screen and the microphone and numbers sat at the bottom, so the question and its possible answers were at opposite ends and the relationship between them was left for the child to infer.

Type hierarchy follows the language task rather than the input mechanism: the question is the largest element, the numerals next, and the microphone copy and listening state smallest. The microphone was previously the most prominent element on the screen; it is a way to answer, not the thing being asked.

Two supporting choices fall out of this. The separate "Say one of these" / "Tap a number" label between the question and the numbers was removed — it wedged a third text line into the unit the redesign exists to tighten, and the microphone panel already states the mode in every state. And the panel is bottom-anchored with `.feedback-line:empty { display: none; }`, so revealing "Three? Let's see!" or dropping into the tap rescue grows the panel upward and moves the numbers and microphone by zero pixels, instead of shifting them under the child's gaze at the moment they are choosing.
