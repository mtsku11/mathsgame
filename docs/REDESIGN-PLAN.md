# Number Crew — game-quality redesign plan

Status: **APPROVED — direction A "Star Pilots".** Decisions recorded 30 September 2026. Branch: `redesign`.
Design canvas (private): https://claude.ai/artifact/DXygdyqpUNYbeWxexpc3nc. Art source: `design/concepts/a.mjs` (+ `lib.mjs`); render references with `design/concepts/build.mjs` and `shot.mjs`.

## 1. Goal and owner decisions

The current build works but looks like a web form. The redesign must look, sound and behave like a professional console game for children, while keeping every access and classroom guarantee already built and tested.

Owner decisions (30 September 2026):

- Direction **A — Star Pilots**: glowing arcade space, alien pilots in saucers, mothership hub, planets.
- Pupils aged **7–15** in a special school. Tone: bright and cool, never babyish; plain words; no nursery styling.
- **1–4 players** (was 3–4). XAC, two switches per pupil, one shared screen.
- Very simple maths: count 1–5, add within 5/10.
- **Boost round after every maths round**: pupils press their switches as fast as they can; pressing often and fast makes something amazing happen. This deliberately reverses PLAN.md's "no rapid tapping" rule **for the boost round only**; maths questions stay untimed. Design safeguards are in section 5.
- **Music, sound effects and narration**, produced with the owner's ElevenLabs account and bundled locally.
- Opus is creative director and orchestrator; Sonnet 5.5 builds one phase at a time.

Non-negotiables carried over from AGENTS.md/PLAN.md: two directly selectable answers per pupil; per-pupil edge/cooldown/arming input filter for answers; untimed cooperative maths; no negative scoring; pause preserves state; held inputs never leak between questions; offline after first load; no accounts, analytics or runtime CDN; physical XAC results stay NOT TESTED until observed.

## 2. Keep, extend, replace

| Area | Decision | Why |
| --- | --- | --- |
| `src/game/questions.ts`, `session.ts`, `transition.ts` | Keep; extend for 1–4 players and a boost phase | Pure, tested logic |
| `src/input/gamepad.ts`, `normalize.ts` | Keep unchanged; add a separate boost press counter | Safety-critical and tested |
| `src/offline/*`, `scripts/offline.mjs` | Keep; precache fonts, audio, textures | Working offline path |
| `src/settings.ts` | Extend: `count` 1–4, boost, audio, low-stimulation, switch-cap colours; storage key v2 with v1 migration | Loader rejects anything but 3/4 today |
| `src/main.ts` | Split; replace its render layer | `render()` rebuilds the whole DOM with `innerHTML` on every change, which kills animation state |
| `src/style.css`, `src/ui/art.ts` | Replace | New art direction |
| Tests | Keep behaviour tests; update selectors deliberately; add visual, motion and boost tests | Protect access guarantees through the rewrite |

## 3. Technical approach

**UI layer: DOM + inline SVG + CSS, animated with GSAP.** Native `<button>` answers keep touch, keyboard, screen-reader and Playwright coverage. **FX layer: PixiJS 8 (WebGL) canvas** above the stage for boost rounds, particles and big celebrations, where thousands of particles, bloom, shockwaves and warp blur are beyond DOM.

| Tool | Version | Use |
| --- | --- | --- |
| `gsap` | 3.15.x (free standard licence) | All UI motion; MotionPathPlugin for flights; CustomEase for squash/stretch |
| `pixi.js` | 8.21.x | FX canvas: `ParticleContainer` particle system, textures from SVG |
| `pixi-filters` | 6.1.x | Bloom, glow, shockwave, zoom-blur (warp), CRT-free |
| `howler` + `@types/howler` | 2.2.4 | Music stems, SFX sprites, voice queue, fades, unlock |
| `@fontsource/titan-one`, `@fontsource/baloo-2` | 5.3.x (OFL) | Local fonts |
| `@axe-core/playwright` | 4.13.x (dev) | Accessibility checks |
| ffmpeg (orchestrator machine only) | installed | Audio trimming, loudness, loops, sprite packing |

No custom particle-emitter dependency: `@pixi/particle-emitter` does not support Pixi 8; write a small pooled emitter over `ParticleContainer`.

Architecture rules:

