# Design concepts

Mockup sources for the three redesign directions (see docs/REDESIGN-PLAN.md). They are art references, not shipped code: port the chosen direction's SVG and CSS into `src/ui/`.

- `a.mjs` Star Pilots, `b.mjs` Bot Builders, `c.mjs` Glow Reef; `lib.mjs` shared helpers.
- `reference/*.png` (not committed) are 1280×720 captures. Generate them with `node build.mjs && node shot.mjs` from this folder (needs network for Google Fonts; the game itself must bundle fonts locally).
