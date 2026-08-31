# Lock In Days

A local-first web app (installable PWA) to help you lock in during a focused
period. Four tools, one home screen.

**Design:** the interface is deliberately neutral — frosted-glass "material"
cards, monochrome type, and an iOS-style floating tab bar. You set a **personal
background photo** during onboarding (and can change it in Settings), and the
whole app sits on top of it, so it feels like *your* phone home screen rather
than a branded app.

1. **Countdown** — days remaining in your lock-in period, with a progress bar
   and simple stats. Set the period with a two-column picker: start/end dates on
   the left and a vertical "timer" slider on the right to dial in the length.
2. **Progress photos** — take consistent gym/progress shots using a **ghost
   overlay** of your last photo so pose, position, and distance line up every
   time. Includes a rule-of-thirds grid, a date stamp, a gallery, and a
   speed-adjustable slideshow to preview your compilation.
3. **Weight** — log your weight once a day and watch the trend on a clean line
   chart (kg or lb).
4. **Habits** — check off your daily habits and keep a **GitHub-style
   contribution grid** green, with per-habit streaks.

## Your data stays on your device

Everything — config, weight, habits, and photos — is stored privately in your
browser via **IndexedDB**. There is no server and no account. That means:

- It works offline and costs nothing to run.
- Nothing is uploaded anywhere.
- Data lives on the one device/browser you use it in. **Clearing your browser
  data or switching phones will lose it**, so use **Settings → Export backup**
  regularly (and *Restore backup* to bring it back or move it to a new device).

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed URL. To use it on your **phone on the same Wi-Fi**, the
dev server is already exposed on your LAN — open the `Network:` URL Vite prints
(e.g. `http://192.168.x.x:5173`) on your phone.

> **Camera note:** browsers only grant camera access over **HTTPS or on
> `localhost`**. Opening the plain-HTTP LAN URL on your phone will show the
> countdown/weight/habits fine, but the camera will be blocked. To use the
> camera on your phone, deploy over HTTPS (below) and open that URL, or use a
> local HTTPS tunnel.

## Build & deploy (recommended for phone use)

```bash
npm run build      # outputs static files to dist/
npm run preview    # preview the production build locally
```

`dist/` is a fully static site — host it anywhere with HTTPS and you get camera
access plus "Add to Home Screen" as a standalone app:

- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop `dist/`, or point it
  at this repo (build command `npm run build`, output dir `dist`).
- **GitHub Pages** — publish the `dist/` contents. The app uses relative asset
  paths (`base: "./"`), so it works from a project subpath too.

On your phone, open the deployed URL and choose **Add to Home Screen** to run it
fullscreen like a native app.

## Tech

- Vite + React + TypeScript, no UI framework.
- Charts and the contribution grid are hand-rolled SVG/CSS (no chart library).
- Storage: a tiny IndexedDB wrapper in `src/lib/db.ts`.
- Camera: the native `getUserMedia` API; the ghost overlay is just your last
  saved photo drawn over the live video.

## Project layout

```
src/
  App.tsx                 app shell, tab navigation, data loading
  lib/
    db.ts                 IndexedDB storage (incl. wallpaper) + backup/restore
    dates.ts              local-day helpers
    image.ts              downscale picked photos before storing
  components/
    Countdown.tsx         days-remaining screen
    PhotoCapture.tsx      camera, ghost overlay, gallery, slideshow
    Weight.tsx            weight entry + SVG trend chart
    Habits.tsx            daily checklist + GitHub-style heatmap
    PeriodPicker.tsx      dates + vertical "timer" slider
    WallpaperPicker.tsx   personal background photo picker
    Setup.tsx             first-run onboarding
    Settings.tsx          edit period, background, export/restore backup
    icons.tsx             inline SVG icons
```
