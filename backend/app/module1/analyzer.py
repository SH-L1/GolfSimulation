from app.module1.eventdetector import EventDetector
from app.module1.poseextractor import PoseExtractor
from app.module1.referenceloader import ReferenceLoader
from app.module1.scorer import SwingScorer


class Module1Analyzer:
    def __init__(self):
        self.pose_extractor = PoseExtractor()
        self.event_detector = EventDetector()
        self.reference_loader = ReferenceLoader()
        self.scorer = SwingScorer()

    def run(self, video_path: str, viewtype: str, clubtype: str) -> dict:
        poses = self.pose_extractor.extract(
            video_path=video_path,
            viewtype=viewtype,
        )

        events = self.event_detector.detect(poses)
        reference = self.reference_loader.load(
            viewtype=viewtype,
            clubtype=clubtype,
        )

        result = self.scorer.score(
            poses=poses,
            events=events,
            reference=reference,
        )

        return {
            "poses": poses,
            "events": events,
            "result": result,
        }