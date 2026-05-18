class SwingScorer:
    def score(self, poses: list[dict], events: list[dict], reference: dict) -> dict:
        frame_count = len(poses)
        event_count = len(events)

        overall_score = min(100.0, 40.0 + frame_count * 2.0 + event_count * 8.0)

        return {
            "referenceversion": reference.get("referenceversion", "v1"),
            "overallscore": round(overall_score, 2),
            "phasescores": {
                "address": 72.0 if frame_count > 0 else 0.0,
                "top": 64.0 if frame_count > 3 else 0.0,
                "impact": 58.0 if event_count > 2 else 0.0,
                "finish": 67.0 if frame_count > 5 else 0.0,
            },
            "metrics": [
                {
                    "metricid": "FRAMECOUNT",
                    "uservalue": float(frame_count),
                    "promean": 12.0,
                    "prostd": 2.0,
                    "idealrange": [10.0, 14.0],
                    "unit": "frames",
                    "score": min(100.0, frame_count * 8.0),
                },
                {
                    "metricid": "EVENTCOUNT",
                    "uservalue": float(event_count),
                    "promean": 4.0,
                    "prostd": 0.0,
                    "idealrange": [4.0, 4.0],
                    "unit": "events",
                    "score": min(100.0, event_count * 25.0),
                },
            ],
            "recommendations": [
                {
                    "metricid": "FRAMECOUNT",
                    "title": "분석 파이프라인 연결 완료",
                    "body": "현재는 bootstrap 스코어러입니다. 실제 포즈 및 이벤트 결과를 연결하면 분석 정확도를 높일 수 있습니다.",
                    "drilltitle": "Pose extraction integration",
                    "drillpreviewurl": None,
                }
            ],
            "summary": "Bootstrap scoring completed.",
        }