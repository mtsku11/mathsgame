# Number Crew — implementation handoff

Planning date: 28 September 2026. Implementation authorised on the same date. Status: Phase 1 playable-slice and Phase 2 full-mission software gates verified using the implemented three/four-pupil layouts, including optional pausable automatic round transitions; 720p layouts and production offline/update checks also pass; remaining access acceptance and physical hardware testing remain incomplete. TODO.md and docs/HARDWARE-TEST.md record evidence and remaining checks.

## 1. Brief, recommendation, and open facts

Build a fun multiplayer browser game for 3–4 pupils sharing one screen and one Microsoft Xbox Adaptive Controller during Maths Week in a special school. Each pupil has two physical inputs. Maths covers counting 1–5 and addition within 10. The teacher has approved starting implementation from this handoff.

Recommended game: **Number Crew**, a cooperative space trip. Each pupil chooses between two large, stationary answers. A correct answer sends their cargo to the shared rocket; together the crew discovers three planets. Each pupil can work at a different maths level. Progress depends on completed turns, with teacher support available, and never on reaction speed.

The central tradeoff is shared-screen simplicity versus screen space: local multiplayer avoids accounts and school network setup, but four simultaneous question panels need testing from pupils' actual viewing positions. Provide an enlarged turn-taking mode as part of the first release.

### Confirmed requirements

- Runs in a browser.
- Multiplayer, fun, and based on very simple maths.
- Three or four pupils play together on one shared screen, using one shared Microsoft XAC.
- The classroom computer is a Windows PC; its Windows version and browser remain to be recorded.
- Exactly two pupil inputs each: six switches for three pupils, eight for four.
- Counting 1–5 and addition within 10.
- Intended for a teacher-led Maths Week activity in a special school.
- The initial task was a build handoff; the teacher subsequently asked to begin the build.

### Provisional decisions, not teacher-confirmed facts

| Decision | Build default | What still needs confirming |
| --- | --- | --- |
| Presentation | Simultaneous answers for the confirmed 3–4 pupils; enlarged turns also available | Which presentation suits the group best |
| Hardware connection | One shared XAC; compare the known-working SwitchJam Bluetooth setup first | Available switch models/count, cables, controller profile, exact working OS/browser |
| Classroom platform | Confirmed Windows PC; target current Edge or Chrome | Windows version, actual browser, school restrictions, display resolution |
| Audience | Age-neutral illustrated space theme | Ages, interests, useful visual/audio supports |
| Maths allocation | Count 1–5 initially; teacher assigns Add within 5/10 per pupil | Which pupils use counting or addition, and whether numeral or quantity answer cards help |
| Pace | Untimed, teacher advances between rounds | Whether optional automatic transitions suit the group |
| Session | Six rounds, two per planet; roughly 5–10 minutes as a planning estimate | Fatigue, lesson length, and suitable break points |
| Connectivity | Initial online load; cached offline play for subsequent launches | Whether the classroom can load the site and retain browser storage |

The teacher confirmed the shared screen, single XAC, Windows PC, 3–4 pupils, and maths ranges during planning. Age range, Windows version, browser, and switch models remain unconfirmed. Update this table when further answers arrive. Missing hardware does not prevent software development, but prevents a hardware compatibility claim. Do not silently substitute two pupils or several controllers if the requested single-XAC setup fails its physical test.

## 2. The play experience

### A sample round

Three or four pupil panels sit below the shared rocket. One shows three large objects and the choices **2** and **3**. Another shows **1 + 1** using pictures and the choices **2** and **4**. The other pupils receive their own questions at their assigned levels. Each pupil presses the switch corresponding to the answer's fixed on-screen position. A correct answer gently lights their panel and adds their marked cargo to the ship. Their turn is then complete; they cannot earn more by pressing faster. Once all turns are resolved, the teacher advances and the shared scene changes.

### Session loop

1. Teacher selects three or four pupils, presentation mode, maths preset per pupil, and sensory settings.
2. Teacher maps and checks the two switches for every pupil.
3. A practice screen lets each switch light its matching answer card, without assessment.
4. Teacher starts a six-round journey. Each round gives each active pupil one question at their assigned level.
5. Pupils answer independently. Correct answers earn one crew star per pupil per round; incorrect answers allow calm retries. The teacher can provide help or pass a turn.
6. When every active turn is correct or passed, the round is ready. Teacher selects Next; after rounds 2 and 4 the rocket visits a new planet. Round 6 leads to the group finale.
7. The teacher can replay with fresh questions and the same setup, change levels, or finish. Pupils do not need a third input for menus or replay.

