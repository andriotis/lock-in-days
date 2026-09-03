# Lock In Days

**A personal "lock‑in" tracker for a focused stretch of your life.** Set a
period, then every day: watch the countdown, snap a consistent progress photo,
log your weight, and tick off your habits — all on a screen that sits on top of
your own wallpaper. Private, offline, no account.

> **The 20‑second version:** it's an installable phone app with five tabs —
> **Countdown**, **Photos**, **Weight**, **Habits**, **Settings** — that helps
> you stay disciplined during a set period (a cut, exam season, a 75‑day
> challenge…). Everything lives on your device.

<br>

## What each tab does

| Tab | What you get |
| --- | --- |
| ⏱️ **Countdown** | A big ring showing days left in your period, plus a **daily quote** from philosophy, psychology, and the arts (tap ↻ for a new one). |
| 📷 **Photos** | Take **consistent** progress photos: a faint **ghost of your last shot** helps you line up pose and distance, with a **self‑timer** (3s/10s) so you can step back for full‑body shots. Reorder, batch‑delete, and **play them as a slideshow** to preview a compilation. |
| ⚖️ **Weight** | Log your weight once a day and see the trend on a clean chart with a **smoothed line** through the noise. **Pinch/scroll to zoom, drag to pan**, or jump to 1W / 1M / 3M / All. |
| ✅ **Habits** | Tick off daily habits with **streaks**, add/rename/recolor/delete inline, and **drag to reorder**. A **GitHub‑style grid** shows every habit's consistency at a glance. |
| ⚙️ **Settings** | Edit the period, set your **background photo**, **export/restore a backup**, or wipe all data. |

<br>

## The feel

The interface is deliberately **neutral frosted glass** — monochrome text on
translucent cards with a floating tab bar. You choose a **background photo**, and
the whole app sits on top of it, so it feels like *your* home screen, not a
branded app. Nothing competes with your wallpaper.

## Your data stays on your device

Everything — your period, weight, habits, photos, and wallpaper — is stored
privately in your browser via **IndexedDB**. No server, no account.

- Works **offline** and costs nothing to run.
- **Nothing is uploaded** anywhere.
- Data lives on that one device/browser. Clearing browser data or switching
  phones loses it, so use **Settings → Export backup** now and then (and
  *Restore backup* to move it to a new device).

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL. To use it on your **phone on the same Wi‑Fi**, open the
`Network:` URL Vite prints (e.g. `http://192.168.x.x:5173`).

> **Camera note:** browsers only allow the camera over **HTTPS or `localhost`**.
> Over a plain‑HTTP LAN URL, Countdown/Weight/Habits work but the camera is
> blocked. Deploy over HTTPS (below) to use it on your phone.

## Build & deploy (recommended for phone use)

```bash
npm run build      # static site in dist/
npm run preview    # preview the production build
```

`dist/` is a fully static site — host it anywhere with HTTPS for camera access
and "Add to Home Screen":

- **Netlify / Vercel / Cloudflare Pages** — drag‑and‑drop `dist/`, or point at
  this repo (build `npm run build`, output `dist`).
- **GitHub Pages** — publish `dist/`. Assets use relative paths (`base: "./"`),
  so a project subpath works too.

On your phone, open the deployed URL → **Add to Home Screen** to run it
fullscreen like a native app.

## Tech

- **Vite + React + TypeScript**, no UI framework and no chart/animation library.
- Charts, the contribution grid, gestures (zoom/pan, drag‑reorder), and the
  frosted‑glass design are all hand‑rolled with **SVG + CSS**.
- Storage is a small **IndexedDB** wrapper (`src/lib/db.ts`); the camera uses the
  native `getUserMedia` API and the ghost overlay is just your last photo drawn
  over the live video.

## Project layout

```
src/
  App.tsx                 app shell, 5-tab navigation, data loading
  lib/
    db.ts                 IndexedDB storage + reorder/backup/wipe helpers
    dates.ts              local-day helpers
    image.ts              downscale picked photos/wallpaper before storing
    quotes.ts             daily quote set (philosophy / psychology / arts)
    useReorder.ts         long-press drag-to-reorder hook (lists + grids)
  components/
    Countdown.tsx         days-left ring + daily quote
    PhotoCapture.tsx      camera (ghost + timer + mirror), gallery, slideshow
    Weight.tsx            weight entry + zoomable, smoothed trend chart
    Habits.tsx            today checklist + aggregated consistency grid
    PeriodPicker.tsx      start/end dates + typed length in days
    WallpaperPicker.tsx   personal background photo picker
    Setup.tsx             first-run onboarding
    Settings.tsx          period, background, backup, delete-all
    icons.tsx             inline SVG icons
```

---

*v1 · local-first · built with Claude Code*
