# Number Crew verification record

## Physical classroom hardware — NOT TESTED

No physical XAC or Windows classroom PC is connected to the development environment. Browser simulations are not proof of physical compatibility. Do not call this build classroom-ready until the checks below pass.

Record: Windows version, Edge/Chrome version, display resolution and viewing distance, XAC firmware/profile, USB/Bluetooth, switch models and count, tester and date.

| Check | Result |
| --- | --- |
| Six distinct switches mapped on one XAC for three pupils | NOT TESTED |
| Eight distinct switches mapped on one XAC for four pupils | NOT TESTED |
| Each switch visibly matches its pupil and answer side | NOT TESTED |
| Every pair of switches together; all eight held in diagnostics | NOT TESTED |
| One held switch does not block another pupil | NOT TESTED |
| Short taps, long holds, bounce, repeated presses, both choices together | NOT TESTED |
| No held press answers the next question | NOT TESTED |
| Disconnect, reconnect and full revalidation preserve the journey | NOT TESTED |
| Focus loss, sleep, reload and browser restart | NOT TESTED |
| Both layouts legible from actual classroom seats | NOT TESTED |
| Offline later restart after initial caching | NOT TESTED |
| Twenty-minute teacher rehearsal | NOT TESTED |

Suggested first sockets: P1 A/B; P2 X/Y; P3 LB/RB; P4 left/right stick-click. These labels are not assumed browser indices. Built-in A and an A-port switch may emit the same signal. Inspect toggle-hold/profile settings if switches stay on or generate duplicate signals.

## SwitchJam reference review — 28 September 2026

Marc reports successful XAC Bluetooth-to-browser use in SwitchJam. Reviewed private repository `mtsku11/SwitchJam` at commit `38335e09337561d021e1b4a63d5a4bd0cb76c963`. This is a reference implementation and user-reported hardware success, not a Number Crew hardware test.

