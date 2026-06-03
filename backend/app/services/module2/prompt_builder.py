from typing import Any


GENERAL_DRILL_LIBRARY = [
    {
        "goal": "Power",
        "title": "스텝 회전 드릴",
        "cue": "다운스윙에서 왼발 쪽으로 체중이 옮겨지며 골반이 먼저 열리게 느껴보세요.",
    },
    {
        "goal": "Power",
        "title": "벨트 버클 타깃 드릴",
        "cue": "임팩트 후 벨트 버클이 타깃을 향하게 마무리하세요.",
    },
    {
        "goal": "Contact",
        "title": "펌프 트랜지션 드릴",
        "cue": "탑에서 바로 손을 던지지 말고 하체가 먼저 시작하는 전환을 3번 반복해보세요.",
    },
    {
        "goal": "Contact",
        "title": "탑 정지 드릴",
        "cue": "탑에서 1초 멈춘 뒤 천천히 내려오며 순서를 느껴보세요.",
    },
    {
        "goal": "Stability",
        "title": "양발 붙임 드릴",
        "cue": "양발을 붙이고 작은 스윙을 하면서 상체 흔들림을 줄여보세요.",
    },
    {
        "goal": "Stability",
        "title": "피니시 3초 정지 드릴",
        "cue": "피니시에서 3초간 버티며 균형이 무너지지 않는지 확인하세요.",
    },
    {
        "goal": "Safety",
        "title": "무리 없는 회전 범위 드릴",
        "cue": "통증 없는 범위에서 작은 스윙으로 회전의 질만 개선하고 크기는 욕심내지 마세요.",
    },
    {
        "goal": "Learning",
        "title": "슬로우 모션 시퀀스 드릴",
        "cue": "50% 속도로 스윙하며 하체-몸통-팔 순서를 느껴보세요.",
    },
]


class PromptBuilder:
    def build(
        self,
        user_question: str,
        experience_level: str,
        context: dict[str, Any],
        priority: dict[str, Any],
    ) -> str:
        analysis_result = context.get("analysisResult")
        chat_context = context.get("chatContext", {})
        summary = chat_context.get("summary", {})
        recent_messages = chat_context.get("recentMessages", [])

        mode = "analysis-guided" if analysis_result else "general-coaching"
        fallback_drill = self._pick_fallback_drill(priority.get("goal", "Learning"))

        return f"""
당신은 한국어로 답하는 골프 스윙 코치 AI다.

[역할]
- 사용자의 질문에 골프 코치처럼 명확하게 답한다.
- 항상 한국어로 답한다.
- 초보자는 쉬운 표현으로 설명한다.
- 외적 초점 cue를 우선 사용한다.
- 의료 진단은 하지 않는다.
- 답변은 길게 늘어놓지 말고 실전 코칭처럼 말한다.

[현재 모드]
{mode}

[사용자 수준]
{experience_level}

[이번 답변 목표]
{priority.get("goal")}

[집중 phase]
{priority.get("focusPhase")}

[집중 metric]
{self._format_focus_metrics(priority.get("focusMetrics", []))}

[현재 대화 요약]
{summary}

[최근 대화]
{self._format_recent_messages(recent_messages)}

[분석 결과]
{analysis_result if analysis_result else "분석 데이터 없음"}

[분석 데이터가 없을 때 기본 drill]
{fallback_drill}

[답변 규칙]
1. 한 줄 진단부터 시작한다.
2. 그 다음 원인을 설명한다.
3. 교정 cue 1개를 준다.
4. drill 1개를 제안한다.
5. 데이터가 있으면 반드시 그 데이터 해석을 우선한다.
6. 데이터가 없으면 일반적인 골프 원리에 기반해 조심스럽게 설명한다.
7. 통증 관련 질문이면 무리한 교정보다 안전을 우선한다.
8. 같은 말을 반복하지 말고 최근 대화를 참고해 이어서 답한다.
9. 사고과정은 출력하지 않는다.

[사용자 질문]
{user_question}

이제 최종 답변만 작성하라.
""".strip()

    def _pick_fallback_drill(self, goal: str) -> dict:
        for drill in GENERAL_DRILL_LIBRARY:
            if drill["goal"] == goal:
                return drill
        return GENERAL_DRILL_LIBRARY[-1]

    def _format_focus_metrics(self, metrics: list[dict]) -> str:
        if not metrics:
            return "없음"

        rows = []
        for metric in metrics:
            rows.append(
                f"{metric.get('metricId')} (score={metric.get('score')}, userValue={metric.get('userValue')}, proMean={metric.get('proMean')})"
            )
        return "\n".join(rows)

    def _format_recent_messages(self, messages: list[dict]) -> str:
        if not messages:
            return "없음"

        rows = []
        for m in messages[-6:]:
            rows.append(f"{m.get('role')}: {m.get('content')}")
        return "\n".join(rows)