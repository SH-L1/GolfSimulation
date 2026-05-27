from __future__ import annotations

from typing import Any

from .reference_stats import REFERENCE_STATS, PHASE_WEIGHTS, METRIC_PHASE


def score_metric(metric_id: str, user_value: float, stats: dict = None) -> float:
    if stats is None:
        stats = REFERENCE_STATS
    ref = stats[metric_id]
    deviation = abs(user_value - ref["mean"]) / ref["std"]
    return max(0.0, 100.0 - deviation * 20.0)


def compute_scores(metrics: dict, stats: dict = None) -> dict:
    if stats is None:
        stats = REFERENCE_STATS

    metric_scores = {}
    for metric_id, value in metrics.items():
        if metric_id in stats and value is not None:
            metric_scores[metric_id] = round(score_metric(metric_id, value, stats), 1)

    phase_buckets: dict[str, list] = {p: [] for p in PHASE_WEIGHTS}
    for metric_id, score in metric_scores.items():
        phase = METRIC_PHASE.get(metric_id)
        if phase:
            phase_buckets[phase].append(score)

    phase_scores = {}
    for phase, scores in phase_buckets.items():
        if scores:
            phase_scores[phase] = round(sum(scores) / len(scores), 1)

    total_weight = sum(PHASE_WEIGHTS[p] for p in phase_scores)
    if total_weight > 0:
        overall = sum(
            phase_scores[p] * PHASE_WEIGHTS[p] for p in phase_scores
        ) / total_weight
    else:
        overall = 0.0

    return {
        "metrics": metric_scores,
        "phases": phase_scores,
        "overall": round(overall, 1),
    }


def select_priority_coaching(scores: dict, top_n: int = 2) -> list[dict]:
    metric_scores = scores.get("metrics", {})
    ranked = sorted(metric_scores.items(), key=lambda kv: kv[1])

    result = []
    for metric_id, score in ranked[:top_n]:
        result.append(
            {
                "metric_id": metric_id,
                "score": float(score),
                "phase": METRIC_PHASE.get(metric_id, "unknown"),
            }
        )
    return result


class SwingScorer:
    def score(
        self,
        poses: list[dict],
        events: list[dict],
        reference: dict,
        raw_metrics: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        raw_metrics = dict(raw_metrics or {})
        scores = compute_scores(raw_metrics)
        priority = select_priority_coaching(scores, top_n=2)

        return {
            "referenceversion": reference.get("referenceversion", "v1"),
            "overallscore": float(scores.get("overall") or 0.0),
            "phasescores": {
                str(k): float(v) for k, v in (scores.get("phases") or {}).items()
            },
            "metrics": {
                str(k): float(v) for k, v in raw_metrics.items() if v is not None
            },
            "scores": {
                "metrics": {
                    str(k): float(v)
                    for k, v in (scores.get("metrics") or {}).items()
                },
                "phases": {
                    str(k): float(v)
                    for k, v in (scores.get("phases") or {}).items()
                },
                "overall": float(scores.get("overall") or 0.0),
            },
            "prioritycoaching": [
                {
                    "metricid": str(item["metric_id"]),
                    "metric_id": str(item["metric_id"]),
                    "score": float(item["score"]),
                    "phase": str(item["phase"]),
                }
                for item in priority
            ],
            "summary": "Scoring completed.",
        }