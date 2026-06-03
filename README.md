# <p align="center">⚡ Cloud Command</p>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=800&size=34&duration=2300&pause=700&color=38BDF8&center=true&vCenter=true&width=920&lines=Unified+DevOps+Command+Center;Monitor+Sites+%E2%80%A2+Manage+APIs+%E2%80%A2+Control+Deployments;Render+%E2%9C%A6+Vercel+%E2%9C%A6+FastAPI+%E2%9C%A6+React;Built+for+builders+who+ship" alt="Cloud Command animated title" />
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=185&color=0:020617,28:0ea5e9,58:7c3aed,100:22c55e&text=MISSION%20CONTROL%20FOR%20YOUR%20STACK&fontColor=ffffff&fontAlignY=36&fontSize=35&desc=Uptime%20%7C%20API%20Keys%20%7C%20Deployments%20%7C%20Scheduled%20Jobs%20%7C%20Analytics&descAlignY=60&animation=fadeIn" alt="Cloud Command space banner" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge" alt="Status Active" />
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=06121f" alt="React 19" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL Neon" />
  <img src="https://img.shields.io/badge/Deploy-Render%20%2B%20Vercel-111827?style=for-the-badge&logo=vercel&logoColor=white" alt="Render and Vercel" />
</p>

<p align="center">
  <b>Cloud Command</b> is a premium full-stack DevOps dashboard for monitoring websites, managing encrypted API credentials, controlling Render and Vercel deployments, scheduling background jobs, and tracking platform analytics from one focused command center.
</p>

---

## ✨ Showcase

<table>
  <tr>
    <td width="50%">
      <h3>🚀 Mission Control Dashboard</h3>
      <p>See uptime, latency, visits, API usage, and deployment health in one clean operational view.</p>
    </td>
    <td width="50%">
      <h3>🔐 Secure API Vault</h3>
      <p>Store provider keys safely with Fernet encryption, masked display, categories, validation, and usage tracking.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🌐 Site Monitoring</h3>
      <p>Track monitored URLs with warmup-aware checks, memory-backed recent logs, email alerts, and smart free-tier controls.</p>
    </td>
    <td width="50%">
      <h3>🛰️ Render + Vercel Hubs</h3>
      <p>Connect platform accounts, view services/projects, manage deployment workflows, and keep infrastructure close to the app.</p>
    </td>
  </tr>
</table>

---

## 🧠 What It Does

| Area | Capability |
| --- | --- |
| 📊 Dashboard | Uptime metrics, site health, platform visits, API activity, quick operational overview |
| 🌐 Site Monitor | URL checks, latency tracking, status history, outage detection, background pinger |
| ⏱️ Scheduled Jobs | Background job scheduling, job logs, repeatable operational tasks |
| 🔑 API Vault | Encrypted key storage, live provider validation, categories, masked secrets |
| 🛡️ Gateway Keys | Gateway API key management for controlled AI/API access |
| 🟢 Render Hub | Render account connection, service visibility, deployment operations |
| ▲ Vercel Hub | Vercel account connection, project/deployment/domain management |
| 🔔 Alerts | Email notifications for important monitoring events |
| 🎨 Experience | Animated background, theme switching, responsive dashboard UI |

---

## 🏗️ Architecture

```text
Cloud Command
├── backend
│   ├── main.py              # FastAPI app, routers, lifespan tasks, security headers
│   ├── config.py            # Environment-driven settings
│   ├── database.py          # SQLAlchemy engine/session setup
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic schemas
│   ├── security.py          # Argon2 password hashing, Fernet encryption, JWT auth
│   ├── routers              # Auth, monitors, API keys, gateway, Render, Vercel, settings
│   └── services             # Pinger, scheduler, mailer, API validator
│
├── frontend
│   ├── src
│   │   ├── pages            # Dashboard, SiteMonitor, ApiVault, RenderHub, VercelHub, Settings
│   │   ├── components       # Sidebar, theme switcher, animated background, editors
│   │   ├── api              # Axios API client
│   │   └── App.jsx          # Protected routes and app shell
│   ├── vite.config.js
│   └── vercel.json
│
└── render.yaml              # Render backend blueprint
```

