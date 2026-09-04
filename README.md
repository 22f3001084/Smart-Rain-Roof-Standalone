# Smart Rain Roof — Standalone

An offline-first, single-folder interactive engineering activity. Two characters
(Aisha and Arjun) walk a learner through designing a roof that senses rain and
automatically covers the washing on a terrace, then let them build and simulate
the system on a real-time 3D house.

Everything needed to run it ships inside this repository: the 3D engine, activity
code, character art, hero art, and webfonts. **No install, no build step, no web
server, and no internet connection are required.**

## Run it

**Offline (simplest)**

1. Keep the folder together exactly as supplied.
2. Open `index.html` in a current Chromium browser (Microsoft Edge or Google Chrome).
3. Choose **START THE STORY**.

**Over a local server** (useful for testing the deployed layout)

```bash
python -m http.server 8791
```

Then open <http://localhost:8791/index.html>.

## Deploy

Static hosting only — publish the repository root, with no build command.

- **Netlify:** drag the folder onto Netlify Drop, or connect the repo. `netlify.toml`
  already records `publish = "."`.
- **GitHub Pages / any static host:** serve the repository root; `index.html` is the
  entry point.

## Package map

| Path | Purpose |
| --- | --- |
| `index.html` | Main launch file |
| `engineering-smart-rain-roof.html` | Named backup entry to the same activity (byte-identical to `index.html`) |
| `engineering-smart-rain-roof.css` | Outer engineering-shell design |
| `smart-rain-roof-shell.js` | Outer fullscreen / shell controls |
| `smart-rain-roof-game/` | Complete interactive 3D activity (js, css, vendor Three.js, character art) |
| `assets/` | Hero image, character art, bundled webfonts and font licenses |
| `favicon.svg`, `favicon.ico` | Site icon |
| `smart-rain-roof-game/assets/voice/` | Voice-over, one file per spoken line |
| `tools/` | Build scripts for the voice-over and character cutouts (not needed to run the activity) |
| `netlify.toml` | Netlify publish directory |
| `MANIFEST-SHA256.txt` | File-integrity checksums for every shipped file |
| `THIRD-PARTY-NOTICES.txt` | Included open-source notices |
| `README.txt` | Plain-text copy of these instructions for offline hand-off |

## Regenerating the voice-over

The voice files are committed, so this is only needed after editing a spoken
line. The generator reads each line straight out of the source that displays it
(`index.html`, `js/ui.js`, `js/story.js`), so the audio cannot drift away from
the words on screen. Needs `GEMINI_API_KEY` in the environment and `ffmpeg` on
`PATH`:

```bash
python tools/build_voice.py
```

Only changed lines are re-rendered. Then confirm each clip says its line — the
delivery notes are part of the prompt, so this catches the model reading an
instruction aloud instead of the line:

```bash
python tools/verify_voice.py
```

After changing any shipped file, rewrite the checksums:

```bash
python tools/build_manifest.py
```

## Verify integrity

From the repository root:

```bash
tr -d '\r' < MANIFEST-SHA256.txt | sha256sum -c -
```

Every line should report `OK`. (The `tr` step normalises the manifest's CRLF line
endings for POSIX `sha256sum`.)

## Browser notes

- WebGL must be enabled for the interactive 3D house.
- Every spoken line is a pre-rendered voice-over file in
  `smart-rain-roof-game/assets/voice/`. There is **no text-to-speech fallback**, so
  Aisha and Arjun sound identical on every machine, including fully offline.
  Browsers require one interaction before audio may sound; the activity always has
  one, and a line blocked by that policy is released on the next tap. Every line is
  also on screen, so the flow stays complete if audio is muted.
- Fullscreen is optional (`F` key, or the fullscreen control in the HUD bar). The
  layout also adapts to laptop and tablet screens.

## Third-party code

Three.js r160 (MIT) and six SIL Open Font License typefaces are bundled. See
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and
`assets/fonts/licenses/` for the full notices.
