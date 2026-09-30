# Audio

All music, sound effects and narration were generated for Number Crew on 30 September 2026 with the project owner's ElevenLabs account (music: eleven_music_v2_5; effects: eleven_text_to_sound_v2; narration: eleven_v3, voice "Dan - British Professional"), then trimmed, loudness-normalised, looped and sprite-packed with ffmpeg.

- `manifest.json` — music tracks (with loop flags), `sfx` and `voice` Howler sprites (`[offsetMs, durationMs, defaultVolume?]`), and the exact text of every voice line.
- Every voice clip was checked against its intended words with Whisper speech-to-text (104/104 match).
- Source takes and prompts live in the ElevenLabs flow "Number Crew — Star Pilots audio"; regenerate there rather than editing these files by hand.