---

## 🛠️ Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Axios, Framer Motion, Recharts, Sonner, Lucide React |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic, SlowAPI |
| Database | PostgreSQL, Neon, SQLite fallback for local development |
| Security | Argon2id password hashing, Fernet encryption, JWT sessions, security headers |
| Integrations | Render API, Vercel API, Resend email, HTTPX validators |
| Deployment | Render backend, Vercel frontend |

---

## 🚀 Quick Start

### 1. Clone

```bash
git clone https://github.com/yogender-ai/Cloud-Command.git
cd "Cloud Command"
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

For macOS/Linux activation:

```bash
source .venv/bin/activate
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## 🔐 Environment Variables

### Backend: `backend/.env`

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL/Neon connection string. Local fallback uses SQLite. |
| `JWT_SECRET` | Yes | Secret used to sign auth tokens. |
| `ENCRYPTION_KEY` | Yes | Fernet key used to encrypt stored API keys and tokens. |
| `GATEWAY_SECRET` | Recommended | Secret for gateway-level protection. |
| `RESEND_API_KEY` | Email alerts | API key for email delivery. |
| `MAIL_FROM_EMAIL` | Email alerts | Sender email address. |
| `MAIL_FROM_NAME` | Email alerts | Sender display name. |
| `RENDER_EXTERNAL_URL` | Render/self-ping | Public backend URL. |
| `GATEWAY_PUBLIC_URL` | Optional | Public gateway URL; defaults to Render URL. |
| `ENABLE_BACKGROUND_PINGER` | Optional | Enables URL monitoring worker. |
| `ENABLE_SCHEDULED_JOBS` | Optional | Enables scheduled job worker. |
| `ENABLE_SELF_PING` | Optional | Keeps the Render service warm when configured. |
| `PINGER_WRITE_RESULTS` | Optional | Writes ping logs to DB when true. Keep false to reduce Neon usage. |

Generate a Fernet encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend: `frontend/.env.local`

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Production | Backend API base URL, for example `https://your-api.onrender.com/api`. |

---

## ☁️ Deployment

### Backend on Render

The root `render.yaml` is ready for a Render web service.

```text
Runtime: Python
Root directory: backend
Build: pip install -r requirements.txt
Start: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Recommended free-tier settings are already represented in `render.yaml`, including slower pinger refreshes, self-ping support, and reduced database writes.

### Frontend on Vercel

Deploy the `frontend` directory to Vercel and set:

```text
VITE_API_URL=https://your-render-backend.onrender.com/api
```

The included `frontend/vercel.json` rewrites all routes to `index.html` for React Router support.

---

## 🛡️ Security Model

| Protection | Implementation |
| --- | --- |
| Passwords | Argon2id hashing |
| Stored API keys | Fernet encryption |
| Sessions | JWT with HS256 and 24-hour expiry |
| Abuse control | SlowAPI rate limiting |
| Browser hardening | Security headers for content type, frames, XSS, and HSTS |
| Secret display | Masked values in the UI |

---

## 🌌 Project Highlights

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=22&duration=2200&pause=900&color=FACC15&center=true&vCenter=true&width=850&lines=Built+as+a+real+operational+dashboard.;Designed+for+monitoring%2C+security%2C+and+deployment+control.;Optimized+for+Render+and+Neon+free-tier+survival.;Made+to+look+like+a+command+center%2C+not+a+plain+CRUD+app." alt="Cloud Command project highlights animation" />
</p>

```text
One dashboard.
Many moving parts.
Clear control.
```

---

## 📦 Useful Commands

| Command | Location | Action |
| --- | --- | --- |
| `uvicorn main:app --reload` | `backend` | Run the API locally |
| `npm run dev` | `frontend` | Run the React app locally |
| `npm run build` | `frontend` | Build the frontend for production |
| `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | `backend` | Generate encryption key |

---

## 📄 License

MIT License.

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=130&section=footer&color=0:020617,35:0ea5e9,70:7c3aed,100:22c55e&animation=twinkling" alt="Cloud Command animated footer" />
</p>
