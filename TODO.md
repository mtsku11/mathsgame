# Number Crew build backlog

Status: Phase 1 playable-slice and Phase 2 full-mission software gates are verified. The public GitHub Pages build is live; its deployment passed 15 unit tests and all 20 hosted Chromium scenarios, including an offline reload, complete mission, cargo progress, and destination reveals, on 29 September 2026. Classroom access acceptance and physical XAC verification remain open. Unchecked items require implementation or further acceptance evidence; they do not necessarily mean the code is absent.

## Confirm classroom facts

- [x] Confirm three/four pupils share one screen and one XAC, with two inputs each.
- [x] Confirm counting 1–5 and addition within 10.
- [x] Confirm the classroom computer is a Windows PC.
- [ ] Record available switch count/models, Windows/browser versions, USB/Bluetooth, and display.
- [ ] Record age range, suitable theme/tone, per-pupil maths allocation, and helpful visual/audio supports.
- [ ] Confirm whether teacher-led spoken prompts are sufficient or local recorded narration is required.
- [ ] Confirm lesson date, setup time, session length, internet access, and offline/browser-storage constraints.

Use PLAN.md's provisional defaults for independent software work while the remaining details are unresolved. Preserve the confirmed single-XAC, 3–4-pupil scope.

## Phase 0 — Input proof

- [x] Create the minimal TypeScript/Vite app without replacing the handoff documents.
- [x] Add the required scripts, locked dependencies, and test input provider.
- [x] Build raw gamepad diagnostics and a two-actions-per-pupil calibration wizard.
- [x] Review SwitchJam's working XAC path; record findings and Marc's reported Bluetooth success in docs/HARDWARE-TEST.md.
- [x] Extend diagnostics with mapping, button values/count, raw axes, and connection history; simulate three/four-pupil shared-controller disconnect/reconnect.
- [ ] Inspect actual idle-input readings during physical testing before considering axis bindings or held-at-discovery suppression.
- [x] Prevent duplicate bindings and require press/release checks.
- [x] Implement per-pupil edges, cooldown, release arming, and keyboard/touch alternatives.
- [ ] Physically verify six/eight switches for three/four pupils on the single classroom XAC/computer.
- [x] Record hardware evidence or NOT TESTED in docs/HARDWARE-TEST.md.

## Phase 1 — Playable slice

- [x] Implement Count 1–5 with deterministic generation.
- [x] Build stationary player panels and shared contribution feedback (implemented directly for three/four pupils, exceeding the initial two-panel engineering slice).
- [x] Implement one complete round, retries, teacher Next, pause, and input lockout across transitions.
- [x] Verify simultaneous pupil actions and held/bouncing inputs with behaviour tests.
- [x] Verify the visible round using Playwright and inspect console/focus/layout; full classroom layout acceptance remains in Phase 3.

## Phase 2 — Full mission

- [x] Add six rounds, three destinations, group stars, finale, and replay.
- [x] Add addition within 5/10 and per-pupil settings.
- [x] Add Help, Pass, correct round completion, and session-only teacher outcomes.
- [x] Add optional automatic transitions with pausable delay.
- [x] Verify generator properties, scoring, and complete mixed-difficulty missions.

## Phase 3 — Classroom access

- [x] Add three/four-pupil fixed layouts and enlarged turn-taking mode.
- [x] Add explicit reconnect revalidation and blur/visibility pause recovery.
- [ ] Add reduced motion, quiet settings, local sound effects, and restrained accessible status.
- [x] Persist anonymous setup preferences; bindings remain session-only and new sessions require calibration.
- [ ] Complete remaining access acceptance: actual browser 200% zoom, screen-reader announcements, visibility-change recovery, and unrelated-controller disconnect.
- [x] Add separate effects-volume control in setup and pause; verify persistence, quiet/zero muting, gain scaling, and keyboard access.
- [x] Complete cargo flights, six-part round progress, and distinct destination reveals with static reduced-motion equivalents.
- [x] Fit practice and mission at 1280×720 with 96px answer targets, picture answers, Help feedback, and teacher controls visible together.
- [ ] Physically verify both three- and four-pupil play on the requested single shared XAC.
- [ ] Check legibility and physical switch correspondence on the actual classroom display.

## Phase 4 — Delivery

- [x] Bundle all assets locally and implement production precaching with accurate offline readiness.
- [x] Verify production offline reload and a complete mission; verify updates wait between sessions (Chromium on development Mac; classroom PC still untested).
- [ ] Write docs/TEACHER-GUIDE.md and complete the tested/untested configuration record.
- [ ] Complete the physical classroom checklist and a lesson-length rehearsal with teacher feedback.
- [x] Run typecheck, unit tests, browser tests, and production build (28 September 2026; rerun for delivery after further changes).
- [ ] Obtain a read-only review of the final diff and resolve material findings.
- [ ] Deliver source, lockfile, dist artifact, teacher guide, and clear remaining limitations.
- [x] Authorise GitHub Pages at `https://mtsku11.github.io/mathsgame/` in public `mtsku11/mathsgame` (29 September 2026).
- [x] Publish and verify the hosted browser suite and offline mission (20/20 at `https://mtsku11.github.io/mathsgame/`, 29 September 2026).

## Deferred

- Extra maths types, themes, independent two-switch settings navigation, one-switch scanning, competition, and remote multiplayer.
- No deferred item is part of the first release unless the teacher's confirmed needs require a recorded scope change.
