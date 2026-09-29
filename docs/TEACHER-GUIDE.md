# Number Crew — teacher guide

Game address: https://mtsku11.github.io/mathsgame/

This is a first software build, not yet verified with the classroom XAC. Complete HARDWARE-TEST.md before using it with pupils.

## Open the game

Open the game address above in Edge or Chrome. Wait for “Ready offline” before disconnecting the internet; the same browser must retain its site storage.

## Development commands

Use Node 22.12 or newer compatible Node, then `npm ci` and `npm run dev`. Open the local address printed by Vite. For a production version run `npm run build`, then `npm run preview`. Do not double-click index.html; the app needs a web server.

## Set up the crew

1. Choose three or four players and Play together or Enlarged turns.
2. Assign Count 1–5, Add within 5, or Add within 10 to each station.
3. In Comfort & access settings you can select picture answers for addition, input cooldown, keyboard keys, quiet mode, reduced motion and less decoration. Quiet is the default. Effects volume offers Off, 25%, 50%, 75%, or 100% of the gentle cue and is also available while paused. Quiet mode mutes effects regardless of volume; changing volume does not turn sound on. Essential information never depends on sound.
4. Choose the shared Xbox Adaptive Controller, or explicitly choose keyboard/on-screen buttons to try the software.

## Connect the switches

Use six external switches for three players or eight for four, connected to distinct XAC inputs. Prefer a wired USB connection to the Windows classroom PC. Staff should position switches and cables to suit each pupil's established access needs.

Pair the XAC in the computer’s Bluetooth settings, or connect it by USB. Click Set up the switches. Keep the page focused and press/release a controller button if the browser cannot see it yet. For each player's left and right answer, click Learn switch, release all switches, press the intended switch alone, then release it. The game rejects duplicate signals and ambiguous presses. The button numbers are browser readings, not socket labels.

Enter practice. Every pupil presses and releases both switches; each checked card changes appearance. In controller mode, on-screen clicks do not satisfy the physical switch check. Start becomes available after every mapped switch has been exercised and released. Test pupils pressing together too. New journeys require a fresh mapping/check.

Keyboard defaults: P1 F/J, P2 A/L, P3 C/M, P4 Q/P. On-screen answer buttons also work. Keyboard rollover limits depend on the keyboard; they say nothing about the XAC.

## Play

Each pupil selects the left or right answer. A correct answer earns one shared crew star, including after help or a retry. Incorrect answers stay in place with a calm invitation to count again. There is no time limit, ranking, or score deduction.

Help reveals a counting scaffold but never submits an answer. Pass finishes a turn without awarding a star, and never blocks the group. A correct answer sends that pupil's marked cargo pod to the rocket; Reduce motion places it there without travel. Each completed round adds one of six expedition parts, and each planet reveals a landmark after its second round. Next round becomes available after everyone finishes. In enlarged mode, Next player advances one pupil at a time. The mission lasts six rounds and visits three planets; teacher-led advancement is the default. Optionally enable “Advance completed rounds automatically” in setup and choose a 2–10 second celebration delay (default 4). It starts only after every pupil has finished, never limits answering time, and freezes during pause or controller recovery. Next player in enlarged mode remains teacher-controlled; manual Next round remains available.

Pause journey (or Escape) preserves progress. Changing tabs or leaving the page pauses automatically. If the assigned controller disconnects, reconnect it, remap and check every switch, then resume; the questions and stars are preserved. Release switches before resuming.

At the end, replay or return to setup. A collapsed teacher observation summary is held only in memory. No pupil names, accounts, analytics, or results are saved. Anonymous setup preferences stay in this browser when storage is allowed.

## Offline use and updates

Production builds cache their own local assets after the first successful load. Wait for Ready offline, then test a later offline reload on the actual classroom PC. Browser storage restrictions or clearing site data may remove offline availability. Development preview is not offline-enabled. The production offline reload, complete mission, and between-journey update flow have passed automated Chromium checks on the development Mac; repeat preparation on the classroom PC.

When an update is available, an Update game now button appears only at setup or the end of a journey. Save time for a full hardware/display rehearsal; do not rely on an untested cached page on the day.

## Current boundaries

Teacher controls use keyboard/touch, not the pupils' two switches. There is no recorded narration. The theme is provisional and hardware capacity/readability remain unverified. See TODO.md and HARDWARE-TEST.md for exact status.

For connection troubleshooting, open Live controller diagnostics during switch setup. It shows the controller slot and ID, mapping, pressed buttons and values, raw axes, and recent detections/disconnections. Axis readings do not select answers. If a button stays pressed with all switches released, check the switch and controller profile before mapping. Connection history lasts only until the page reloads.
