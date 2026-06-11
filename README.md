#  Remote Browser Control System
### BLD SDE Intern Assignment

A mini TeamViewer for browsers. Spin up a Dockerized headless Chromium, stream it to a web UI, and control it fully — click, scroll, type — all from your browser.

---

##  Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Your Browser (localhost:3000)                              │
│  React UI ──── shows noVNC iframe (localhost:6080)         │
│              ──── controls via backend API (:3001)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + Socket.IO
┌──────────────────────▼──────────────────────────────────────┐
│  Node.js Backend (localhost:3001)                           │
│  - Manages Docker container lifecycle                       │
│  - Proxies navigation commands via xdotool                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ docker run / exec
┌──────────────────────▼──────────────────────────────────────┐
│  Docker Container                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Xvfb    │  │Chromium  │  │  x11vnc  │  │websockify │  │
│  │  :99     │→ │(headless)│→ │  :5900   │→ │  :6080    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**
1. React UI → POST `/api/start` → Node.js runs `docker run`
2. Container starts: Xvfb (virtual display) + Chromium + x11vnc + websockify
3. noVNC in the iframe connects to websockify on `:6080` → live stream
4. User input in noVNC frame goes directly to the container's Chromium
5. Navigate button → POST `/api/navigate` → `docker exec xdotool` types URL

---

##  Prerequisites

Make sure these are installed before running:

| Tool | Check | Install |
|------|-------|---------|
| Docker | `docker --version` | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Node.js ≥ 18 | `node --version` | [nodejs.org](https://nodejs.org) |
| npm | `npm --version` | Comes with Node.js |

---

##  Setup & Run Commands

### Step 1 — Clone / Download the project
```bash
git clone <your-repo-url>
cd remote-browser-control
```

### Step 2 — Install all Node.js dependencies
```bash
npm install
npm run install:all
```

This installs:
- Root: `concurrently` (runs both servers together)
- `server/`: `express`, `socket.io`, `cors`
- `frontend/`: React, `socket.io-client`

### Step 3 — Build the Docker image (one-time, ~3-5 min)
```bash
cd docker
docker build -t remote-browser-chromium .
cd ..
```

> ⚠️ This downloads Ubuntu + Chromium + noVNC packages. Takes a few minutes the first time.

### Step 4 — Start everything
```bash
npm run dev
```

This starts:
- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:3000`

### Step 5 — Open the UI
Visit: **[http://localhost:3000](http://localhost:3000)**

Click **▶ Start Browser** and wait ~5 seconds for the stream to appear.

---

## 🎮 How to Use

| Action | How |
|--------|-----|
| Start browser | Click "▶ Start Browser" button |
| Navigate to URL | Type in the URL bar and click "Go" |
| Click / Scroll | Directly in the noVNC iframe |
| Type text | Click inside the iframe, then type |
| Stop container | Click "■ Stop Browser" |
| Full screen stream | Click "Open in new tab ↗" |

---

## 🐳 Docker Commands (manual)

```bash
# Build image
docker build -t remote-browser-chromium ./docker

# Run container manually
docker run -d \
  --name remote-browser-instance \
  -p 5900:5900 \
  -p 6080:6080 \
  --shm-size=2g \
  remote-browser-chromium

# View logs
docker logs -f remote-browser-instance

# Stop and remove
docker rm -f remote-browser-instance

# Access noVNC directly
open http://localhost:6080
```

---

## 🔧 Port Reference

| Port | Service |
|------|---------|
| `3000` | React UI |
| `3001` | Node.js backend |
| `5900` | VNC (raw) |
| `6080` | noVNC WebSocket (browser stream) |

---

## 📁 Project Structure

```
remote-browser-control/
├── package.json              # Root — runs both with concurrently
├── docker/
│   ├── Dockerfile            # Ubuntu + Chromium + noVNC
│   ├── supervisord.conf      # Manages Xvfb, Chromium, x11vnc, websockify
│   └── start.sh              # Container entrypoint
├── server/
│   ├── package.json
│   └── index.js              # Express API + Socket.IO
└── frontend/
    ├── package.json
    ├── public/index.html
    └── src/
        ├── App.js            # Main React UI
        └── App.css           # Styles
```

---

## 🛠️ Troubleshooting

**"Cannot connect to Docker daemon"**
```bash
sudo systemctl start docker   # Linux
# or open Docker Desktop on Mac/Windows
```

**Port already in use**
```bash
lsof -ti:3001 | xargs kill   # free port 3001
lsof -ti:6080 | xargs kill   # free port 6080
```

**Container starts but stream is black**
```bash
docker logs remote-browser-instance
# Wait 5-10 seconds, Chromium takes time to render first frame
```

**iframe blocked by browser**
- Open `http://localhost:6080` directly in a new tab instead

---

## 💡 What I Built & What's Next

**Working:**
- Full Docker container lifecycle (start/stop) from UI
- Real-time Chromium stream via noVNC embedded in React
- URL navigation via xdotool inside the container
- Live status updates via Socket.IO
- Click, scroll, and keyboard input through noVNC

**Next steps (given more time):**
- Replace noVNC iframe with a custom WebRTC stream for lower latency
- Add screenshot capture / download
- Session recording (save as .webm)
- Multiple container support (browser tabs isolation)
- Puppeteer API layer for programmatic control