1. **Stage.** Title, check-in, play, boost and finale render inside a fixed 1280×720 logical stage scaled to fit (letterboxed with the space background). The Pixi canvas uses the same logical resolution and scale. Teacher setup and switch setup stay responsive HTML.
2. **Mount once, patch on change.** Components expose `mount()` and `update(state)`. During play, never replace a station's DOM; toggle classes/attributes and let GSAP own transforms. No UI framework.
3. **Events.** Game logic emits typed events (`answerCorrect`, `answerTry`, `turnHelped`, `turnPassed`, `roundReady`, `roundStart`, `boostStart`, `boostGo`, `boostPress`, `boostTier`, `boostFinale`, `boostEnd`, `destinationReached`, `missionComplete`). Views, FX and audio subscribe. Correctness, stars, journey progress and boost tier come only from game state, never from animation completion.
4. **One motion module.** `src/ui/fx/motion.ts` wraps GSAP and Pixi timing. It honours `prefers-reduced-motion`, reduced-motion and low-stimulation settings, and a test mode (`?instant` or `window.__NC_TEST__`) that completes timelines immediately and lets tests drive the clock.
5. **Input safety.** Answers use the existing `InputFilter` only. Boost presses use a separate `PressCounter` (section 5). Every transition into maths calls `InputFilter.reset()`, so a switch still held from the boost round can never answer.
6. **Art as code.** Port SVG from `design/concepts/a.mjs` into typed functions in `src/ui/art/`. Pilots take `(player, mood)` with moods `idle | cheer | think | sleep | wave-left | wave-right | boost`. Pixi textures are rasterised from the same SVG at load, so both layers match.
7. **Budgets.** 60 fps target; ≥ 45 fps at 1920×1080 under Playwright CDP 4× CPU throttle during a boost finale; particle cap 2,500 (low-power 600); JS ≤ 450 KB gzipped (Pixi included); fonts + audio ≤ 8 MB; answer buttons never shift layout.

Target file map (builders may refine; keep responsibilities separate):

```text
src/main.ts                 bootstrap: settings, services, router, input loop
src/app/router.ts           screen lifecycle and transitions
src/app/events.ts           typed event bus
src/app/state.ts            app state (screen, mode, bindings, session, boost)
src/game/boost.ts           pure boost logic (energy, tiers, timing, themes)
src/input/pressCounter.ts   boost press edges per player and channel
src/ui/stage.ts             1280×720 scaler shared by DOM and Pixi
src/ui/theme.css            Star Pilots tokens
src/ui/art/*.ts             pilots, stars, planets, mothership, Gloop, icons
src/ui/components/*.ts      station, answerButton, hud, hub, pauseOverlay, teacherDock, powerMeter
src/ui/screens/*.ts         title, setup, switchSetup, checkIn, play, boost, finale
src/ui/fx/motion.ts         GSAP wrapper, reduced/instant modes
src/ui/fx/pixi.ts           Pixi app, texture cache, filters, quality levels
src/ui/fx/particles.ts      pooled emitter
src/ui/fx/boostScenes/*.ts  warpDrive, fireworkFrenzy, bubbleBlast
src/audio/audio.ts          Howler wrapper: music, sfx, voice queue, ducking, unlock
src/audio/manifest.ts       generated sprite/voice map
public/audio/               bundled music, sfx sprite, voice clips (orchestrator supplies)
design/concepts/            mockup sources (reference, not shipped)
```

## 4. Maths experience spec

Flow: **Title → Teacher setup → Switch setup (controller mode) → Crew check-in → Mission → Finale**. Mission = 6 maths rounds, each followed by a boost round. Destinations: rounds 1–2 **Golden Rings**, 3–4 **Candy Planet**, 5–6 **Frosty Moon**; the boost after round 6 warps the crew home to the finale. Replay returns to Crew check-in with the same setup.

| Moment | Visual | Motion (full) | Reduced motion / low stimulation | Audio |
| --- | --- | --- | --- | --- |
| Title | Logo, pilots orbiting the mothership | Logo drop-in, idle loops | Static scene | Title music |
| Crew check-in | Each pilot asleep in its saucer | Left switch: wave left; right: wave right; both checked: wakes, "Ready!" | Instant pose + tick | Boop per switch; "Crew check!" voice |
| Round start | Questions deal into stations | Staggered pop-in ≤ 600 ms, then input arms | Instant | Whoosh; "Round three" voice |
| Press | Button depresses | 80 ms squash | Same (acknowledgement required) | Arcade click |
| Correct | Gold button with star burst; other dims | Pop, burst, pilot cheer, star flies to mothership core ≤ 1.2 s | Star appears in core | Chime rising with crew total; short praise voice (max one at a time) |
| Try again | Pressed answer stays; soft wobble | Wobble, pilot "think" | Outline pulse | Soft neutral bloop; never a buzzer |
| Help | Numbers under objects | Numbers pop one by one | Instant | Voice counts "one, two, three" |
| Pass | Station rests | Pilot waves | Instant | None |
| Round ready | Core full, "All stars collected!" | 2.5 s celebration, then boost intro | Static card | Round jingle |
| Finale | Home base, every pilot celebrating, crew stars | Dance loop, confetti ≤ 4 s | Static | Mission jingle + voice |

