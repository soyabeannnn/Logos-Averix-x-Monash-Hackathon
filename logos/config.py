import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_SOURCE = os.getenv("DATA_SOURCE", str(ROOT))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'logos.db'}")
CLASSIFY_MODEL = os.getenv("CLASSIFY_MODEL", "claude-haiku-4-5-20251001")
EXTRACT_MODEL = os.getenv("EXTRACT_MODEL", "claude-sonnet-5")
LOW_CONFIDENCE = float(os.getenv("LOW_CONFIDENCE", "0.7"))
CONSISTENCY_CHECK = os.getenv("CONSISTENCY_CHECK", "true").lower() == "true"
LIMIT = int(os.getenv("LIMIT", "0"))  # 0 = process everything
WORKERS =int(os.getenv("WORKERS", "6"))
