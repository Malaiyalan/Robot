"""Create / update the database tables:  python migrate.py"""
from pathlib import Path

from alembic import command
from alembic.config import Config

base = Path(__file__).parent
cfg = Config(str(base / "alembic.ini"))
cfg.set_main_option("script_location", str(base / "alembic"))
command.upgrade(cfg, "head")
print("✅ Migration complete.")
