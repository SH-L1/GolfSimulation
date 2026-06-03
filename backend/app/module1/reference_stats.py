"""
레퍼런스 통계

reference_stats_golfdb.json (GolfDB face_on 461개 실측값) 을 우선 로드.
파일이 없으면 문헌 기반 예상값(fallback) 사용.
"""
import json
from pathlib import Path

# ── 문헌 기반 예상값 (fallback) ───────────────────────────────────
REFERENCE_STATS_LITERATURE = {
    "STANCE_RATIO": {"mean": 1.05, "std": 0.08, "source": "GolfDB 전처리 예상"},
    "SHOULDER_ROT": {"mean": 100.0, "std": 7.0,  "source": "Zheng et al., 2008"},
    "X_FACTOR":     {"mean": 45.0,  "std": 5.2,  "source": "McNally et al., 2019"},
    "BACKSWING_MAX":{"mean": 92.0,  "std": 7.1,  "source": "McTeigue et al., 1994"},
    "HIP_ROTATION": {"mean": 40.0,  "std": 4.8,  "source": "Zheng et al., 2008"},
    "SPINE_TILT":   {"mean": 35.0,  "std": 5.0,  "source": "Lindsay et al., 2002"},
}

# ── Phase 가중치 (Overall Score) ──────────────────────────────────
PHASE_WEIGHTS = {
    "address": 0.15,
    "top":     0.25,
    "impact":  0.45,
    "finish":  0.15,
}

# ── 지표 → 페이즈 매핑 ────────────────────────────────────────────
# SHOULDER_ROT은 mid_backswing 이벤트를 사용하지만 Top 페이즈 점수에 포함
METRIC_PHASE = {
    "STANCE_RATIO": "address",
    "SHOULDER_ROT": "top",
    "X_FACTOR":     "top",
    "BACKSWING_MAX":"top",
    "HIP_ROTATION": "impact",
    "SPINE_TILT":   "finish",
}

_GOLFDB_STATS_PATH = Path(__file__).parent / "reference_stats_golfdb.json"


def load_reference_stats() -> dict:
    """
    GolfDB 실측 통계 파일이 있으면 로드, 없으면 문헌 기반 예상값 사용.
    """
    if _GOLFDB_STATS_PATH.exists():
        with open(_GOLFDB_STATS_PATH, 'r', encoding='utf-8') as f:
            stats = json.load(f)
        print(f"[reference_stats] GolfDB 실측값 로드: {_GOLFDB_STATS_PATH}")
        return stats
    print("[reference_stats] GolfDB 실측값 없음 → 문헌 기반 예상값 사용")
    return REFERENCE_STATS_LITERATURE


# 모듈 임포트 시 자동 로드
REFERENCE_STATS = load_reference_stats()
