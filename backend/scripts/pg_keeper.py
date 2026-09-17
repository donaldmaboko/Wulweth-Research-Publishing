"""Start the local PostgreSQL server (pgserver distribution) and keep it alive.

The sandbox/development environment ships PostgreSQL 16 via the `pgserver`
wheel (no system packages needed). In production this file is unnecessary:
set DATABASE_URL to your managed PostgreSQL instance.
"""
import signal

import pgserver

db = pgserver.get_server("/home/user/.pgdata")
uri = db.get_uri()
print(f"[pg-keeper] PostgreSQL ready — connect via {uri}", flush=True)
signal.pause()