Layouts: 1 player = one large station with the hub beside it; 2 = two stations either side of the hub; 3/4 = 2×2 around the hub (empty fourth slot shows the destination planet). Station order left→right, top→bottom matches seating. Answer hit areas ≥ 112 px; numerals ≥ 56 px; prompts ≥ 28 px.

Teacher layer: round pause button (Esc/Space); ghost Help/Pass buttons per station (H/P then player number); Next appears when a round is ready (Enter/N); "Say it" speaker button per station replays that pupil's question (never several voices at once). Teacher controls never sit between a pupil and their answers.

Options: low-stimulation mode (static background, 25% particles, softer palette, music off, acknowledgements kept); switch-cap colours (answer button fill matches the physical switch, always with position + chevron); narration on/off; music and effects volumes.

## 5. Boost rounds (creative direction)

**Promise:** after every maths round the whole crew powers something spectacular together. Everyone contributes, nobody can lose, and faster pressing makes it bigger and sooner.

### Loop

1. **Intro (≈4.5 s).** Stations fly down and shrink into a row of saucers along the bottom of the stage (evenly spaced for 1–4 players). Title card slams in: "BOOST ROUND!" + theme name. Voice: "Boost round! Press your switches as fast as you can!" Big countdown 3-2-1-GO with beeps. Presses before GO are ignored and never queued.
2. **Live (default 12 s; teacher 8/12/16/20).** Every press of **either** of a pupil's two switches fires an energy bolt from that pupil's saucer into the target and adds power to one shared meter. A slim ring shows time left.
3. **Tiers.** Meter thresholds at ⅓, ⅔ and full: "BOOST!", "SUPER!", "MEGA!". Each tier escalates the scene, raises music intensity and plays a stinger + voice. Reaching full ends the live phase immediately with MAX POWER, so a fast crew triggers the spectacle sooner.
4. **Finale (4–7 s by tier).** The theme's payoff at the reached tier. The minimum tier is always 1: time running out still gives a happy ending, never a fail message.
5. **Wrap (1.5 s).** Tier badge ("Mega boost!") and all pilots cheering; then the next maths round deals in. Answer inputs arm only after every switch has been released.

### Themes (rotate by round)

| After round | Theme | Target and escalation | MAX payoff |
| --- | --- | --- | --- |
| 1, 5 | **Firework Frenzy** | Night sky over the planet. Each press launches a firework from that pupil's saucer, bursting as a star shell in their colour. Tier 2 adds rings and multicolour peonies; tier 3 adds glitter willows. | Grand finale barrage: 30+ shells in waves, a giant star-face firework, golden glitter falling across the screen, pilots cheering. |
| 2, 4, 6 | **Warp Drive** | Mothership centre stage. Bolts charge the warp core: tier 1 core blazes, tier 2 engines ignite, tier 3 stars stretch into streaks. | HYPERSPACE: shockwave ring, warp tunnel (radial star streaks + zoom blur), mothership rockets into the distance, then the next planet swells into view ("Welcome to Candy Planet!"). After round 6 it warps home to the finale. |
| 3 | **Bubble Blast** | Gloop, a big friendly purple jelly alien, blows a bubblegum bubble. Each bolt pumps it bigger with an elastic wobble and a rising squeak; tiers add shine, trembling and Gloop's huge eyes. | Giant POP: bubblegum confetti, stars and sweets burst across the screen, Gloop ends up covered in gum and giggles, pilots bounce. |

Destination travel never depends on boost performance: Warp Drive always arrives; the tier only changes how spectacular the journey is.

Storyboards: `design/concepts/boost.mjs` → `reference/BOOST-intro.png`, `BOOST-warpLive.png`, `BOOST-warpMax.png`, `BOOST-fireworksMax.png`, `BOOST-bubbleLive.png` (also on the design canvas).

### Beat sheet (full motion; times from the start of each phase)

