const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec, execSync } = require('child_process');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

const DOCKER_IMAGE = 'remote-browser-chromium';
const CONTAINER_NAME = 'remote-browser-instance';
const VNC_HOST_PORT = 5900;
const NOVNC_HOST_PORT = 6080;

let containerRunning = false;
let containerId = null;

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) reject({ error, stderr });
      else resolve(stdout.trim());
    });
  });
}

// Check if Docker image exists, build if not
async function ensureImage() {
  try {
    await runCommand(`docker image inspect ${DOCKER_IMAGE}`);
    console.log('Docker image already exists.');
  } catch {
    console.log('Building Docker image...');
    const dockerDir = path.join(__dirname, '..', 'docker');
    await runCommand(`docker build -t ${DOCKER_IMAGE} ${dockerDir}`);
    console.log('Docker image built.');
  }
}

// Start container
async function startContainer() {
  if (containerRunning) return { status: 'already_running', port: NOVNC_HOST_PORT };

  // Stop any old container with same name
  try { await runCommand(`docker rm -f ${CONTAINER_NAME}`); } catch {}

  await ensureImage();

  const cmd = [
    'docker run -d',
    `--name ${CONTAINER_NAME}`,
    `-p ${VNC_HOST_PORT}:5900`,
    `-p ${NOVNC_HOST_PORT}:6080`,
    '--shm-size=2g',
    DOCKER_IMAGE
  ].join(' ');

  containerId = await runCommand(cmd);
  containerRunning = true;

  console.log(`Container started: ${containerId}`);

  // Wait for noVNC to be ready
  await new Promise(r => setTimeout(r, 4000));

  return { status: 'started', port: NOVNC_HOST_PORT, vncPort: VNC_HOST_PORT };
}

// Stop container
async function stopContainer() {
  if (!containerRunning) return { status: 'not_running' };
  try {
    await runCommand(`docker rm -f ${CONTAINER_NAME}`);
  } catch (e) {
    console.error('Error stopping container:', e);
  }
  containerRunning = false;
  containerId = null;
  return { status: 'stopped' };
}

// Get container status
async function getStatus() {
  try {
    const out = await runCommand(`docker ps --filter name=${CONTAINER_NAME} --format "{{.Status}}"`);
    if (out) {
      containerRunning = true;
      return { running: true, status: out, novncPort: NOVNC_HOST_PORT };
    }
  } catch {}
  containerRunning = false;
  return { running: false };
}

// Routes
app.get('/api/status', async (req, res) => {
  const status = await getStatus();
  res.json(status);
});

app.post('/api/start', async (req, res) => {
  try {
    const result = await startContainer();
    io.emit('browser-status', { running: true, ...result });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.stderr || e.message || 'Failed to start container' });
  }
});

app.post('/api/stop', async (req, res) => {
  try {
    const result = await stopContainer();
    io.emit('browser-status', { running: false });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.stderr || e.message || 'Failed to stop container' });
  }
});

// Navigate URL inside container via xdotool
app.post('/api/navigate', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    // Type the URL into Chromium's address bar
    const escaped = url.replace(/"/g, '\\"');
    await runCommand(`docker exec ${CONTAINER_NAME} xdotool key --clearmodifiers ctrl+l`);
    await new Promise(r => setTimeout(r, 300));
    await runCommand(`docker exec ${CONTAINER_NAME} xdotool type --clearmodifiers "${escaped}"`);
    await new Promise(r => setTimeout(r, 100));
    await runCommand(`docker exec ${CONTAINER_NAME} xdotool key --clearmodifiers Return`);
    res.json({ status: 'navigating', url });
  } catch (e) {
    res.status(500).json({ error: e.stderr || e.message });
  }
});

// Socket.IO for real-time status updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  getStatus().then(s => socket.emit('browser-status', s));

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down, stopping container...');
  await stopContainer();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
  console.log(`📺 noVNC (browser stream) will be at http://localhost:${NOVNC_HOST_PORT} after starting`);
});
