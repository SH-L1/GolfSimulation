import json
from pathlib import Path

from app.core.config import settings


class ReferenceLoader:
    def load(self, viewtype: str, clubtype: str) -> dict:
        path = Path(settings.reference_stats_path)

        if not path.exists():
            return {
                "referenceversion": "v1",
                "viewtype": viewtype,
                "clubtype": clubtype,
                "metrics": {},
            }

        data = json.loads(path.read_text(encoding="utf-8"))

        return {
            "referenceversion": data.get("referenceversion", "v1"),
            "viewtype": viewtype,
            "clubtype": clubtype,
            "metrics": data.get("metrics", {}),
        }