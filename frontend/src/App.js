import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const BACKEND = 'http://localhost:3001';
const NOVNC_URL = 'http://localhost:6080/vnc.html?autoconnect=1&resize=scale&view_only=0';

const socket = io(BACKEND);

function App() {
  const [status, setStatus] = useState({ running: false });
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const logRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-49), { msg, type, time }]);
  };

  useEffect(() => {
    // Check initial status
    fetch(`${BACKEND}/api/status`)
      .then(r => r.json())
      .then(s => {
        setStatus(s);
        if (s.running) addLog('Container already running', 'success');
      });

    socket.on('browser-status', (s) => {
      setStatus(s);
      if (s.running) addLog('Browser container is live', 'success');
      else addLog('Browser container stopped', 'warn');
    });

    return () => socket.off('browser-status');
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleStart = async () => {
    setLoading(true);
    setLoadingMsg('Pulling Docker image...');
    addLog('Starting browser container...');
    try {
      setLoadingMsg('Spinning up Chromium...');
      const res = await fetch(`${BACKEND}/api/start`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addLog(`Container started on port ${data.port}`, 'success');
      setLoadingMsg('Waiting for stream...');
      await new Promise(r => setTimeout(r, 2500));
      setIframeLoaded(false);
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error');
    }
    setLoading(false);
    setLoadingMsg('');
  };

  const handleStop = async () => {
    setLoading(true);
    addLog('Stopping container...');
    try {
      await fetch(`${BACKEND}/api/stop`, { method: 'POST' });
      setIframeLoaded(false);
      addLog('Container stopped.', 'warn');
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error');
    }
    setLoading(false);
  };

  const handleNavigate = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    addLog(`Navigating to: ${url}`);
    try {
      const res = await fetch(`${BACKEND}/api/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addLog(`Navigation triggered`, 'success');
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error');
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">RemoteBrowser</span>
          </div>
          <div className={`status-badge ${status.running ? 'running' : 'stopped'}`}>
            <span className="status-dot" />
            {status.running ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
        <div className="header-actions">
          {!status.running ? (
            <button className="btn btn-start" onClick={handleStart} disabled={loading}>
              {loading ? <><span className="spinner" /> {loadingMsg || 'Starting...'}</> : '▶ Start Browser'}
            </button>
          ) : (
            <button className="btn btn-stop" onClick={handleStop} disabled={loading}>
              {loading ? <><span className="spinner" /> Stopping...</> : '■ Stop Browser'}
            </button>
          )}
        </div>
      </header>

      {/* URL Bar */}
      {status.running && (
        <div className="urlbar">
          <form onSubmit={handleNavigate} className="urlbar-form">
            <span className="urlbar-icon">🌐</span>
            <input
              className="urlbar-input"
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="Enter URL (e.g. google.com)"
            />
            <button className="urlbar-btn" type="submit">Go</button>
          </form>
        </div>
      )}

      {/* Main content */}
      <div className="main">
        {/* Browser frame */}
        <div className="browser-panel">
          {!status.running && !loading && (
            <div className="idle-screen">
              <div className="idle-content">
                <div className="idle-icon">◈</div>
                <h2>Remote Browser Control</h2>
                <p>Click <strong>Start Browser</strong> to spin up a Dockerized Chromium instance and stream it here.</p>
                <ul className="feature-list">
                  <li>🐳 Docker-isolated Chromium</li>
                  <li>📺 Real-time VNC stream via noVNC</li>
                  <li>🖱️ Full click, scroll & type support</li>
                  <li>🌐 Remote URL navigation</li>
                </ul>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-screen">
              <div className="loading-content">
                <div className="loading-ring" />
                <p>{loadingMsg || 'Working...'}</p>
              </div>
            </div>
          )}

          {status.running && !loading && (
            <div className="vnc-wrapper">
              <div className="vnc-label">
                <span>🖥️ Live Browser Stream — interact directly in the frame below</span>
                <a href={NOVNC_URL} target="_blank" rel="noreferrer" className="open-tab-btn">Open in new tab ↗</a>
              </div>
              <iframe
                src={NOVNC_URL}
                className="vnc-frame"
                title="Remote Browser"
                onLoad={() => setIframeLoaded(true)}
                allow="fullscreen"
              />
              {!iframeLoaded && (
                <div className="vnc-overlay">
                  <div className="loading-ring" />
                  <p>Connecting to stream...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side panel: logs */}
        <aside className="side-panel">
          <div className="panel-header">Terminal Logs</div>
          <div className="logs" ref={logRef}>
            {logs.length === 0 && <p className="log-empty">No events yet.</p>}
            {logs.map((l, i) => (
              <div key={i} className={`log-line log-${l.type}`}>
                <span className="log-time">{l.time}</span>
                <span className="log-msg">{l.msg}</span>
              </div>
            ))}
          </div>

          <div className="panel-header" style={{ marginTop: 16 }}>System Info</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Backend</span>
              <span className="info-val">:3001</span>
            </div>
            <div className="info-item">
              <span className="info-label">VNC</span>
              <span className="info-val">:5900</span>
            </div>
            <div className="info-item">
              <span className="info-label">noVNC</span>
              <span className="info-val">:6080</span>
            </div>
            <div className="info-item">
              <span className="info-label">Container</span>
              <span className={`info-val ${status.running ? 'green' : 'red'}`}>
                {status.running ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
