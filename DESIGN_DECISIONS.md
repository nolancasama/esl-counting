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
