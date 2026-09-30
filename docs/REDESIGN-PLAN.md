# Number Crew — game-quality redesign plan

Status: **DRAFT — waiting for the teacher/owner to choose design direction A, B or C.** Drafted 30 September 2026.
Design canvas (private): https://claude.ai/artifact/DXygdyqpUNYbeWxexpc3nc — Star Pilots (A), Bot Builders (B), Glow Reef (C).

## 1. Goal

The current build works, but it looks like a web form. The redesign must look and behave like a professional children's console game while keeping every access and classroom guarantee already built and tested.

Owner requirements (30 September 2026):

- Professional-grade look and feel that pupils recognise as a real game.
- Xbox Adaptive Controller (XAC), two switches per pupil, one shared screen.
- **1–4 players** (scope change: was 3–4). Record in PLAN.md section 1 during Phase 0.
- Very simple maths (count 1–5, add within 5/10), cooperative, fun.
- Opus orchestrates and reviews; Sonnet 5.5 builds one phase at a time.

Non-negotiables carried over from AGENTS.md/PLAN.md: two directly selectable answers per pupil; per-pupil edge/cooldown/arming input filter; untimed cooperative play; no negative scoring; pause preserves state; held inputs never leak between questions; offline after first load; no accounts, analytics or runtime CDN; physical XAC results stay NOT TESTED until observed.

## 2. Keep, extend, replace

| Area | Decision | Why |
| --- | --- | --- |
| `src/game/questions.ts`, `session.ts`, `transition.ts` | Keep; extend for 1–4 players | Pure, tested logic |
| `src/input/gamepad.ts`, `normalize.ts` | Keep unchanged | Safety-critical and tested |
| `src/offline/*`, `scripts/offline.mjs` | Keep; add fonts/audio to the precache | Working offline path |
| `src/settings.ts` | Extend: `count` 1–4, new settings (low-stimulation, narration, switch-cap colours), bump storage key to v2 with v1 migration | Loader rejects anything but 3/4 today |
| `src/main.ts` | Split; replace its render layer | `render()` rebuilds the whole DOM with `innerHTML` on every change, which kills animation state |
| `src/style.css`, `src/ui/art.ts` | Replace | New art direction |
| Tests | Keep behaviour tests; update selectors deliberately; add visual and motion tests | Protect access guarantees through the rewrite |

## 3. Technical approach

**Rendering: DOM + inline SVG + CSS, animated with GSAP.** The mockups prove this stack reaches the target look. Native `<button>` answers keep touch, keyboard, screen-reader and existing Playwright coverage. No game engine: PixiJS 8 is the fallback only if the Phase 5 frame-rate budget fails.

| Tool | Version | Use |
| --- | --- | --- |
| `gsap` | 3.15.x (free standard licence) | All motion: timelines, squash/stretch, flights along paths (MotionPathPlugin), stagger |
| `howler` + `@types/howler` | 2.2.4 | Audio sprites, music loop, fades, mobile/autoplay unlock |
| `@fontsource/<chosen fonts>` | 5.3.x (OFL) | Local fonts: A Titan One + Baloo 2; B Lilita One + Rubik; C Fredoka |
| `@axe-core/playwright` | 4.13.x (dev) | Automated accessibility checks per screen |
| Kenney.nl audio packs | CC0 | Default sound effects source, bundled locally |

Architecture rules for builders:

1. **Stage.** Play, check-in, title and finale render inside a fixed 1280×720 logical stage scaled to fit the window (`transform: scale()`, letterboxed with themed background). Layout is authored once in stage pixels, so a 1080p TV, 4K panel and projector show the same composition. Teacher setup and switch setup stay responsive HTML.
2. **Mount once, patch on change.** Each screen and component has `mount()` and `update(state)`. During play, never replace a station's DOM; toggle classes/attributes and let GSAP own transforms. No UI framework.
3. **Events, not polling the DOM.** Game logic emits typed events (`answerCorrect`, `answerTry`, `turnHelped`, `turnPassed`, `roundReady`, `roundStart`, `destinationReached`, `missionComplete`). Views, FX and audio subscribe. Correctness and progress come only from session state, never from animation completion.
4. **One motion module.** `src/ui/fx/motion.ts` wraps GSAP. It honours `prefers-reduced-motion`, the teacher's reduced-motion and low-stimulation settings, and a test mode (`?instant` query or `window.__NC_TEST__`) that completes timelines immediately. Input acknowledgement always remains visible.
5. **Input lock during cutscenes** uses the existing `InputFilter.reset()` arming path; cutscenes never queue presses.
6. **Art as code.** Port the chosen direction's SVG from `design/concepts/<direction>.mjs` into typed functions in `src/ui/art/`. Characters take `(player, mood)` where mood is `idle | cheer | think | sleep | wave-left | wave-right`. Identical count objects within a question; no answer give-away by colour, size or animation.
7. **Budgets.** 60 fps target, never below 45 fps at 1920×1080 with Playwright CDP 4× CPU throttle during a correct-answer celebration; JS ≤ 250 KB gzipped; fonts + audio ≤ 3 MB; no layout shift of answer buttons, ever.