### What makes this a game

- Individual contributions have visible effects: a cargo pod travels from the contributing pupil's station to the shared rocket; in reduced-motion mode it appears there without travelling.
- Six rounds add six visible parts to the expedition scene. The three planets have distinct silhouettes and a small reveal after each visit, with no essential story text to read.
- The group can see its journey advancing and finish together. There is no losing player, shrinking answer window, or race against a faster pupil.
- Successful pupils retain a calm "Cargo ready" panel while others finish. No extra scored questions or active distractions appear during this wait.
- Practice provides immediate cause-and-effect feedback before any maths demand.
- Brief, optional sound cues and optional short celebrations mark progress. Sound, movement, and visual decoration can each be reduced without changing the rules.

### Exact scoring and transition rules

- A correct answer earns at most one star for that pupil in that round, including after retries or teacher help. No bonus depends on answer time or difficulty.
- Wrong answers never subtract stars. Keep the question and both choices in place. A neutral cue and teacher-triggered counting support invite another attempt.
- Teacher actions are Help and Pass. Help marks the turn as supported and can reveal a counting scaffold; it does not submit an answer. Pass resolves the turn without a star.
- Journey progress counts resolved rounds, not stars. Therefore a passed turn cannot block a planet visit or force the teacher to pretend a correct answer happened.
- Show group stars as a collection without a target denominator; do not display a public list of mistakes, assisted turns, or skipped pupils.
- A session-only teacher summary may distinguish first-attempt, retry, supported, and passed outcomes. It is for observation, not an attainment claim: binary choices have a substantial chance component.
- Default pacing is teacher Next. Optional auto-advance waits until every turn resolves, then uses a configurable 2–10 second celebration delay (default 4); it is not an answer deadline. Pause freezes this delay.
- Changing difficulty takes effect on the next question. Removing a pupil takes effect at the next round boundary; use Pass for their current turn. Adding pupils requires returning to setup.
- No difficulty automatically changes in response to speed, retries, or repeated success.

## 3. First-release scope

### Required

| Area | Deliverable |
| --- | --- |
| Participation | Three or four local pupils sharing one XAC, each with two mapped switches; keyboard and touch alternatives |
| Controller access | Binding wizard, visible switch tester, reconnect recovery, configurable per-pupil input cooldown |
| Game | One polished six-round cooperative mission with three visual destinations |
| Maths | Counting 1–5 and addition within 5/10; per-pupil selection |
| Presentation | Simultaneous panels and enlarged turn-taking mode |
| Teaching | Practice, pause/resume, Next, Help, Pass, replay, change setup |
| Accessibility | No answer timeout, stable choices, large targets, redundant labels, quiet/reduced-motion settings |
| Reliability | Offline after successful initial caching; no external runtime assets |
| Handoff | Tested build, source, teacher instructions, accurate browser/hardware test record |

### Later, only after classroom feedback

Quantity matching without numerals, counting to 10, subtraction, more/fewer comparisons, a second theme, optional cooperative team challenges, switch scanning for a pupil with only one usable input, and an alternative competitive mode. Treat remote multiplayer, accounts, online leaderboards, a curriculum dashboard, and AI-generated live questions as separate projects. Do not implement these as part of this release.

## 4. Maths content

Use small deterministic generators with injected randomness. Produce the maths first, then choose presentation and answer position. Record the question and expected answer in game state; never infer correctness from displayed DOM text.

| Preset | Task | Values and display |
| --- | --- | --- |
| Count 1–5 | Count objects; choose the matching numeral | Answers and distractors 1–5 |
| Add within 5 | Combine two pictured groups; choose the total | Positive integer operands; total at most 5 |
| Add within 10 | Same task with a wider total | Positive integer operands; total at most 10 |

Default to Count 1–5 until the teacher chooses otherwise. Add within 5 is a lower-range setting of the same addition generator, not a separate mini-game. Addition answer representation can be numerals or quantities, chosen by the teacher; the counting preset specifically practises numeral recognition. Use five/ten-frame grouping for totals up to 10 to limit clutter. Zero is excluded from the first release, so an empty group cannot be mistaken for missing content.

Generator invariants:

