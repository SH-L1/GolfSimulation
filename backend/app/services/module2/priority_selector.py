from typing import Any

METRIC_GROUPS = {
    "Power": [
        "XFACTOR",
        "HIPROTATION",
        "SHOULDERROT",
        "BACKSWINGMAX",
    ],
    "Contact": [
        "WRISTANGLE",
        "HIPROTATION",
        "XFACTOR",
        "SHOULDERROT",
    ],
    "Stability": [
        "SPINETILT",
        "STANCERATIO",
    ],
    "Safety": [
        "SPINETILT",
        "HIPROTATION",
    ],
    "Learning": [],
}

class PrioritySelector:
    def select(self, user_question: str, analysis_result: dict | None) -> dict[str, Any]:
        goal = self._infer_goal_from_question(user_question)

        weak_metrics = self._extract_weak_metrics(analysis_result)
        weak_phases = self._extract_weak_phases(analysis_result)

        if goal == "Learning":
            goal = self._fallback_goal_from_analysis(weak_metrics, weak_phases)

        focus_metrics = self._pick_focus_metrics(goal, weak_metrics)
        focus_phase = self._pick_focus_phase(goal, weak_phases)

        return {
            "goal": goal,
            "focusMetrics": focus_metrics,
            "focusPhase": focus_phase,
            "weakMetrics": weak_metrics,
            "weakPhases": weak_phases,
        }

    def _infer_goal_from_question(self, question: str) -> str:
        q = question.lower()

        if any(k in q for k in ["비거리", "파워", "힘", "멀리", "거리"]):
            return "Power"
        if any(k in q for k in ["임팩트", "정타", "컨택", "맞", "손목"]):
            return "Contact"
        if any(k in q for k in ["균형", "흔들", "자세", "안정", "밸런스"]):
            return "Stability"
        if any(k in q for k in ["허리", "통증", "불편", "아프", "무리"]):
            return "Safety"

        return "Learning"

    def _extract_weak_metrics(self, analysis_result: dict | None) -> list[dict]:
        if not analysis_result:
            return []

        metrics = analysis_result.get("metrics", [])
        normalized = []

        if isinstance(metrics, dict):
            for metric_id, payload in metrics.items():
                if isinstance(payload, dict):
                    normalized.append({"metricId": metric_id, **payload})
        elif isinstance(metrics, list):
            normalized = metrics

        weak = []
        for m in normalized:
            score = m.get("score")
            metric_id = m.get("metricId")
            if metric_id is None:
                continue
            if score is None:
                continue
            if score < 80:
                weak.append(m)

        weak.sort(key=lambda x: x.get("score", 999))
        return weak

    def _extract_weak_phases(self, analysis_result: dict | None) -> dict[str, float]:
        if not analysis_result:
            return {}

        phase_scores = analysis_result.get("phaseScores", {})
        weak_phases = {}

        for phase, score in phase_scores.items():
            if score < 80:
                weak_phases[phase] = score

        return dict(sorted(weak_phases.items(), key=lambda item: item[1]))

    def _fallback_goal_from_analysis(self, weak_metrics: list[dict], weak_phases: dict[str, float]) -> str:
        weak_metric_ids = [m["metricId"] for m in weak_metrics]

        if "impact" in weak_phases:
            return "Contact"
        if any(m in weak_metric_ids for m in METRIC_GROUPS["Power"]):
            return "Power"
        if any(m in weak_metric_ids for m in METRIC_GROUPS["Stability"]):
            return "Stability"

        return "Learning"

    def _pick_focus_metrics(self, goal: str, weak_metrics: list[dict]) -> list[dict]:
        target_ids = set(METRIC_GROUPS.get(goal, []))
        selected = [m for m in weak_metrics if m.get("metricId") in target_ids]
        return selected[:2]

    def _pick_focus_phase(self, goal: str, weak_phases: dict[str, float]) -> str | None:
        if not weak_phases:
            return None

        if goal == "Contact" and "impact" in weak_phases:
            return "impact"
        if goal == "Power":
            if "impact" in weak_phases:
                return "impact"
            if "top" in weak_phases:
                return "top"
        if goal == "Stability":
            if "address" in weak_phases:
                return "address"
            if "finish" in weak_phases:
                return "finish"

        return next(iter(weak_phases.keys()), None)