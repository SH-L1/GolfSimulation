class EventDetector:
    def detect(self, poses: list[dict]) -> list[dict]:
        if not poses:
            return []

        first_frame = poses[0]["frameidx"]
        last_frame = poses[-1]["frameidx"]

        top_frame = poses[len(poses) // 2]["frameidx"] if len(poses) >= 3 else first_frame
        impact_frame = poses[min(len(poses) - 1, max(1, len(poses) * 3 // 4))]["frameidx"]

        return [
            {
                "eventlabel": "Address",
                "frameidx": first_frame,
                "confidence": 1.0,
                "detectionmethod": "bootstrap",
            },
            {
                "eventlabel": "Top",
                "frameidx": top_frame,
                "confidence": 0.75,
                "detectionmethod": "bootstrap",
            },
            {
                "eventlabel": "Impact",
                "frameidx": impact_frame,
                "confidence": 0.7,
                "detectionmethod": "bootstrap",
            },
            {
                "eventlabel": "Finish",
                "frameidx": last_frame,
                "confidence": 0.8,
                "detectionmethod": "bootstrap",
            },
        ]