Target file map (builders may refine, but keep responsibilities separate):

```text
src/main.ts                 bootstrap: settings, services, router, input loop
src/app/router.ts           screen lifecycle (mount/unmount, transitions)
src/app/events.ts           typed event bus
src/app/state.ts            app-level state (screen, mode, bindings, session)
src/ui/stage.ts             1280×720 scaler
src/ui/theme.css            tokens for the chosen direction
src/ui/art/*.ts             characters, count objects, goal scene, destinations, icons
src/ui/components/*.ts      station, answerButton, hud, sharedGoal, pauseOverlay, teacherDock
src/ui/screens/*.ts         title, setup, switchSetup, checkIn, play, finale
src/ui/fx/motion.ts         GSAP wrapper + reduced/instant modes
src/ui/fx/particles.ts      capped DOM/SVG particle bursts
src/audio/audio.ts          Howler wrapper, sprite map, unlock, volumes
public/audio/               bundled SFX (and narration if approved)
design/concepts/            mockup sources (art reference, not shipped)
```

## 4. Experience spec (applies to any direction)

Screen flow: **Title → Teacher setup → Switch setup (controller mode) → Crew check-in → Mission (6 rounds, 3 destinations) → Finale**. Replay returns to Crew check-in with the same setup.

| Moment | Visual | Motion (full) | Reduced motion / low stimulation | Sound |
| --- | --- | --- | --- | --- |
| Title | Logo, crew idle in scene | Logo drop-in, idle loops | Static scene | Soft jingle (music setting) |
| Crew check-in | Each character asleep in its station | Left switch: wave left; right switch: wave right; both checked: character wakes, "Ready!" | Instant pose change + tick | Boop per switch |
| Round start | Questions deal into stations | Staggered pop-in (≤ 600 ms), then input arms | Instant | Whoosh |
| Press | Button depresses | 80 ms squash | Same (acknowledgement is required) | Click |
| Correct | Button turns success state with tick; other answer dims | Pop, particle burst, character cheer, item flies to shared goal (≤ 1.2 s) | Item appears at goal; no flight/particles | Chime (pitch rises with shared progress) |
| Try again | Pressed answer stays, soft nudge | Gentle wobble, character "think" | Outline pulse only | Soft neutral tone, never a buzzer |
| Help | Count scaffold numbers appear under objects | Numbers pop one by one | Instant | Optional narration counts aloud |
| Pass | Station rests calmly | Character waves, no item | Instant | None |
| Round ready | Shared goal part completes | Part assembles/lights | Instant | Fanfare (short) |
| Destination (after rounds 2, 4) | Reveal scene | ≤ 5 s cutscene, teacher can skip | Static card | Arrival sting |
| Finale | Whole scene complete, crew celebrates | Dance loop, confetti ≤ 4 s | Static celebration | Finale jingle |

Layouts per player count (stage pixels): 1 player = one large central station; 2 = two stations side by side; 3 and 4 = the chosen direction's 3/4 arrangement (A hub, B columns, C 2×2). Station order left→right matches seating. Answer hit areas ≥ 110 px; numerals ≥ 56 px; prompts ≥ 26 px.

Teacher layer: round pause button (Esc/Space), ghost Help/Pass buttons per station (H/P + player number shortcuts), Next appears only when the round is ready (Enter/N), optional auto-advance. Teacher controls never sit between a pupil and their answers.

New options: **low-stimulation mode** (static background, no particles, softer palette, sounds off except acknowledgements); **switch-cap colours** (teacher sets each on-screen answer button to the physical switch colour, always paired with position and a chevron); **narration** (only if approved in section 8).

## 5. Phases

Each phase runs on branch `redesign`. Builders commit locally after each verified increment and never push. Gates list the evidence the orchestrator checks.

### Phase 0 — Foundations

Deliver: branch; AGENTS.md delegation rule updated (see section 6); PLAN.md 1–4 player scope change; dependencies installed; stage scaler; router + event bus; motion module with instant/reduced modes; fonts local; settings v2 with v1 migration and 1–4 players; session/unit tests for 1 and 2 players; `design/concepts/` copied from the canvas sources.
Gate: `npm run typecheck`, `npm run test`, `npm run test:e2e` green (existing specs may be adapted only where 1–4 players changes them); a placeholder title screen scales correctly at 1280×720, 1920×1080 and 1366×768 (screenshots).

### Phase 1 — Play screen, static fidelity

