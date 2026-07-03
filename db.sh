#!/usr/bin/env zsh
set -euo pipefail

NAME="${NAME:-nest-lab-db}"
PORT="${PORT:-5432}"
USER="${USER:-postgres}"
PASS="${PASS:-postgres}"
DB="${DB:-nest_lab}"

if docker ps --format '{{.Names}}' | grep -q "^$NAME$"; then
  echo "✓ Container $NAME already running"
else
  if docker ps -a --format '{{.Names}}' | grep -q "^$NAME$"; then
    docker start "$NAME"
    echo "✓ Started existing container $NAME"
  else
    docker run -d --name "$NAME" \
      -p "$PORT:5432" \
      -e POSTGRES_USER="$USER" \
      -e POSTGRES_PASSWORD="$PASS" \
      -e POSTGRES_DB="$DB" \
      postgres:16
    echo "✓ Created and started container $NAME"
  fi
fi

echo "postgresql://$USER:$PASS@localhost:$PORT/$DB"
