#!/bin/bash
set -e

echo "Starting Remote Browser Container..."
echo "Screen: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH}"

# Start supervisor to manage all processes
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
