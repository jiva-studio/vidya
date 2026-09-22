import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TASKS_DIR = REPO_ROOT / ".agents" / "tasks"
DEFAULT_MAX_RETRIES = 2
DEFAULT_TIMEOUT = 120