Deliver: HUD, stations for 1–4 players, characters (all moods), count objects, answer buttons (ready, pressed, correct, try, dim, disabled), teacher ghost buttons, shared-goal scene with six progress states, pause overlay restyle; wired to real session logic with mount-once updates.
Gate: screenshots of 1/2/3/4-player play at 1280×720 and 1920×1080 match the chosen mockup; a full six-round keyboard mission completes; no DOM replacement of stations during a round (test asserts the same element instance before/after an answer).

### Phase 2 — Game feel

Deliver: every moment in the section 4 table except audio; destination cutscenes; finale; particle system with caps; reduced-motion and low-stimulation variants; skip control for cutscenes.
Gate: recorded video/GIF of one round and one destination reveal reviewed; reduced-motion run shows no travel/particles; existing held-input and transition-leak tests pass; frame-rate probe under 4× CPU throttle meets the budget.

### Phase 3 — Sound and voice

Deliver: Howler wrapper, SFX sprite from Kenney CC0 (licence file committed), optional music loop (default off), per-channel volumes, quiet mode, audio unlock on teacher click; narration only if approved.
Gate: unit tests for volume/mute logic; browser test that no audio plays before teacher interaction and none in quiet mode; production build precaches audio; offline mission test still passes.

### Phase 4 — Front-of-house screens

Deliver: title/attract screen; game-styled teacher setup (still plain-language and keyboard-first); switch setup with a visual map of each pupil's two switches and live press lights; Crew check-in replacing practice; finale and teacher summary.
Gate: complete controller-mode simulated flow (existing injected gamepad provider) and keyboard flow; axe-core reports no serious/critical issues on setup, switch setup and pause; 200% zoom on teacher setup keeps every control reachable.

### Phase 5 — Spotlight mode, access and performance

Deliver: enlarged turn mode redesigned as "Spotlight" (one station full stage, others resting at the edges); 1- and 2-player polish; contrast/focus/announcement pass; performance fixes; low-power toggle if needed.
Gate: all browser suites green; axe-core clean on play/check-in; frame-rate and bundle budgets met with numbers recorded in docs/HARDWARE-TEST.md "software checks".

### Phase 6 — Delivery

Deliver: updated teacher guide with new screenshots; hosted tests updated; offline/update tests passing; TODO.md reconciled. Merge to `main` and deploy **only after the owner approves the preview build**.
Gate: `npm run build`, `npm run test:offline` green locally; after approved push, hosted suite green and live screenshots captured.

## 6. Orchestration protocol

- AGENTS.md currently reserves edits for the main agent. The owner's 30 September instruction replaces that for this redesign: **one Sonnet 5.5 builder per phase, sequential, full write access to the repo; the Opus orchestrator reviews and owns plan/TODO updates.** Never two builders at once.
- Builder brief = this plan's section 1–4 + the phase section + the chosen direction's mockup files + the review checklist. Builders run the gate commands themselves and report evidence, not assertions.
- Orchestrator review per phase: rerun every gate command; inspect screenshots against the mockup; read the diff; run the checklist below; send findings back to the same builder. Two failed fix rounds on the same issue → orchestrator stops and reports to the owner.
- After a gate passes: orchestrator ticks TODO.md, commits, and starts the next phase. Progress summaries to the owner stay short, with screenshots.

Review checklist:

1. Matches the chosen direction (palette, type, characters, button style, layout) at 1280×720 and 1920×1080.
2. Motion only reinforces state; reduced-motion and low-stimulation variants exist.
3. Pupils need only their two switches; no timer, no speed reward, no negative feedback.
4. Held/bouncing/simultaneous input tests pass; no input queued through transitions.
5. Game state stays independent of rendering; no DOM-derived correctness.
6. Accessibility: native buttons, labels, focus, contrast, one polite live region.
7. Offline: every new asset precached; no network requests during play.
8. Budgets met; no console errors.
9. Surgical scope: nothing outside the phase brief.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Heavy blur/filters stutter on the classroom PC | Frame-rate probe in Phases 2 and 5; low-power toggle removes blur/particles |
| Motion overwhelms some pupils | Low-stimulation mode; reduced motion honoured; teacher-controlled pacing |
| Rewrite breaks input safety | Input modules untouched; behaviour tests stay mandatory at every gate |
| Art drifts from the mockup across phases | Mockup sources committed in `design/concepts/`; screenshot comparison at every review |
| Physical XAC still unverified | Unchanged: hardware checks remain NOT TESTED until observed |

## 8. Decisions needed from the owner

1. **Direction:** A Star Pilots, B Bot Builders, or C Glow Reef (or a named mix).
2. **Narration:** pre-record spoken prompts and numbers 1–10 with the connected ElevenLabs account (uses its credits; files bundled locally), or teacher reads aloud.
3. **Pupil age range**, if known — it tunes character tone and copy.
