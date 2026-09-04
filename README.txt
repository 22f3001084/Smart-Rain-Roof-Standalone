SMART RAIN ROOF — STANDALONE DELIVERABLE
========================================

QUICK START (OFFLINE)
1. Keep this folder together exactly as supplied.
2. Double-click index.html.
3. Use a current version of Microsoft Edge or Google Chrome.
4. Select START THE STORY to begin the guided build.

No installation, build command, web server, or Internet connection is required.
The 3D engine, activity code, character art, hero art, and webfonts are all included.

NETLIFY DEPLOYMENT
1. Upload Smart-Rain-Roof-Standalone.zip to Netlify Drop, or deploy this folder.
2. Do not set a build command.
3. The publish directory is the package root (the folder containing index.html).

The included netlify.toml already records the publish directory. The archive is
packed with index.html at its root, so the deployed home page opens directly.

BROWSER NOTES
- WebGL must be enabled for the interactive 3D house.
- Every spoken line is a voice-over file inside the package (assets/voice/). No
  text-to-speech engine is used, so the two characters sound the same on every
  machine, including offline. Sound needs one tap or click first, which the
  activity always has. Every line is also shown on screen, so the learning flow
  remains complete if audio is muted.
- Fullscreen is optional. The layout also adapts to laptop and tablet screens.

PACKAGE MAP
- index.html                         Main launch file
- engineering-smart-rain-roof.html  Named backup entry to the same activity
- engineering-smart-rain-roof.css   Outer engineering-shell design
- smart-rain-roof-shell.js           Outer fullscreen/shell controls
- smart-rain-roof-game/              Complete interactive 3D activity
- assets/                            Hero, character, and bundled font assets
- smart-rain-roof-game/assets/voice/ Character voice-over, one file per line
- favicon.svg                        Site icon
- MANIFEST-SHA256.txt                File-integrity checksums
- THIRD-PARTY-NOTICES.txt            Included open-source notices

If the package is moved, move the whole Smart-Rain-Roof-Standalone folder. Do not
move index.html by itself because its relative assets must remain beside it.

