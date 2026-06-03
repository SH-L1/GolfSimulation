from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .step1 import Step1SquarePadder
from .step2 import Step2MediaPipePoseExtractor
from .step3 import Step3SwingNetEventDetector
from .step4 import Step4MotionBertDepthEstimator
from .step5 import Step5Postprocessor
from .step6 import Step6PhysicsCorrector
from .step7 import Step7CleanSwingExporter


@dataclass
class PipelineArtifacts:
    session_dir: str
    padded_video_path: str | None = None
    padding_metadata_path: str | None = None
    pose_json_path: str | None = None
    events_json_path: str | None = None
    depth_json_path: str | None = None
    postprocessed_json_path: str | None = None
    physics_json_path: str | None = None
    clean_swing_json_path: str | None = None
    final_json_path: str | None = None


class Module1PipelineRunner:
    VALID_VIEWS = {"faceon", "downtheline"}

    def __init__(
        self,
        base_output_dir: str = "data/processed",
        mediapipe_model_path: str = "models/pose_landmarker_heavy.task",
        swingnet_checkpoint_path: str = "models/swingnet_1800.pth",
        motionbert_checkpoint_path: str = "models/MotionBERT-Base.bin",
        swingnet_repo_dir: str = "external/golfdb",
        motionbert_repo_dir: str = "external/MotionBERT",
        target_size: int = 1024,
    ):
        self.base_output_dir = Path(base_output_dir)
        self.base_output_dir.mkdir(parents=True, exist_ok=True)

        self.mediapipe_model_path = mediapipe_model_path
        self.swingnet_checkpoint_path = swingnet_checkpoint_path
        self.motionbert_checkpoint_path = motionbert_checkpoint_path
        self.swingnet_repo_dir = swingnet_repo_dir
        self.motionbert_repo_dir = motionbert_repo_dir
        self.target_size = target_size

        self.step1 = Step1SquarePadder(target_size=target_size)
        self.step2 = Step2MediaPipePoseExtractor(model_path=mediapipe_model_path)
        self.step5 = Step5Postprocessor()
        self.step6 = Step6PhysicsCorrector()
        self.step7 = Step7CleanSwingExporter()

        self.step3: Step3SwingNetEventDetector | None = None
        self.step4: Step4MotionBertDepthEstimator | None = None

    def _get_step3(self) -> Step3SwingNetEventDetector:
        if self.step3 is None:
            self.step3 = Step3SwingNetEventDetector(
                checkpoint_path=self.swingnet_checkpoint_path,
                repo_dir=self.swingnet_repo_dir,
            )
        return self.step3

    def _get_step4(self) -> Step4MotionBertDepthEstimator:
        if self.step4 is None:
            self.step4 = Step4MotionBertDepthEstimator(
                checkpoint_path=self.motionbert_checkpoint_path,
                repo_dir=self.motionbert_repo_dir,
            )
        return self.step4

    def _validate_inputs(self, video_path: str, viewtype: str) -> Path:
        path = Path(video_path)

        if not path.exists():
            raise FileNotFoundError(f"Video not found: {video_path}")

        view_norm = viewtype.strip().lower()
        if view_norm not in self.VALID_VIEWS:
            raise ValueError(
                f"Invalid viewtype: {viewtype}. "
                f"Expected one of {sorted(self.VALID_VIEWS)}"
            )

        return path

    def run(
        self,
        video_path: str,
        viewtype: str,
        clubtype: str,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        video_file = self._validate_inputs(video_path, viewtype)
        viewtype = viewtype.strip().lower()

        run_id = (session_id or video_file.stem).strip()
        session_dir = self.base_output_dir / run_id
        session_dir.mkdir(parents=True, exist_ok=True)

        artifacts = PipelineArtifacts(session_dir=str(session_dir))

        step1_output = self.step1.run(
            video_path=str(video_file),
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.padded_video_path = step1_output["padded_video_path"]
        artifacts.padding_metadata_path = step1_output["metadata_path"]

        step2_output = self.step2.run(
            square_video_path=artifacts.padded_video_path,
            metadata_path=artifacts.padding_metadata_path,
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.pose_json_path = step2_output["pose_json_path"]

        step3_output = self._get_step3().run(
            source_video_path=artifacts.padded_video_path,
            pose_json_path=artifacts.pose_json_path,
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.events_json_path = step3_output["events_json_path"]

        step4_output = self._get_step4().run(
            pose_json_path=artifacts.pose_json_path,
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.depth_json_path = step4_output["depth_json_path"]

        step5_output = self.step5.run(
            pose_json_path=artifacts.pose_json_path,
            events_json_path=artifacts.events_json_path,
            depth_json_path=artifacts.depth_json_path,
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.postprocessed_json_path = step5_output["postprocessed_json_path"]

        step6_output = self.step6.run(
            postprocessed_json_path=artifacts.postprocessed_json_path,
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.physics_json_path = step6_output["physics_json_path"]

        step7_output = self.step7.run(
            physics_json_path=artifacts.physics_json_path,
            output_dir=str(session_dir),
            viewtype=viewtype,
        )
        artifacts.clean_swing_json_path = step7_output["cleanswing_json_path"]
        artifacts.final_json_path = artifacts.clean_swing_json_path

        return {
            "run_id": run_id,
            "session_dir": str(session_dir),
            "artifacts": asdict(artifacts),
            "final_json_path": artifacts.final_json_path,
            "viewtype": viewtype,
            "clubtype": clubtype,
            "step1": step1_output,
            "step2": step2_output,
            "step3": step3_output,
            "step4": step4_output,
            "step5": step5_output,
            "step6": step6_output,
            "step7": step7_output,
        }