**Every theme — live phase feel**
- Press → saucer squash (60 ms) and bounce; bolt leaves the saucer within 1 frame and reaches the target in 220–280 ms along a slight curve; on arrival: spark burst (8–12 particles), target flinch (scale 1.03 for 80 ms), meter tick (fill tweens 120 ms, stripes scroll).
- Saucer heat: glow under each saucer scales with that pupil's 1 s press rate; at high heat add a trail of 3–5 embers.
- Tier-up: meter star ignites with a ring burst, word card ("BOOST!", "SUPER!", "MEGA!") slams in at 140% → 100% (elastic 400 ms), holds 900 ms, exits upward; background nebula brightens one step; stinger + voice.
- Idle nudge: a pupil idle for 4 s gets a saucer wiggle and sparkle, nothing else.

**Warp Drive** (target: mothership centre stage, 1.8× scale)
- Tier 0→1: core glow grows with energy; slow parallax stars drift down.
- Tier 1: engine flames ignite under the ship (flicker 8 Hz max, small amplitude); stars speed up.
- Tier 2: stars stretch into short streaks radiating from the ship; a low hum rises in pitch with energy.
- MAX (4.5 s): 0.0 core flare (one bright bloom, ≤ 250 ms) + shockwave ring expanding to screen edge (600 ms) + short shake ≤ 6 px; 0.3–3.2 warp tunnel: radial streaks accelerating, zoom-blur ramping up, streak colours cycling through the pilots' palette, ship shrinks toward the vanishing point, pilots' saucers tilt and trail; "HYPERSPACE!" card at 0.6 s; 3.2–4.5 streaks decelerate, next planet swells from a dot to hero size with a soft shimmer, voice "Welcome to Candy Planet!".
- Lower tiers: same arc, shorter tunnel (tier 1: 1.2 s; tier 2: 2.2 s), fewer streaks, no shake.