- Exactly two distinct choices and exactly one mathematically correct choice.
- Every shown value stays inside the preset's range; addition always has two positive operands and a valid total.
- Use a nearby in-range distractor where available. Never create an out-of-range number merely to make an easy wrong answer.
- Vary the correct side with seeded randomness. Do not use fixed alternation, which pupils could learn instead of doing the maths. Test distribution over many generated questions, not a forced six-round balance.
- Avoid an identical immediate repeat of the mathematical prompt when the preset has alternatives; make the generator deterministic for a given seed.
- Quantity graphics use identical item size, spacing, and object type within a question; do not give away the answer through colour, object size, or decoration. Items must not overlap or move while being counted.
- Use short, consistent prompts: "How many?" and a pictured addition with `+` and `=`. Reading is supported by pictures and teacher guidance.
- Keep both options equally visually prominent until the pupil answers. Never shuffle them after a mistake or while a switch remains pressed.

## 5. Two-input control and XAC integration

### Physical setup and limits

Microsoft documents nineteen 3.5 mm input ports, USB peripheral inputs, Windows connectivity, and configurable profiles. These are controller inputs, not nineteen independently identifiable pupils. Multiple physical controls can produce the same logical button; for example, the built-in A button and A socket do not create two independent actions. Sources: [Xbox product specifications](https://www.xbox.com/en-US/accessories/controllers/xbox-adaptive-controller) and [Microsoft XAC input device specification, sections 9–10](https://assets.xboxservices.com/assets/b8/05/b8055a56-827c-48f8-b8ec-2c7aa66ef069.pdf?n=xbox-adaptive-controller-input-device-specification_1.6_Finalpdf.pdf).

Proposed first hardware trial, assuming the normal controller profile:

| Pupil | First answer socket | Second answer socket |
| --- | --- | --- |
| 1 | A | B |
| 2 | X | Y |
| 3 | LB | RB |
| 4 | Left stick click | Right stick click |

This table is a proposed wiring arrangement, not a browser index map or a physically verified four-pupil configuration. The confirmed design needs two suitable external momentary switches per pupil: six for three pupils, eight for four. Use physically accessible switch positions; "left/right answer" describes the display, not which hand a pupil must use. Staff arrange cables and switches to suit the pupils' existing access setups.

Prefer distinct ordinary digital controls for the first trial. Avoid the Xbox/system button, profile controls, opposing D-pad directions, and trigger/alternate-input assumptions. Do not require Xbox Accessories keyboard emulation, Copilot/merged-controller modes, firmware changes, or OS remapping for ordinary game operation. Inspect existing settings before proposing any hardware configuration changes. Toggle-hold settings can leave inputs latched; detect this during calibration ([Xbox update documentation](https://news.xbox.com/en-us/2024/08/28/xbox-august-update-discord/)).

No official guarantee of simultaneous multi-pupil capacity was found in the examined documentation. Treat four pupils through the requested single XAC as an unverified implementation hypothesis until the physical tests in section 10 pass. Supporting a second XAC is not a substitute for this requirement. On 28 September 2026 Marc reported successful XAC Bluetooth-to-browser use in SwitchJam; its Gamepad API implementation was reviewed and findings recorded in docs/HARDWARE-TEST.md. Use that working setup as the first Bluetooth comparison, while verifying this game's six/eight-switch capacity independently. Other operating systems remain additional test targets, not implied guarantees.

### Binding model

Each player has two logical actions: `chooseLeft` and `chooseRight`. A gamepad binding contains a session device reference plus an observed button index. The same device may supply either or both actions for several pupils, provided all assigned channels are distinct. A keyboard binding uses `KeyboardEvent.code`; pointer/touch buttons call the same logical input path.

Device references are session-local. The browser index is a slot and may be reused; identical controllers may have indistinguishable ID strings. Persist suggested layout/preferences, but re-associate devices and test bindings at each new session. After disconnection, require an explicit teacher reconnect check rather than silently assigning a different controller to a pupil. Browser behaviour is documented in [MDN's Gamepad guide](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

### Calibration workflow

1. Teacher opens setup, focuses the page, and clicks/taps the start/test control. Prompt them to press and release a controller button to expose the device if necessary.
2. Show a small raw-input diagnostic: observed devices, mapping, button states/values, raw axes, and bounded page-session connection history. Keep technical labels here, outside pupil play.
3. Select a pupil and answer side. Wait until relevant controls are released, then capture a fresh press and release. Only accept one unambiguous, unassigned channel.
4. Repeat for the second answer and each pupil. Reject a duplicate channel across any of the active bindings; explain whose answer it already operates.
5. Show the actual play layout. Each pupil tests both switches; the matching card visibly acknowledges each press. Test different pupils together.
6. Enable Start once each required action has been exercised and released. A saved setup shortens the wizard, but does not bypass this check.

If one physical press generates several signals or a signal stays on, show the diagnostic and let the teacher resolve the mapping/profile/switch issue. Do not guess a signal and allow cross-pupil input. Plain keyboard/touch play remains available for development and an explicitly selected classroom alternative.

### Runtime input rules

- Poll fresh `navigator.getGamepads()` snapshots through one `requestAnimationFrame` loop; tolerate null slots, devices already attached before page load, and connection/disconnection events. Feature/policy failure must produce a useful setup status. Reference: [MDN getGamepads](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getGamepads).
- Only a released-to-pressed edge can submit. Never submit repeatedly because a switch remains down. Ignore keyboard autorepeat and prevent browser key actions only for mapped gameplay keys while the game owns focus.
- Default post-acceptance cooldown is 500 ms per pupil, adjustable 0–1500 ms. During cooldown, update raw states but discard presses rather than queuing them. A new press is accepted only after cooldown and after both of that pupil's inputs have been released continuously for 100 ms. Keep these values configurable in teacher settings.
- Apply the same arming rule after practice, question changes, pause/resume, and reconnect. A held input must never leak into a new question. An input held by one pupil must not lock other pupils' choices.
- If both of one pupil's inputs become active in the same sampled frame, accept neither; wait for release and give a neutral acknowledgement. Different pupils pressing in that frame are all processed.
- Collect each frame's pupil actions as a batch. Resolve every eligible pupil action before checking whether a round is complete; a state transition must not drop the last pupil's answer.
- Once a pupil's turn is correct or passed, ignore their answer inputs until the next armed turn. Do not queue presses during feedback, animation, or a paused state.
- Pause the session on page blur/hidden state or disconnection of an assigned device. Preserve questions, answers already recorded, and remaining transition delay. Clear pending input; after teacher resume, re-arm from released inputs. An unrelated unassigned controller disconnect must not pause the game.
- Supply configurable keyboard bindings, with defaults F/J, A/L, C/M, Q/P for pupils 1–4. Hardware keyboard rollover may limit simultaneous use; this is not evidence against XAC support. Native on-screen answer buttons also work with pointer/touch and keyboard focus, through the same acceptance logic.

The cooldown is a starting design choice informed by [Game Accessibility Guidelines' post-acceptance delay guidance](https://gameaccessibilityguidelines.com/include-a-cool-down-period-post-acceptance-delay-of-0-5-seconds-between-inputs/); adjust it with the teacher during access testing.

## 6. Screens and accessibility

### Classroom layout

Four-player example; numbers below are illustrative questions, not fixed content:

```text
+------------------------------------------------------------------+
| NUMBER CREW       Shared rocket and journey: planet 1 of 3         |
+--------------------------------+---------------------------------+
| Pupil 1: chosen station marker  | Pupil 2: chosen station marker   |
| HOW MANY?                      | 1 + 1 = ?                       |
| [three stationary objects]     | [one object] + [one object]      |
|                                |                                 |
| [left switch: 2] [right: 3]    | [left switch: 2] [right: 4]      |
+--------------------------------+---------------------------------+
| Pupil 3: chosen station marker  | Pupil 4: chosen station marker   |
| HOW MANY?                      | 3 + 2 = ?                       |
| [five stationary objects]      | [three objects] + [two objects]  |
|                                |                                 |
| [left switch: 5] [right: 4]    | [left switch: 4] [right: 5]      |
+--------------------------------+---------------------------------+
| Teacher: Pause   Help/Pass   Next when ready   Sound   Settings    |
+------------------------------------------------------------------+
```

For three/four pupils, use fixed 2×2 station positions, with the unused fourth position quiet for three pupils. Keep the shared scene small enough that answers dominate the screen. Pupils retain station markers and positions throughout a session; do not rearrange panels when someone answers.

Enlarged turn-taking mode shows one pupil's question at a time with a prominent station marker. Teacher Next moves between pupils and then between rounds. Other pupils' switches are inactive until their turn, with no presses queued. The same per-round stars and journey rules apply. This mode supports a teacher reading aloud and a larger shared target. Switch presentation modes only while paused at a round boundary.

### Visual and motor requirements

- Two large native answer buttons occupy fixed, predictable positions. Give the physical switches matching labels where useful; indicate mapping using position plus a shape/label, never colour alone.
- Target at least 96×96 CSS px for answer hit areas. At 1280×720, aim for prompts at least 32 px and answer numerals at least 48 px; actual back-of-classroom readability is a physical acceptance test.
- Maintain clear text/background contrast (at least 4.5:1 for ordinary text) and visible focus. Test zoom and text growth; preserve all teacher controls and provide enlarged play when multi-panel content would become too small.
- Use calm illustrated SVG artwork, plain language, and an age-neutral tone. Avoid nursery styling until the age range is known. Keep decorative images out of accessible names.
- No flashing, screen shake, sudden zoom, required dragging, rapid tapping, long holds, answer timer, or colour-only feedback. Respect `prefers-reduced-motion`; the explicit reduced-motion option removes travel/confetti/background motion, not input acknowledgement.
- Offer quiet mode with music off, effects volume separate, and static celebrations. Decoration can be reduced independently. Show the same success information visually when muted.
- All teacher controls support keyboard and pointer/touch. Pupils need only their two switches during practice and play. State this teacher-led access model honestly; independent switch navigation of every settings screen is a later feature.

These requirements draw on [Microsoft XAG 107: Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) and [XAG 116: Time limits](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/116). Their application here is a design recommendation, not proof that every pupil's access needs are met.

### Audio, reading, and attention

- All essential information is visible as pictures, symbols, and short text. Teacher-led spoken support is the baseline, so the first release does not depend on text-to-speech availability.
- Include optional short local sound effects for selection, success, and arriving at a planet; avoid negative buzzers. Music defaults off. A teacher click/tap explicitly enables audio; gamepad detection alone must not be assumed to satisfy autoplay restrictions ([MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)).
- If automatic narration is needed for the confirmed pupils, elevate locally bundled spoken prompts/numerals to required scope before release. Do not quietly depend on online speech services or claim system voices always work offline.
- Never speak several pupils' questions at once. Use enlarged turn-taking mode for spoken questions, and provide a teacher Replay prompt action if recorded narration is included.
- Use semantic headings/buttons and restrained accessible status messages. In enlarged mode, announce the current station and question once; avoid continuous screen-reader announcements for every animation or every inactive station.

## 7. Technical approach

Use **TypeScript + Vite + semantic HTML/CSS and SVG**, with Vitest for logic tests and Playwright for browser behaviour. A small DOM game can provide large accessible controls and simple scene animation without a game engine. No backend or network multiplayer service is needed for the proposed local scope. Vite provides a vanilla TypeScript starter and static builds; confirm current versions and Node requirements when implementing ([Vite documentation](https://vite.dev/guide/)).

Build inside this workspace without replacing the handoff files. Add only the dependencies actually used. Choose and lock versions at implementation time rather than copying version numbers from this plan. Do not install a global toolchain or third-party controller mapper as a default requirement.

### Suggested module responsibilities

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Create the app, services, and one input polling lifecycle |
| `src/input/gamepad.ts` | Poll snapshots and track current connected slots |
| `src/input/bindings.ts` | Calibration and distinct physical-to-player binding validation |
| `src/input/normalize.ts` | Per-player edges, cooldown, arming, keyboard/pointer adapters |
| `src/game/questions.ts` | Pure question generation and answer validation |
| `src/game/session.ts` | Pure session transitions and round accounting |
| `src/ui/` | Setup, practice, teacher controls, panels, mission, result display |
| `src/settings.ts` | Versioned anonymous preferences; session revalidation |
| `src/offline/` | Precaching and between-session update flow |
| `tests/` | Unit tests and Playwright tests separated by responsibility |

Keep the data model small: PlayerConfig (station, preset, representation, two bindings, input timings); Question (ID, kind, quantities/operands, two choices, correct choice); PlayerTurn (question, outcome, attempts, support flag); Session (phase, round, turns, stars, presentation mode, paused state). Use a seeded RNG for repeatable tests. Game state owns logical IDs; device slots do not determine pupil identity.

State flow: `SETUP -> PRACTICE -> QUESTION -> ROUND_READY -> CELEBRATION -> QUESTION`, ending at `RESULTS`. `PAUSED` preserves the previous state. In enlarged mode the question phase has an active-pupil pointer; teacher Next moves it only once that turn resolves. Only the game state can award stars or advance rounds. CSS animation end events must not determine mathematical results or session completion.

### Packaging and offline operation

- Produce static `dist/` output and keep fonts, art, and sounds local. Serve the production site over HTTPS; use localhost for development. Do not promise double-clicked `file://` execution or arbitrary insecure LAN hosting.
- Add production precaching for the built HTML, hashed JS/CSS, and every required local asset, using a generated build asset list. A minimal build hook plus service worker is sufficient; a large PWA framework is unnecessary.
- Display "Ready offline" only after the current build's required resources have been cached and the page is controlled by the worker. Test a later offline reload, not merely disconnecting an already running tab. Offline readiness assumes the browser retains its storage.
- Do not force a waiting service-worker update into an active game. Apply updates between sessions with a teacher-visible reload action. Keep cache names scoped to this application. Reference: [MDN service worker lifecycle and caching](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
- If school policy blocks service workers/storage, record offline support as unavailable on that platform and prepare an approved local serving option with the school. Do not label the full offline acceptance criterion passed.
- No login, personal names, photos, analytics, external requests during play, or student-data export. Persist anonymous configuration only; results are memory-only.
- Prepare deployment instructions and the built artifact. The user approved GitHub Pages and the public `mtsku11/mathsgame` repository on 29 September 2026.

GitHub Pages hosting was authorised on 29 September 2026: public repository `mtsku11/mathsgame`, site `https://mtsku11.github.io/mathsgame/`. The Pages workflow builds from main and runs browser and offline-mission checks against the published site; hosted checks never start a local server. Controlled update simulation remains a separate local regression test.

## 8. Build order and acceptance gates

| Phase | Work | Gate to complete the phase |
| --- | --- | --- |
| 0 — Prove input | Minimal scaffold, raw diagnostics, all-pupil calibration, keyboard simulation | Six/eight real switches map distinctly on one XAC on the intended machine; taps, holds and simultaneous pupil inputs are observed independently. Without hardware, mark this gate pending and continue software work. |
| 1 — Playable slice | Count 1–5, initial two-panel engineering slice, one round, feedback, pause, teacher Next | Two simulated pupils resolve one round using only two actions each; no held input answers the next round. This is an engineering milestone, not the requested final player capacity. |
| 2 — Complete mission | Six rounds, three planets, all maths presets, Help/Pass, per-pupil settings | Mission completes even with a passed turn; each pupil earns at most one star per round; levels work together. |
| 3 — Classroom access | 3/4-pupil layouts, enlarged turns, reconnect recovery, quiet/reduced-motion settings | Browser scenarios and physical readability/input checks pass for each advertised configuration. |
| 4 — Delivery rehearsal | Production caching, teacher guide, test records, actual lesson-length rehearsal | Offline reload works where promised; teacher runs setup, play, pause/reconnect and replay using the delivered instructions. |

If a deadline forces cuts, defer optional automatic transitions and decorative variety first. Preserve the confirmed 3–4 pupils on one XAC, counting 1–5, and addition within 10. Do not remove input calibration, pause/recovery, untimed questions, readable choices, or truthful hardware verification. Record any reduced scope explicitly in TODO.md and the handoff.

## 9. Automated and browser verification

Test behaviours that are costly to discover during the lesson. Do not generate snapshot tests for every decorative element.

### Unit/integration tests

- Question generator properties over many seeds: one correct choice, no duplicate answers, in-range quantities, valid sums, no avoidable consecutive repeat, reasonable answer-side distribution.
- One held input across hundreds of frames yields one submission; switch bounce and keyboard repeat do not earn repeated stars.
- Cooldown affects only its pupil; ignored inputs never reappear later. Presses during pause, feedback, practice exit, or round transitions cannot leak into live questions.
- Two/four pupils pressing in the same frame each resolve once; one pupil pressing both choices simultaneously resolves neither.
- Reconnect/index reuse, duplicate button bindings, identical device descriptions, and unavailable API/policy states do not silently remap pupils or crash setup.
- Correct/retry/help/pass outcomes, final-round completion, mode-specific Next, and pause/resume preserve the defined scoring and transition invariants.

### Playwright scenarios

- Teacher creates three- and four-pupil setups, completes practice, runs six rounds via keyboard, observes the finale, and replays.
- Use an injected input provider to simulate gamepad snapshots: three pupils share one device; four share one device; disconnect/reconnect requires revalidation; a held switch does not trigger the next question. Clearly label these as simulated.
- Exercise the whole flow through native on-screen buttons as well as mapped keyboard input. Inspect console errors, focus, visible status, and unexpected page scrolling.
- Verify the 3- and 4-pupil views and enlarged mode at 1280×720 and 1920×1080; inspect 200% zoom and a narrow teacher-setup viewport. Capture screenshots for review.
- Verify reduced motion, muted play, long teacher pauses, wrong-answer retry, Help, Pass, inactive pupils in enlarged mode, and an unrelated controller disconnect.
- Build for production, complete precaching, take the browser offline, reload, and play a full mission. Check that all required assets load and no network-only content is needed.
- Verify a new service-worker version waits during play and becomes available at the next teacher-approved between-session reload.
- End with typecheck, unit tests, browser tests, and production build passing. Record actual browsers tested; Playwright Chromium does not certify the managed classroom Edge installation.

## 10. Physical classroom acceptance

The agent can prepare this checklist but must not tick it without observed physical evidence. Record outcomes and date in `docs/HARDWARE-TEST.md`, using PASS, FAIL, or NOT TESTED.

1. Record OS/browser versions, actual XAC firmware/profile, USB or Bluetooth, switch models/count, display resolution, and number of pupils. Record technical setup only, not pupil identities.
2. Every assigned switch activates exactly its intended answer and releases cleanly. Check the chosen ports rather than assuming their printed labels equal browser indices.
3. Test every pair of assigned switches simultaneously; test all assigned switches held in the raw diagnostic. Test one held switch while other pupils repeatedly press/release theirs. No cross-pupil activation or lost independent state is acceptable.
4. During the game, a five-second hold answers once; repeated/bouncing taps do not skip questions. Release, cooldown, and a fresh press reliably permit the next intended answer.
5. Unplug/replug an assigned XAC, change focus, reload, and resume after computer sleep. Verify clear recovery, preserved in-session state for pauses, and safe recalibration after reload/reconnection. Reload starts a new session; it does not silently restore old answers.
6. Check all offered player counts, reading distance, physical switch labels, and enlarged mode on the real display. A supporting adult confirms pupils can identify their station and two choices.
7. Teacher demonstrates a wrong answer, assistance, a passed turn, pause, end/replay, and a very long wait. No child is eliminated or hurried by software.
8. Rehearse a full lesson-length run (target 20 minutes including setup/replay) with the intended connection and power arrangement. Check switch fatigue and ask the teacher to adjust input timing/presentation where needed.
9. From a previously cached production load, restart the browser without internet and play. Confirm school browser policies do not erase required storage between uses.

Success means the activity is enjoyable and usable for the actual pupils, not simply that a demo works on the developer's laptop. Teacher observation must inform final pace, art, sensory settings, and maths levels.

## 11. Delivery and next-agent instruction

Deliver the source and lockfile, production build, a short teacher guide, the hardware/browser test record, and an updated TODO.md. The guide should cover wiring examples, setup/calibration, the meaning of each pupil switch, choosing levels, muted/reduced-motion play, enlarged turns, Help/Pass, disconnect recovery, offline preparation, and starting another group. Include a plain list of tested versus untested configurations.

Suggested instruction to the implementation agent:

> Build Number Crew from AGENTS.md, PLAN.md, and TODO.md in this workspace. The teacher confirmed 3–4 pupils sharing one screen and one XAC on a Windows PC, two switches per pupil, counting 1–5, and addition within 10. Preserve the distinction between these requirements and remaining defaults. Start with an input diagnostic and a small playable slice, then complete the full player capacity and first-release scope. Use current primary documentation, verify visible interactions with Playwright, and keep the hardware gate marked pending unless the actual single-XAC setup has been tested. Update the durable documents as decisions are confirmed. Prepare a reviewable production artifact and teacher guide; do not publish until the user confirms the destination and deployment.

Research used current Microsoft/Xbox, MDN, Vite, and Game Accessibility Guidelines material plus Context7 lookups on the planning date. Available research tools were sufficient; no extra software was installed for this planning task. The proposed gameplay, architecture, and classroom defaults are design choices, not claims that the hardware or pupil experience has already been validated.
