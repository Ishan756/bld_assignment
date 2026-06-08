# Architecture Decision Log

## Debian over Ubuntu
Ubuntu 22.04's `chromium-browser` package is a snap stub — it prints an install prompt and exits with code 1. Snaps don't work inside unprivileged Docker containers because they require a snapd daemon and specific kernel namespaces. Switched to `debian:bullseye-slim` where `chromium` is a real apt package that installs and runs without any workarounds.

## noVNC over WebRTC
noVNC (VNC over WebSocket) was the right call for a 48-hour window. It needs zero custom signaling server, works inside an iframe out of the box, and the latency (~150-200ms) is acceptable for a control demo. WebRTC would cut latency to ~50ms but requires a STUN/TURN server, an SDP negotiation layer, and custom frame capture — easily 2-3 days of extra work for marginal gain at localhost.

## supervisord for process management
A Docker container runs one PID 1 process. This system needs four: Xvfb, Chromium, x11vnc, and websockify — all running concurrently with dependency order and auto-restart on crash. supervisord handles all of this declaratively with a single config file. The alternative (a bash script with `&` and `wait`) gives no restart logic and makes debugging nearly impossible.

## xdotool for navigation
xdotool sends OS-level keyboard and mouse input directly to the X display — no browser API needed, no Puppeteer, no CDP. A single `xdotool key ctrl+l && xdotool type <url> && xdotool key Return` sequence works on any application running on the display, not just Chromium. This kept the architecture simple: the backend stays a thin Docker manager rather than a browser automation layer.