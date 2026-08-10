# Cloud Command — Figma Prototype Guide

Use this after deploy or from a local build. Goal: turn the live UI into an editable Figma prototype for demos and tweaks.

## 1. What to capture (screens)

| Frame name | Route | Notes |
|------------|-------|--------|
| Login | `/login` | Code rain left + form right |
| Register | `/register` | Password strength |
| Overview | `/` | Stats, charts, system status |
| Site Monitor | `/monitors` | Summary strip + cards + open **Detail** modal |
| Monitor Detail | modal | Uptime / Inspect / Visitors tabs |
| Scheduled Jobs | `/scheduled-jobs` | Summary + job cards + **Run** loading |
| Job New Modal | modal | Create job form |
| API Vault | `/api-keys` | Stats + groups + keys + OTP modal |
| Render Hub | `/render` | Service cards |
| Vercel Hub | `/vercel` | Project cards |
| Settings | `/settings` | Profile / gateway / password |
| Theme Picker | modal | All 5 themes |

Capture **desktop 1440×900** and optionally **mobile 390×844**.

## 2. Import into Figma

### A) html.to.design (best)

1. Run frontend: `cd frontend && npm run dev` → usually `http://localhost:5173`
2. Install Figma plugin **html.to.design**
3. Log in → import each URL above
4. Name frames clearly

### B) Screenshots

1. Fullscreen browser, hide bookmarks bar  
2. Screenshot each state (including modals)  
3. Figma → **Place image** into frames  
4. Optional: auto-layout rebuild for components  

### C) Design tokens (manual variables)

| Token | Example (Midnight) |
|-------|--------------------|
| bg/primary | `#030308` |
| accent | `#818cf8` |
| success | `#10b981` / `#34d399` |
| warning | `#f59e0b` |
| danger | `#f43f5e` |
| radius/card | `16px` |
| space | `8 / 16 / 24 / 32` |
| font UI | Inter |
| font mono | JetBrains Mono |

Themes in app: **Midnight · Aurora · Ember · Emerald · Royale** (sidebar → palette).

## 3. Build the interactive Figma prototype

1. Open Figma → **Prototype** tab  
2. Connect flows:
   - Login **Sign in** → Overview  
   - Login **Create one** → Register  
   - Sidebar items → matching pages  
   - Overview stat cards → Monitors / Vault / Render / Vercel  
   - **Add Monitor** → New Monitor modal  
   - Monitor card → Detail modal  
   - **New Job** → New Job modal  
   - **Add Key** → OTP then Add Key modal  
3. Interaction: **On click** → **Navigate to**  
4. Animation: **Smart animate** / **Ease out** / **300ms**  
5. Present: top-right **Present** (▶)

## 4. What to review in Figma (checklist)

- [ ] One primary CTA per screen (solid)  
- [ ] Status badges readable (UP / DOWN / SUCCESS / FAILED)  
- [ ] Monitor summary strip: Total / Up / Down / Warming / Health  
- [ ] Job **Run** is obvious; response expandable  
- [ ] Vault secrets masked  
- [ ] Theme still dark/technical, not playful  

## 5. Live product URLs (after deploy)

- Frontend (Vercel): set in your Vercel project  
- Backend (Render): `https://cloud-command.onrender.com`  
- Local API default: `http://localhost:8000` via `VITE_API_URL`

## 6. Deploy reminder

```bash
# Frontend (from frontend/)
npm install
npm run build   # Vercel runs this automatically

# Backend (Render)
# uses render.yaml + uvicorn main:app
```

Set `VITE_API_URL` on Vercel to your Render API URL (with or without `/api` — client normalizes it).
