# ⚡ Cloud Command

**Unified DevOps Command Center** — Monitor APIs, track site uptime, and manage Render & Vercel deployments from a single, premium dashboard.

![Cloud Command](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌐 **Site Monitor** | Real-time uptime & latency tracking with auto-alerts |
| 🔑 **API Vault** | Encrypted storage & live validation of AI API keys |
| 🟢 **Render Hub** | Manage services, trigger deploys, view env vars |
| △ **Vercel Hub** | Manage projects, deployments, domains & env vars |
| 📊 **Dashboard** | Unified metrics: uptime, tokens, platform visits |
| 🔔 **Email Alerts** | Status change notifications via Gmail SMTP |
| 🔒 **Security** | Argon2id hashing · Fernet AES encryption · JWT auth |

---

## 🏗️ Architecture

```
Cloud Command/
├── backend/          # FastAPI + SQLAlchemy
│   ├── routers/      # auth, monitors, apikeys, render, vercel, settings
│   ├── services/     # pinger, mailer, api_validator
│   ├── models.py     # SQLAlchemy ORM models
│   ├── schemas.py    # Pydantic request/response schemas
│   ├── security.py   # Argon2id, Fernet, JWT
│   └── main.py       # App entry point + lifespan
└── frontend/         # React 19 + Vite
    └── src/
        ├── api/      # Axios API layer
        ├── pages/    # Dashboard, SiteMonitor, ApiVault, RenderHub, VercelHub, Settings
        └── components/ # Sidebar
```

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
# Edit .env with your values

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL if needed (dev uses Vite proxy automatically)

npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon recommended) |
| `JWT_SECRET` | ✅ | Random string for JWT signing |
| `ENCRYPTION_KEY` | ✅ | Fernet key for encrypting API tokens |
| `SMTP_EMAIL` | Recommended | Gmail address for alerts and OTP emails |
| `SMTP_PASSWORD` | Recommended | Gmail App Password; normal Gmail passwords will fail |
| `RENDER_EXTERNAL_URL` | Optional | Self-ping URL for free tier keepalive |
| `ENABLE_BACKGROUND_PINGER` | Optional | Set `false` to stop site monitor DB polling |
| `ENABLE_SCHEDULED_JOBS` | Optional | Set `false` to stop scheduled job DB polling |
| `ENABLE_SELF_PING` | Optional | Set `true` only when Cloud Command itself should stay awake as the waker |
| `BACKGROUND_WORKER_INTERVAL_SECONDS` | Optional | Background scan cadence; `840` keeps apps warm before 15-minute sleep windows |
| `PINGER_CACHE_REFRESH_SECONDS` | Optional | How often the pinger refreshes targets from Neon; default `21600` |
| `PINGER_WRITE_RESULTS` | Optional | Keep `false` to avoid a Neon write on every ping cycle |
| `PINGER_MEMORY_LOGS_PER_MONITOR` | Optional | In-memory chart points per monitor while DB logging is off |
| `MONITOR_REQUEST_TIMEOUT_SECONDS` | Optional | Longer timeout for sleeping Render apps to wake before marking failure |
| `BACKGROUND_WORKER_TIMEOUT_SECONDS` | Optional | Max time allowed for one background worker cycle |
| `MIN_MONITOR_INTERVAL_SECONDS` | Optional | Minimum per-site monitor interval; `840` matches the warmup cadence |
| `MONITOR_LOG_RETENTION_PER_MONITOR` | Optional | Lower values reduce DB writes and storage growth |

Generate an encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Neon Free usage notes

Neon Free includes 100 CU-hours per project each month. Cloud Command can burn through that if the pinger reads or writes Neon every cycle. The pinger now keeps monitor targets and recent chart points in memory, refreshes targets from Neon only occasionally, and does not write ping results unless `PINGER_WRITE_RESULTS=true`. If Cloud Command is the always-on waker, use `ENABLE_SELF_PING=true`, `BACKGROUND_WORKER_INTERVAL_SECONDS=840`, `MIN_MONITOR_INTERVAL_SECONDS=840`, `PINGER_CACHE_REFRESH_SECONDS=21600`, `PINGER_WRITE_RESULTS=false`, and `MONITOR_REQUEST_TIMEOUT_SECONDS=45`.

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production only | Backend API base URL |

---

## 🌍 Deployment

### Backend → [Render](https://render.com)
- Use the included `backend/render.yaml` blueprint
- Set all env vars in Render dashboard

### Frontend → [Vercel](https://vercel.com)
- Connect the `frontend/` directory
- Add `VITE_API_URL=https://your-backend.onrender.com/api` in Vercel env settings

---

## 🔒 Security

- **Passwords** → Argon2id (64MB memory, 3 iterations, 4 threads)
- **API Keys & Tokens** → Fernet AES-128-CBC + HMAC-SHA256
- **Sessions** → JWT (HS256, 24h expiry)
- All secrets stored encrypted; only masked views shown in UI

---

## 📄 License

MIT — built with ❤️ by [yogender-ai](https://github.com/yogender-ai)
