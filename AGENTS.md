# Number Crew

## Purpose and current phase

Number Crew is a cooperative browser maths game for Maths Week in a special school. The confirmed group is 1–4 players (originally 3–4; owner update, 30 September 2026) aged 7–15 sharing one screen and one Microsoft Xbox Adaptive Controller (XAC) on a Windows PC, with exactly two switches per pupil, counting 1–5, and addition within 10. The TypeScript/Vite implementation includes core maths, input filtering, calibration, practice, a six-round mission, and classroom screens. Phase 1 and Phase 2 software verification have passed, and the public GitHub Pages deployment passes all 21 hosted Chromium scenarios, including offline mission play, mission-progress artwork, access announcements, and recovery simulations. Manual access acceptance and physical XAC testing remain outstanding. PLAN.md distinguishes confirmed requirements from provisional classroom defaults.

A game-quality redesign is in progress on branch `redesign` (docs/REDESIGN-PLAN.md): 1–4 players, direction Star Pilots (glowing arcade space), and a boost round after every maths round. It is not merged or deployed; `main` and the public site still run the earlier build.

## Context-loading order

1. Read this file.
2. Read PLAN.md sections 1–3 for requirements, assumptions, and the game concept.
3. Read TODO.md for phase status and the next unfinished acceptance gate.
4. On branch `redesign`, read docs/REDESIGN-PLAN.md for the current phase brief.
5. Read only the PLAN.md sections needed for that gate; search before reading source files.
6. Once created, consult docs/HARDWARE-TEST.md for actual classroom compatibility results.

Record durable scope changes and confirmed classroom details in PLAN.md. Update TODO.md when a gate is met. Implementation and observed hardware behaviour take precedence over outdated documentation; reconcile the documents when they differ.

## Key Commands

These scripts are defined in package.json. Install dependencies before running them.

| Purpose | Planned command |
| --- | --- |
| Install locked dependencies | `npm ci` after the initial package and lockfile exist |
| Run development server | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test` (one run, not watch mode) |
| Browser tests | `npm run test:e2e` |
| Production offline/update tests | `npm run test:offline` (builds first) |
| Build | `npm run build` |
| Inspect production build locally | `npm run preview` |
| Deploy | Push approved changes to `main` in `mtsku11/mathsgame`; `.github/workflows/pages.yml` builds, deploys, and tests GitHub Pages |
| Test hosted site | `PLAYWRIGHT_BASE_URL=https://mtsku11.github.io/mathsgame/ npm run test:hosted` (no local server) |

Use a maintained Node.js version compatible with the chosen Vite version, verified against current official documentation. Use local dependencies and a lockfile. Preserve these planning files when creating the application; do not run a scaffold that replaces the non-empty workspace.

## Important Paths

The main implementation and handoff paths are below.

- `PLAN.md` — product specification, implementation decisions, sources, and acceptance criteria.
- `TODO.md` — ordered build backlog and unresolved classroom facts.
- `package.json` — scripts and dependency versions.
- `src/main.ts` — teacher setup, controller lifecycle, practice, panels, and orchestration.
- `src/input/` — input capture, calibration, and per-player filtering.
- `src/game/session.ts` and `src/game/questions.ts` — session transitions and deterministic maths.
- `src/ui/art.ts` and `src/style.css` — local SVG artwork and responsive presentation.
- `src/offline/register.ts` and `scripts/offline.mjs` — production precaching and update handling.
- `tests/` — unit tests and browser scenarios.
- `docs/HARDWARE-TEST.md` and `docs/TEACHER-GUIDE.md` — actual device results and classroom instructions.

## Engineering Rules

- Two pupil inputs mean two directly selectable answers. No third button, menu navigation, timed tap, button chord, or long hold is required of a pupil. Teacher administration is a separate keyboard/touch flow.
- A gamepad is a device, not a pupil. Multiple pupil bindings may refer to different buttons on the same XAC.
- Learn physical bindings. Do not hard-code Xbox labels as browser button indices or treat a device ID/index as a permanent identity.
- Keep cooldowns and answer locks per pupil. Process different pupils' simultaneous input independently. Held or bouncing switches must not answer subsequent questions.
- Default to cooperative, untimed play. No speed bonuses, elimination, public accuracy ranking, or automatic difficulty increase. The redesign's boost round is the only exception (rapid pressing, no fail state); maths questions stay untimed.
- Keep question state independent from rendering and animation. Pause preserves questions, results, and mission progress.
- Serve the game as a static app. No account, backend, analytics, advertisements, runtime CDN, or pupil personal data is needed.
- Store only anonymous setup preferences locally. Results remain in memory and clear on session reset. Device bindings require revalidation on a new session.
- Keep changes surgical. Do not introduce a game engine or UI framework without a concrete need demonstrated by this scope.
- Use Context7/current primary documentation for tooling assumptions. Use Playwright for visible UI and interaction verification. Browser emulation is not evidence that physical XAC switches work.
- Mark unavailable physical tests as NOT TESTED. Never report the game classroom-ready while its hardware acceptance gate is unverified.
- For the redesign (docs/REDESIGN-PLAN.md), one Sonnet builder per phase works sequentially with write access while the orchestrator reviews, produces audio, and owns the plan and TODO.md; builders commit locally and never push. Otherwise, subagents may handle bounded read-only mapping, documentation research, browser verification, and final review; the main agent owns edits, and write scopes and delegation do not overlap or nest.
- Preserve user files and changes. Obtain explicit confirmation before publishing, deleting assets/lockfiles or large directories, destructive Git operations, bulk moves, or modifying secrets/environment files.
