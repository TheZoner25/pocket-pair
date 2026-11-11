# Pocket Pair

A pixel pet for two, as a web app. Each of you opens the same link, signs in once,
and gets your own device on screen: status menu, hearts, voice notes, pixel art
from the Studio, real weather for Lappeenranta and Helsinki.

## What's where

| File | What it does |
|---|---|
| `index.html` | The page: sign-in, device, Studio, Settings |
| `css/app.css` | All the styling |
| `js/engine.js` | Pixel rooms, pets, menus, animations (from the device mock-up) |
| `js/net.js` | Talks to Supabase: status, hearts, voice notes, art, who is online |
| `js/studio.js` | 32×32 drawing board, preview, library |
| `js/app.js` | Switches, click sound + vibration, recording, playback, settings, update check |
| `config.js` | Supabase address and public key |
| `version.json` | The newest version number, checked by open apps |
| `supabase/schema.sql` | The database setup (already applied to "Tamagachi for Two") |

## 1. Supabase (one setting left)

The tables, rules and voice-note storage already exist in the **Tamagachi for Two** project.
New Supabase projects ask every new account to confirm its email. Pick one:

- **Easiest:** Authentication → Sign In / Providers → Email → turn off **Confirm email**.
- **Or keep it on:** Authentication → URL Configuration → set **Site URL** to your GitHub Pages
  address (step 2), so the confirm link opens the app.

## 2. Put it online with GitHub Pages (free, fixed link)

1. On github.com, create a new **public** repository called `pocket-pair`.
2. Click **uploading an existing file**, drag in everything from this folder
   (keep the `js`, `css`, `icons` and `supabase` folders), and commit.
3. Settings → Pages → Source: **Deploy from a branch**, branch **main**, folder **/ (root)** → Save.
4. After a minute your link is `https://YOUR-USERNAME.github.io/pocket-pair/`.
   That link never changes.

## 3. Join

Each of you opens the link, taps **Create account** (email + password), then types the
pair code, picks Rocky or Hazel and a name of up to 6 letters. Add it to the home screen
(Settings tab explains how) and it opens full screen like an app.

Change the pair code any time in Supabase → SQL Editor:
`update pair_config set join_code = 'NEW-CODE';`

## How we work on it

- **This folder on the laptop is the master copy.** Edit anything here (VS Code works well).
- **Test before it goes live:** double-click `start-local.bat`. It opens the app at
  `http://localhost:8000`. Sign-in, voice notes and live updates all work there,
  against the real database. Add `#demo` to the address for the pretend partner.
- **Ideas from Claude:** mock-ups come as separate pages first. Nothing changes here
  until you say so.
- **"Push it":** Claude reads this folder, bumps the version number, writes any changes
  back here, and pushes to GitHub. The official link updates, and open apps show
  "A new version is ready" within 10 minutes.

## 4. Updating later (same link)

1. Change the files.
2. Replace the version number everywhere it appears (for example `1.0.0` → `1.0.1`) in
   `version.json`, `js/app.js` (`APP_VERSION`) and the `?v=` bits in `index.html`.
3. Upload the changed files to the same repository.

Within 10 minutes, open apps show **"A new version is ready. Tap to update."**

## Demo

Add `#demo` to the link to try it without signing in. The other person is pretend.

## Notes

- Vibration works on Android. iPhone browsers can't vibrate from a web page; on iOS 18+
  a light tap may still come through. Click sounds work everywhere.
- Voice notes need microphone permission (asked the first time you hold REC). Max 10 s,
  2 MB. Each inbox keeps the newest 5 items; older ones and their audio are deleted.
- The Studio library is saved in the browser on each phone or computer.
