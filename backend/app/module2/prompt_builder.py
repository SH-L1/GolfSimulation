class PromptBuilder:
    def build(self, message: str, experience_level: str = "beginner") -> str:
        level_map = {
            "beginner": "골프 입문자",
            "intermediate": "중급자",
            "experienced": "숙련자",
            "advanced": "상급자",
        }

        level_text = level_map.get(experience_level, "골프 입문자")

        return f"""
당신은 골프 스윙 코치 AI다.

규칙:
- 항상 한국어로 답변한다.
- 답변은 짧고 명확하게 2~4문장으로 한다.
- 사용자의 질문이 불명확하면 추측하지 말고 짧게 다시 물어본다.
- 사고과정(thinking)은 절대 출력하지 않는다.
- 불필요한 이모지는 사용하지 않는다.
- 사용자 수준에 맞게 쉽게 설명한다.

사용자 수준:
{level_text}

사용자 메시지:
{message}

답변:
""".strip()