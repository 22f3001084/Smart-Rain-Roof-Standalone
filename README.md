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
| `favicon.svg` | Site icon |
| `netlify.toml` | Netlify publish directory |
| `MANIFEST-SHA256.txt` | File-integrity checksums for every shipped file |
| `THIRD-PARTY-NOTICES.txt` | Included open-source notices |
| `README.txt` | Plain-text copy of these instructions for offline hand-off |

## Verify integrity

From the repository root:

```bash
tr -d '\r' < MANIFEST-SHA256.txt | sha256sum -c -
```

Every line should report `OK`. (The `tr` step normalises the manifest's CRLF line
endings for POSIX `sha256sum`.)

## Browser notes

- WebGL must be enabled for the interactive 3D house.
- Spoken dialogue uses the browser / operating-system speech engine and works offline
  when a local voice is installed. Every spoken line is also shown on screen, so the
  learning flow stays complete if speech is unavailable or muted.
- Fullscreen is optional (`F` key, or the fullscreen control in the HUD bar). The
  layout also adapts to laptop and tablet screens.

## Third-party code

Three.js r160 (MIT) and six SIL Open Font License typefaces are bundled. See
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and
`assets/fonts/licenses/` for the full notices.
