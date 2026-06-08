FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1280
ENV SCREEN_HEIGHT=800
ENV SCREEN_DEPTH=24

RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    x11vnc \
    websockify \
    novnc \
    fluxbox \
    xdotool \
    supervisor \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 5900 6080
CMD ["/start.sh"]