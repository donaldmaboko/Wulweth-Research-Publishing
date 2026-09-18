#!/usr/bin/env bash
# Start the Wulweth API (development).
# Ensures the local PostgreSQL server is running, then launches uvicorn.
set -e
cd "$(dirname "$0")"

PY="${PYTHON:-/home/user/venv/bin/python}"

# Ensure local PostgreSQL (pgserver distribution) is up; keep a keeper process.
if ! "$PY" -c "
import socket, pathlib
sock = pathlib.Path('/home/user/.pgdata/.s.PGSQL.5432')
raise SystemExit(0 if sock.exists() else 1)
" 2>/dev/null; then
  nohup "$PY" scripts/pg_keeper.py >> .data/pg_keeper.log 2>&1 &
  sleep 3
fi

if [ "$WULWETH_NO_RELOAD" = "1" ]; then
  exec "$PY" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
else
  exec "$PY" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
