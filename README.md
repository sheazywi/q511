
# Québec 511 • Slideshow (starter)

This repo is pre-wired with:
- Vite + React + Tailwind
- Proxy for Québec 511 (`/q511`, `/Carte`, `/Images`)
- Minimal UI kit matching the imports used in the canvas

## Run locally
```bash
npm i
npm run dev
```
Open http://localhost:5173. In the app, toggle **Live video** to use HLS streams via the proxy.

## Deploy (Netlify/Vercel)
- Netlify: keep `netlify.toml`. Deploy the folder as a static site. Set env var `VITE_Q511_BASE=/` (recommended).
- Vercel: keep `vercel.json`. Set env var `VITE_Q511_BASE=/` in Project Settings → Environment Variables.

`VITE_Q511_BASE=/` makes the app build same-origin URLs like `/Carte/...` so your rewrites catch them.