**Firework Frenzy** (target: the night sky over the current planet's horizon)
- Each press launches a rocket from that saucer (trail of 6–10 embers, 400–600 ms rise), bursting into a star-shaped shell in that pupil's colour (40–80 particles, gravity, fade 900 ms). Rockets cap at 10 in flight; extra presses still add energy and fire smaller sparkles.
- Tier 2: shells alternate peony / ring / crackle; tier 3: glitter willows that hang and fall.
- MAX (6 s): 0–3.5 barrage in three waves (8, 10, 12 shells) across the whole sky in all pilots' colours; 3.5 a giant star-face shell (smile + two eyes) centred; 4.2 golden glitter rain over everything; "MEGA BOOST!" card; crowd cheer.
- Lower tiers: a single wave (tier 1) or two waves (tier 2), no star-face.

**Bubble Blast** (target: Gloop, the big friendly purple jelly alien, blowing bubblegum)
- Each bolt pumps the bubble: scale steps up with energy, every step an elastic overshoot (scaleX/scaleY squash 6%) and a rubbery squeak whose pitch rises with size; Gloop's cheeks puff and eyes widen per tier; the bubble trembles faster as it nears full.
- MAX (4 s): 0.0 bubble stretches (scale 1.08, 150 ms) then POPS: shockwave ring, 150–250 pink gum shreds + stars + sweets radiating with spin and gravity, a few gum splats stick to the screen edges and slide off over 2 s; 0.6 Gloop covered in gum, giggles (squash-and-stretch laugh loop); "POP!" card; pilots bounce.
- Lower tiers: smaller bubble pops with proportionally fewer particles.

**Wrap (1.5 s, all themes)**: tier badge centre ("Boost!", "Super boost!", "Mega boost!"), pilots cheer, then everything clears and the next maths round deals in. Answer input arms only after every switch is released.

### Individual feel without competition

- Each saucer glows hotter with that pupil's recent press rate (1 s moving average): visible effort, no numbers.
- A pupil idle for 4 s gets a friendly saucer wiggle and a sparkle prompt, never a message.
- No per-pupil scores, rankings or "fastest" labels anywhere, including the teacher summary.

### Tuning and access safeguards

- Target energy = sum over players of per-pupil targets: easy 12, **normal 20**, hard 32 presses. Teacher sets per-pupil **boost power** ×1/×2/×3 so a pupil who presses slowly contributes as much as anyone.
- `PressCounter` counts released→pressed edges per channel with a 35 ms bounce guard; holding counts once; both channels of a pupil count. It ignores the answer cooldown. It never feeds `InputFilter`.
- Flash safety (WCAG 2.3.1): at most one large bright flash per second, no saturated-red flashes, no strobing; warp streaks move smoothly. Screen shake ≤ 6 px, only at launch/POP, off in reduced motion and low stimulation.
- Reduced motion: presses, meter and tiers still work; finales become calm fades (planet appears, bubble softly pops into stars) with no streaks, shake or travel.
- Low stimulation: 25% particles, softer colours, music off, stingers quieter.
- Teacher can pause (freezes timer), skip the boost (Next), shorten it, or turn boost rounds off. Pause/blur/disconnect rules from PLAN.md apply unchanged.
- Settings: `boost.enabled` (true), `boost.seconds` (12), `boost.difficulty` (normal), `boost.autoStart` (true), `players[i].boostPower` (1).

### Pure logic contract (`src/game/boost.ts`)

`createBoost({ theme, players, powers, difficulty, durationMs, now })`; `press(state, player, now)`; `tick(state, now)`; derived `tier` 0–3, `energy`, `target`, `phase: 'intro' | 'live' | 'finale' | 'done'`, `finalTier = max(1, tier)`. Events emitted on phase and tier changes. Unit-test: tier thresholds, early MAX, timeout, pause freezes time, powers, press after finale ignored, theme rotation by round.

## 6. Audio (orchestrator produces, builders integrate)

The orchestrator generates assets with ElevenLabs, checks each voice clip with speech-to-text, trims and loudness-normalises with ffmpeg (music −16 LUFS, effects −14 LUFS peak-safe, voice −16 LUFS), and delivers them to `public/audio/` with `manifest.json`. Formats: `.webm` (Opus) + `.mp3` fallback.

- **Music:** title theme; calm mission bed; boost track at three intensities (stems or separate loops) crossfaded by tier; round jingle; tier stingers; mission-complete jingle.
- **Effects:** click, answer press, correct chime, try bloop, help twinkle, star flight/arrive, deal-in whoosh, countdown beeps + GO horn, bolt pew (per-player pitch), hit spark, tier-up riser, warp charge/launch/arrive, firework launch/burst/finale crackle, bubble stretch/POP, Gloop giggle, crowd cheer, pause/resume.
- **Voice (one warm British "mission control" narrator):** prompts, numbers 1–10, the 45 addition questions, praise variants, help lines, round numbers, boost lines, destination welcomes, pilot call-outs, check-in and finale lines.
- Runtime: audio unlocks on the teacher's first click; music ducks under voice; one voice line at a time; praise lines are dropped rather than queued when several pupils answer together.

## 7. Phases

All work on branch `redesign`. Builders commit locally after each verified increment and never push. Gates list the evidence the orchestrator checks.

### Phase 0 — Foundations

Deliver: AGENTS.md delegation rule and PLAN.md scope/decisions updated (1–4 players, direction A, ages, boost rounds, audio); dependencies installed; stage scaler; router + event bus; motion module with instant/reduced modes; Pixi FX layer bootstrapped (transparent canvas, quality levels, test-mode off switch); local fonts; settings v2 with v1 migration, 1–4 players and the new options; session tests for 1 and 2 players.
Gate: typecheck, unit and e2e green (specs adapted only where 1–4 players changes them); placeholder title screen scales correctly at 1280×720, 1920×1080 and 1366×768 (screenshots); Pixi canvas present and transparent.

### Phase 1 — Play screen, static fidelity

Deliver: HUD with route, hub (planet, mothership core, round pips), stations for 1–4 players, pilots (all moods), stars, arcade answer buttons (ready, pressed, correct, try, dim, disabled), chevrons, teacher ghost buttons, pause overlay; wired to real session logic with mount-once updates.
Gate: screenshots of 1/2/3/4-player play at 1280×720 and 1920×1080 match `design/concepts/reference/A-game.png`; six-round keyboard mission completes (boost skipped via setting); test proves station elements survive an answer (same instance).

### Phase 2 — Game feel

Deliver: every moment in the section 4 table except audio; destination and finale scenes; pooled particle emitter; reduced-motion and low-stimulation variants.
Gate: recorded video of one round reviewed; reduced-motion run shows no travel/particles; held-input and transition-leak tests pass; frame-rate probe meets budget.

### Phase 3 — Boost rounds

Deliver: `boost.ts` + tests; `PressCounter` + tests; session phase integration; boost intro, live HUD (power meter, tier badges, time ring, saucer heat), and the three themed scenes with full, reduced-motion and low-stimulation finales; teacher settings; pause/skip.
Gate: unit tests for boost logic and press counting (hold, bounce, alternating channels, simultaneous pupils); browser test simulates rapid presses via the injected gamepad provider and reaches each tier; a held switch after the boost does not answer the next question; videos of each theme's MAX finale reviewed by the orchestrator; flash-safety check (no more than one large luminance flash per second, measured from captured frames); frame-rate budget met during each finale.

### Phase 4 — Sound, music and voice integration

Deliver: Howler wrapper, music stems with tier crossfades, SFX sprite, voice queue with ducking, per-channel volumes, narration toggle, "Say it" buttons, audio unlock flow.
Gate: unit tests for volume/mute/queue rules; browser test that nothing plays before teacher interaction and nothing but acknowledgements in low stimulation; production build precaches audio; offline mission test passes.

### Phase 5 — Front-of-house screens

Deliver: title/attract; game-styled teacher setup (plain language, keyboard-first) including boost settings; switch setup with a visual map of each pupil's two switches and live press lights; Crew check-in replacing practice; finale and teacher summary.
Gate: full simulated-controller and keyboard flows; axe-core no serious/critical issues on setup, switch setup and pause; 200% zoom on teacher setup keeps every control reachable.

### Phase 6 — Spotlight mode, access and performance

Deliver: enlarged turns as "Spotlight" (one station fills the stage, others rest at the edges, voice reads the question); 1- and 2-player polish; contrast/focus/announcement pass; performance fixes; low-power toggle.
Gate: all browser suites green; axe-core clean on play/check-in; frame-rate and bundle budgets met with numbers recorded in docs/HARDWARE-TEST.md.

### Phase 7 — Delivery

Deliver: teacher guide rewritten with screenshots and boost-round guidance; hosted tests updated; offline/update tests passing; TODO.md reconciled. Merge to `main` and deploy **only after the owner approves the preview build**.
Gate: `npm run build` and `npm run test:offline` green; after approved push, hosted suite green and live screenshots captured.

## 8. Orchestration protocol

- The owner's 30 September instruction replaces AGENTS.md's "main agent owns edits" rule for this redesign: **one Sonnet 5.5 builder per phase, sequential, write access to the repo; the orchestrator reviews, produces audio, and owns this plan and TODO.md.** The orchestrator writes only under `public/audio/`, `docs/` and `design/` while a builder is running.
- Builder brief = sections 1–3, the relevant spec sections, the phase section, the mockup files and the review checklist. Builders run gates themselves and report evidence (counts, exit codes, screenshot paths), not assertions.
- Orchestrator review per phase: rerun gates; compare screenshots/videos with the mockup; read the diff; run the checklist; send findings back to the same builder. Two failed fix rounds on the same issue → stop and report to the owner.
- After a gate passes: tick TODO.md, commit, start the next phase. Owner updates stay short, with screenshots or video.

Review checklist:

1. Matches Star Pilots (palette, type, pilots, arcade buttons, hub layout) at 1280×720 and 1920×1080.
2. Motion reinforces state; reduced-motion and low-stimulation variants exist; flash safety holds.
3. Maths: two switches only, no timer, no speed reward, no negative feedback.
4. Boost: everyone contributes, no fail state, no individual ranking, teacher can pause/skip/disable.
5. Held/bouncing/simultaneous input tests pass; nothing leaks from boost into answers.
6. Game state independent of rendering; no DOM- or animation-derived correctness or progress.
7. Accessibility: native buttons, labels, focus, contrast, one polite live region.
8. Offline: every asset precached; no network requests during play.
9. Budgets met; no console errors.
10. Surgical scope: nothing outside the phase brief.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| WebGL/filters stutter on the classroom PC | Quality levels (high/medium/low-power) chosen by a startup benchmark; teacher override; frame-rate probe at Phases 2, 3, 6 |
| Rapid pressing tires or excludes some pupils | Short rounds, per-pupil boost power, no fail state, teacher controls, boost can be disabled |
| Boost overwhelms or triggers sensitivities | Flash-safety rules, reduced-motion and low-stimulation finales, volume controls |
| Mashing leaks into the next question | Separate `PressCounter`; `InputFilter.reset()` on every return to maths; tests |
| Generated audio quality varies | Speech-to-text check for every voice line; owner listens to the music/SFX review page before Phase 4 closes |
| Art drifts from the mockup | Mockup sources in `design/concepts/`; screenshot comparison each review |
| Physical XAC still unverified | Unchanged: hardware checks remain NOT TESTED until observed |