- [Gamepad source](https://github.com/mtsku11/SwitchJam/blob/38335e09337561d021e1b4a63d5a4bd0cb76c963/src/input/sources/gamepadSource.ts): XAC inputs use `navigator.getGamepads()` and animation-frame polling, with press/release edges. Number Crew uses the same API; no separate Web Bluetooth pairing layer is indicated by this XAC path.
- SwitchJam exposes mapping, button count, raw axes, press counts, and connection history. Number Crew now exposes device ID/slot, mapping, button count and values, raw axes, and the latest 12 connection changes in memory for the current page. Press counters are not included.
- SwitchJam supports signed axis inputs with a sampled rest position and separate activation/release thresholds (0.6/0.4), and suppresses initially held buttons until release when multiple buttons are down at discovery. Number Crew currently accepts buttons only and requires all buttons released for calibration. Inspect idle readings before deciding whether either behaviour needs adapting; do not copy the first-frame rest heuristic blindly, because genuine simultaneous presses can be present at discovery.
- Number Crew already requires explicit remapping and practice after disconnection. Retain this rule rather than copying SwitchJam's persistent device numbering; this project must verify which pupil owns each switch.
- [Field log](https://github.com/mtsku11/SwitchJam/blob/38335e09337561d021e1b4a63d5a4bd0cb76c963/docs/FIELD-LOG.md) records XAC classroom use, including the 24 September entry. Older `HARDWARE-XAC.md` text still says hardware was unavailable; that text is stale relative to the field report. Formal hardware-validation rows do not provide a completed six/eight-switch result for this game.

Use the known-working Bluetooth setup as the first comparison: record its OS/browser, controller profile, and occupied sockets; press/release to expose the controller; capture idle/button/axis readings; then test six/eight distinct switches, simultaneous presses, held inputs, power-off/reconnect, and sleep recovery. Record USB separately if tested. All Number Crew physical results above remain NOT TESTED.

## Automated and browser software checks

Verified on 28 September 2026 on the development Mac using Playwright Chromium 153.0.8010.12. This does not certify Windows, classroom Edge, or physical switches.

- `npm run typecheck`: PASS.
- `npm run test`: PASS, 11 tests covering maths generation, scoring, calibration, simultaneous inputs, bounce and held-input filtering.
- `npm run build`: PASS, local assets and production service worker generated. Offline operation and update delivery were subsequently verified on 29 September (see below).
- `npm run test:e2e`: PASS, six scenarios: six rounds with Pass, Help/pause/blur, enlarged turns/narrow viewport, simultaneous keys and held-input protection across rounds, plus answer-based three/four-pupil missions covering mixed maths, incorrect-answer retry, exact star totals, answer lockout and replay.
- One intermediate run timed out looking for pupil 4 while the page showed three pupils; the subsequent complete run passed all six tests. Cause is unconfirmed (a development reload is suspected). Investigate setup selection/reload timing if it recurs.
- Interactive Playwright verified a visible counting round, retries, correct answers, shared stars, Next, and pause focus trapping. Resume focus originally fell to the document body; it now returns to the Pause control and has a regression assertion.
- Interactive three/four-pupil views had no overlap or horizontal overflow and no console warnings/errors. Four-pupil play fits at 1920×1080. At 1280×720 the mission page is 810px high, requiring vertical scrolling for the teacher controls; full classroom layout acceptance remains open.

The subsequent entries below record follow-up verification; the full access-settings matrix remains open. Physical checks above remain NOT TESTED.

## Controller follow-up — 29 September 2026

Typecheck, 13 unit tests, eight Chromium browser tests, and production build pass. New simulated Gamepad API scenarios map six/eight buttons on one controller, check simultaneous pupil inputs in practice, answer a question, disconnect, reconnect in a different browser slot, remap/recheck all switches, and verify preserved mission state. An idle axis at +1 is displayed without blocking button calibration. This is simulation, not physical Bluetooth evidence.

Calibration now rejects a device disappearing during the press/release learning sequence instead of accepting disappearance as release; a unit regression covers it. The bounded connection history has unit coverage. Read-only code review found no material issues. Live Playwright inspection at 1280×720 confirmed the new diagnostic readings and no horizontal overflow or console warnings/errors.

Axis readings remain diagnostic only. Button calibration still requires release of every button; no first-frame suppression heuristic was copied. Physical readings will determine whether either needs changing.

## Automatic rounds — 29 September 2026

Implemented optional 2–10 second completed-round transitions, defaulting to teacher Next and a four-second delay when enabled. The timer retains remaining time across pauses and controller recovery; enlarged Next player stays manual. Typecheck, 15 unit tests, nine Chromium browser tests, and production build pass. New tests verify paused remaining time, reset after manual advancement, and enlarged-mode automatic round boundaries. Read-only review found no material issues. Physical checks remain NOT TESTED.

Live Playwright setup verification at 1280×720 confirmed labelled pacing controls, selectable 2–10 second delays, no horizontal overflow, and no console errors/warnings. Setup still scrolls vertically.


## Layout and offline acceptance — 29 September 2026

Compact practice and mission screens now preserve 32px prompts, 48px answer numerals, and at least 96×96px answer targets at 1280×720. The shared scene and station spacing are reduced; Help has reserved space in simultaneous play so answer positions do not jump. Picture-answer line boxes no longer inflate the buttons. Four new browser scenarios cover three/four pupils in simultaneous/enlarged modes, addition within 10 with picture answers, Help, viewport fit, and target size.

Typecheck, 15 unit tests, all 13 development-browser scenarios (nine existing plus four layout scenarios), production build, and one production offline/update scenario pass. The production check uses the actual built assets on an isolated localhost server: cache completion, browser offline, full reload, four pupils answering all six rounds for 24 stars, and a second offline reload after updating. A controlled second worker version (same app assets, distinct cache version) waits during a replayed mission; the update button appears at the finale and activation returns to setup. This verifies worker lifecycle/UI behaviour, not an external deployment or different future app code. Read-only review found no material issues.

Physical XAC, Windows/Edge, school storage policy, actual classroom display readability, and the lesson-length rehearsal remain NOT TESTED.


## Comfort and small-screen access — 29 September 2026

Added browser checks for saved anonymous preferences (custom keys, per-pupil cooldown/maths, picture answers, auto pacing, reduced motion and less decoration), operating-system reduced-motion default, and quiet play. Audio checks observe real oscillator creation: muted answers produce none, teacher-enabled sound produces one on success, and muting again prevents further tones. No listening test or classroom speaker-volume assessment is implied. Setup reload starts with uncalibrated controls; stored settings contain neither bindings nor results.

At 640×360 CSS pixels (the reflow space of a 1280×720 screen at 200%), the pause dialog previously placed its final control below the screen. Its height is now bounded to the viewport and its contents scroll. Live Playwright confirmed keyboard focus scrolls the final button into view; automated tests cover 390×844 and 640×360 teacher setup, pause controls, and confirmed return to setup. This is reduced-viewport reflow testing, not a completed browser-toolbar zoom or screen-reader acceptance test. Read-only review found no material issues.

Final checks: 15 unit tests, 17 development Chromium browser tests, typecheck/production build, and the production offline/update test pass. Current build cache: `f845de6f76edc044`.

Live Playwright visual verification passed for three/four pupils in simultaneous/enlarged modes at 1280×720 and 1920×1080, including picture answers and Help through addition 5 + 5. No horizontal overflow or clipped questions/answers; simultaneous answer targets measured 96px at 720p and 100px at 1080p, enlarged targets 145px. Narrow 390px and 640×360 reflow remained scrollable and accessible. Console: zero warnings/errors. Screenshot: `.playwright-mcp/page-2026-09-29T12-12-16-786Z.png`.


## Effects volume — 29 September 2026

Added independent effects volume (Off/25/50/75/100%) in setup and pause, with the existing gentle cue as the maximum. Quiet mode takes priority; zero volume creates no cue. Preferences persist, and older preferences without volume retain their other settings and use 100%. Both gain-envelope endpoints scale together.

Typecheck/build, 15 unit tests, all 17 Chromium browser scenarios, and the production offline/update scenario pass. Browser checks verify persisted volume, compatibility with older settings, quiet/zero muting, 50%/100% scheduled gain, and keyboard traversal through the pause control. Live Playwright checks confirm 25% survives reload, the 640×360 pause dialog scrolls to all controls, and 1280×720 play still fits; console has no errors or warnings. Read-only review found no material issues. Build cache: `dfc033e6bca44ab6`. This verifies cue scheduling, not measured loudness or classroom listening comfort. Physical XAC testing remains NOT TESTED.

## GitHub Pages delivery — 29 September 2026

The public build is live at `https://mtsku11.github.io/mathsgame/` from commit `263e05d`. GitHub Actions run `36651173643` passed the production build, 15 unit tests, and all 21 browser scenarios against the published HTTPS site. Hosted coverage includes the three/four-pupil flows, setup and access preferences, controller simulations, visibility and unrelated-controller recovery, 720p layouts, cargo/progress artwork, reduced motion, service-worker scope, an offline reload, and a complete six-round mission for 24 stars. The hosted suite starts no local server.

The first hosted run exposed and led to a fix for an asynchronous offline-status update that rebuilt and closed the teacher's setup panel. The successful rerun verifies the published fix. Controlled service-worker update replacement remains covered by the separate local production regression because a hosted test does not modify the deployed worker. Physical XAC, classroom Windows/Edge, school storage policy, speaker comfort, actual display readability, and the lesson-length rehearsal remain NOT TESTED.

## Mission progress artwork — 29 September 2026

Correct answers now send the pupil's marked cargo pod toward the rocket and leave it visible in the cargo bay for that round. The journey derives six expedition parts from completed rounds rather than stars, so Pass still advances the mission. Amber Moon, Coral World, and Quiet Blue have distinct silhouettes and reveal a different landmark after rounds 2, 4, and 6. Explicit and operating-system reduced motion retain the final cargo, assembly, and landmark states without travel.

Typecheck/build, 15 unit tests, all 19 development Chromium scenarios, and the production offline/update scenario pass. Live Playwright at 1280×720 confirmed the cargo flight and static reduced-motion alternative, round 2/4 progress, distinct planet silhouettes, exact viewport fit, and zero console errors or warnings. Physical XAC, classroom browser, display readability, and pupil response remain NOT TESTED.

## Access announcements and recovery — 29 September 2026

Gameplay now uses one persistent polite, atomic live region instead of recreating a status region inside every pupil panel. Enlarged mode announces the active player, prompt, left/right choices, Help, Pass, and mission completion. Browser simulations verify that hiding the page pauses with the question and stars unchanged, resuming restores focus safely, and disconnecting an unassigned controller does not interrupt play while assigned-controller loss still requires full remapping and switch checks.

Typecheck/build, 15 unit tests, all 20 development Chromium scenarios, and the production offline/update scenario pass. Live Playwright at 1280×720 confirmed the same live-region node and expected announcement text across Help, Pass, Next player, hidden-page pause, and resume, with exact viewport fit and zero console errors or warnings. This verifies DOM accessibility semantics and simulated browser events; actual NVDA/VoiceOver output, browser-toolbar 200% zoom, and physical XAC behavior remain NOT TESTED.

## Star Pilots redesign performance and access — 30 September 2026 (branch `redesign`, not deployed)

Development Mac, headless Chromium, 1920×1080 with 4× CPU throttle (budget 45 fps). High quality / low power: play with four simultaneous answers 54.5 / 57.5 fps; Warp Drive live 54.3 / 60.0, finale 54.2 / 58.2; Firework Frenzy live 51.6 / 60.0, finale 55.5 / 60.0; Bubble Blast live 53.9 / 60.0, finale 55.0 / 60.0. The startup benchmark rates this machine medium (76–92 ms workload, 16.7 ms median frame gap). JS 365 KB gzipped (budget 450 KB); audio 4.8 MB and fonts 160 KB (budget 8 MB).

Typecheck, 142 unit tests, 193 development Chromium scenarios (14 opt-in evidence recorders skipped) and 3 production offline scenarios pass. axe-core reports no serious or critical issues on teacher setup, switch setup, check-in, pause, play (1–4 players, Spotlight on and off), the boost HUD and the finale; teacher setup remains keyboard-reachable without horizontal scrolling in a 640×360 viewport at device scale 2. The classroom PC's benchmark result and frame rate, physical XAC switches, real browser-toolbar zoom and NVDA/VoiceOver output remain NOT TESTED.
