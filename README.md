# Synth Conductor

A free browser instrument. Pick chords with your left hand, shape them with your right, using your webcam.
No account, no install, no tracking: hand tracking runs inside the browser and the camera picture never leaves your computer.

Made with permission from Eric Wei, the creator of [Gesture Synth](https://indecisiveeric.com/gesture-synth).

## Play

Open the published page in Chrome, Edge or Brave and allow the camera. Press **Learn the basics** for a short walkthrough.
The camera and MIDI only work over `https://` (or `localhost`), which GitHub Pages provides.

## Publish it (GitHub Pages, free)

1. Create an empty **public** repository on GitHub (no README, license or .gitignore), e.g. `synth-conductor`.
2. Push this folder to it:
   ```
   git remote add origin https://github.com/<your-username>/synth-conductor.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The **Deploy to GitHub Pages** workflow runs on every push to `main`. When it finishes, the site is at
   `https://<your-username>.github.io/synth-conductor/`.

After that, every `git push` updates the live site within a minute or two.

## Run it locally

Opening `index.html` directly works in Chrome. If the camera or hand tracking won't start that way, serve the
folder instead, e.g. `npx serve .` or `python -m http.server`, and open the `localhost` address it prints.

## Code layout

`index.html` is the page, `styles.css` the look, and `js/` the code, loaded in order as plain scripts:
theory → state → audio → midi → controls → ui → looper → hands → guides → boot → midi-panel → learn.

## Support

Synth Conductor is free. If it's useful to you, you can chip in at <https://paypal.me/JonathanEngelhard/5>.
