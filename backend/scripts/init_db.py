"""Create the relational schema (idempotent). Run before seeding or first start."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, engine  # noqa: E402
from app import models  # noqa: F401, E402  (register all tables)


def main() -> None:
    Base.metadata.create_all(engine)
    print("[init-db] schema created/verified")


if __name__ == "__main__":
    main()
