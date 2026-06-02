import json
import sys
import subprocess
from pathlib import Path

import numpy as np
import torch


class Step4MotionBertDepthEstimator:
    MODULE_DIR = Path(__file__).resolve().parent
    BACKEND_DIR = MODULE_DIR.parents[1]
    DEFAULT_CHECKPOINT = BACKEND_DIR / "models" / "MotionBERT-Base.bin"
    DEFAULT_REPO_DIR = BACKEND_DIR / "external" / "MotionBERT"

    JOINT17 = [
        "hip_center",
        "right_hip",
        "right_knee",
        "right_ankle",
        "left_hip",
        "left_knee",
        "left_ankle",
        "spine",
        "thorax",
        "nose",
        "head",
        "left_shoulder",
        "left_elbow",
        "left_wrist",
        "right_shoulder",
        "right_elbow",
        "right_wrist",
    ]

    def __init__(
        self,
        checkpoint_path: str | None = None,
        repo_dir: str | None = None,
        device: str | None = None,
        mb_win: int = 243,
        mb_stride: int = 81,
        conf_thr: float = 0.40,
        blend_alpha: float = 0.85,
        zscale: float = 0.3,
        min_shape_match_ratio: float = 0.30,
        min_critical_match_ratio: float = 0.20,
    ):
        self.checkpoint_path = Path(checkpoint_path) if checkpoint_path else self.DEFAULT_CHECKPOINT
        self.repo_dir = Path(repo_dir) if repo_dir else self.DEFAULT_REPO_DIR
        self.device = torch.device(
            device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        )

        self.mb_win = mb_win
        self.mb_stride = mb_stride
        self.conf_thr = conf_thr
        self.blend_alpha = blend_alpha
        self.zscale = zscale
        self.min_shape_match_ratio = min_shape_match_ratio
        self.min_critical_match_ratio = min_critical_match_ratio

        self.load_report = {
            "loaded": False,
            "reason": "not_initialized",
            "shape_match_ratio": 0.0,
            "critical_match_ratio": 0.0,
            "checkpoint_path": str(self.checkpoint_path),
            "repo_dir": str(self.repo_dir),
            "backend_dir": str(self.BACKEND_DIR),
            "device": str(self.device),
            "state_source": None,
        }
        self.model = self._load_model()

    def _ensure_repo(self):
        dstformer_path = self.repo_dir / "lib" / "model" / "DSTformer.py"
        if dstformer_path.exists():
            return

        self.repo_dir.parent.mkdir(parents=True, exist_ok=True)

        if self.repo_dir.exists() and not dstformer_path.exists():
            raise FileNotFoundError(
                f"MotionBERT repo structure invalid: {dstformer_path}"
            )

        subprocess.run(
            [
                "git",
                "clone",
                "https://github.com/Walter0807/MotionBERT.git",
                str(self.repo_dir),
            ],
            check=True,
        )

    def _extract_state_dict(self, checkpoint):
        if not isinstance(checkpoint, dict):
            return checkpoint, "raw"

        candidates = [
            "model_pos",
            "model",
            "model_state_dict",
            "state_dict",
            "module",
            "network",
            "net",
            "teacher",
            "student",
        ]

        for key in candidates:
            value = checkpoint.get(key)
            if isinstance(value, dict):
                return value, key

        if all(isinstance(v, torch.Tensor) for v in checkpoint.values()):
            return checkpoint, "root_tensor_dict"

        return checkpoint, "unknown_dict"

    def _checkpoint_match_report(self, model, state: dict) -> dict:
        model_state = model.state_dict()
        total = len(model_state)
        matched = 0

        critical_keys = []
        for key in model_state.keys():
            lowered = key.lower()
            if any(
                x in lowered
                for x in ["joints_embed", "pos_embed", "blocks.0", "blocks.1", "head"]
            ):
                critical_keys.append(key)

        critical_total = len(critical_keys)
        critical_matched = 0
        sample_matched = []
        sample_mismatched = []
        sample_missing_in_ckpt = []

        for key in model_state.keys():
            if key not in state and len(sample_missing_in_ckpt) < 15:
                sample_missing_in_ckpt.append(key)

        for key, value in state.items():
            if key in model_state:
                if tuple(model_state[key].shape) == tuple(value.shape):
                    matched += 1
                    if key in critical_keys:
                        critical_matched += 1
                    if len(sample_matched) < 15:
                        sample_matched.append({
                            "key": key,
                            "shape": tuple(value.shape),
                        })
                else:
                    if len(sample_mismatched) < 15:
                        sample_mismatched.append({
                            "key": key,
                            "model_shape": tuple(model_state[key].shape),
                            "ckpt_shape": tuple(value.shape),
                        })

        return {
            "loaded": False,
            "reason": "report_only",
            "shape_match_ratio": round(matched / max(total, 1), 4),
            "critical_match_ratio": round(critical_matched / max(critical_total, 1), 4),
            "matched_keys": matched,
            "total_keys": total,
            "critical_matched": critical_matched,
            "critical_total": critical_total,
            "sample_matched": sample_matched,
            "sample_mismatched": sample_mismatched,
            "sample_missing_in_ckpt": sample_missing_in_ckpt,
        }

    def _load_model(self):
        if not self.checkpoint_path.exists():
            self.load_report = {
                **self.load_report,
                "loaded": False,
                "reason": "checkpoint_not_found",
            }
            return None

        try:
            self._ensure_repo()

            if str(self.repo_dir) not in sys.path:
                sys.path.insert(0, str(self.repo_dir))

            from lib.model.DSTformer import DSTformer

            model = DSTformer(
                dim_in=3,
                dim_out=3,
                dim_feat=512,
                dim_rep=512,
                depth=5,
                num_heads=8,
                mlp_ratio=2,
                norm_layer=torch.nn.LayerNorm,
                maxlen=243,
                num_joints=17,
            ).to(self.device)

            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            state, state_source = self._extract_state_dict(checkpoint)

            if not isinstance(state, dict):
                raise RuntimeError(f"invalid_checkpoint_state:{type(state).__name__}")

            state = {
                key[7:] if key.startswith("module.") else key: value
                for key, value in state.items()
            }

            report = self._checkpoint_match_report(model, state)
            report["state_source"] = state_source

            compatible_state = {}
            model_state = model.state_dict()
            for key, value in state.items():
                if key in model_state and tuple(model_state[key].shape) == tuple(value.shape):
                    compatible_state[key] = value

            if (
                report["shape_match_ratio"] < self.min_shape_match_ratio
                or report["critical_match_ratio"] < self.min_critical_match_ratio
            ):
                self.load_report = {
                    **self.load_report,
                    **report,
                    "loaded": False,
                    "reason": "arch_mismatch",
                }
                return None

            missing, unexpected = model.load_state_dict(compatible_state, strict=False)
            model.eval()

            self.load_report = {
                **self.load_report,
                **report,
                "loaded": True,
                "reason": "ok",
                "missing_after_load": list(missing)[:20],
                "unexpected_after_load": list(unexpected)[:20],
            }
            return model

        except Exception as e:
            self.load_report = {
                **self.load_report,
                "loaded": False,
                "reason": f"exception:{type(e).__name__}",
                "message": str(e),
            }
            return None

    def _lm_map(self, frame: dict) -> dict:
        return {
            lm.get("name"): lm
            for lm in frame.get("landmarks", [])
            if lm.get("name")
        }

    def _safe_float(self, value, default=np.nan):
        try:
            if value is None:
                return default
            return float(value)
        except Exception:
            return default

    def _midpoint(self, a: dict | None, b: dict | None):
        if not a or not b:
            return None

        ax = self._safe_float(a.get("x"))
        ay = self._safe_float(a.get("y"))
        bx = self._safe_float(b.get("x"))
        by = self._safe_float(b.get("y"))

        if not np.isfinite(ax) or not np.isfinite(ay) or not np.isfinite(bx) or not np.isfinite(by):
            return None

        return {
            "x": float((ax + bx) / 2.0),
            "y": float((ay + by) / 2.0),
            "visibility": float(min(
                self._safe_float(a.get("visibility"), 0.0),
                self._safe_float(b.get("visibility"), 0.0),
            )),
        }

    def _build_joint17_sequence(self, frames: list[dict]) -> np.ndarray:
        seq = []

        for frame in frames:
            lm = self._lm_map(frame)

            hip_center = self._midpoint(lm.get("left_hip"), lm.get("right_hip"))
            thorax = self._midpoint(lm.get("left_shoulder"), lm.get("right_shoulder"))
            head = self._midpoint(lm.get("left_ear"), lm.get("right_ear")) or lm.get("nose")

            joint_map = {
                "hip_center": hip_center,
                "right_hip": lm.get("right_hip"),
                "right_knee": lm.get("right_knee"),
                "right_ankle": lm.get("right_ankle"),
                "left_hip": lm.get("left_hip"),
                "left_knee": lm.get("left_knee"),
                "left_ankle": lm.get("left_ankle"),
                "spine": hip_center,
                "thorax": thorax,
                "nose": lm.get("nose"),
                "head": head,
                "left_shoulder": lm.get("left_shoulder"),
                "left_elbow": lm.get("left_elbow"),
                "left_wrist": lm.get("left_wrist"),
                "right_shoulder": lm.get("right_shoulder"),
                "right_elbow": lm.get("right_elbow"),
                "right_wrist": lm.get("right_wrist"),
            }

            row = []
            for name in self.JOINT17:
                item = joint_map.get(name) or {}
                x = self._safe_float(item.get("x"), 0.0)
                y = self._safe_float(item.get("y"), 0.0)
                vis = self._safe_float(item.get("visibility"), 0.0)
                row.append([x, y, vis])

            seq.append(row)

        return np.asarray(seq, dtype=np.float32)

    def _infer_motionbert(self, seq2d: np.ndarray) -> np.ndarray | None:
        if self.model is None:
            return None

        if seq2d.ndim != 3 or seq2d.shape[1:] != (17, 3):
            return None

        with torch.no_grad():
            x = torch.from_numpy(seq2d).unsqueeze(0).to(self.device)
            pred = self.model(x)
            if isinstance(pred, (list, tuple)):
                pred = pred[0]
            pred = pred.detach().cpu().numpy()

        if pred.ndim == 4:
            pred = pred[0]

        return pred

    def _build_depth_frames(self, pose_frames: list[dict], pred3d: np.ndarray | None):
        out_frames = []
        total_points = 0
        mb_points = 0

        joint17_to_name = {
            0: "hip_center",
            1: "right_hip",
            2: "right_knee",
            3: "right_ankle",
            4: "left_hip",
            5: "left_knee",
            6: "left_ankle",
            9: "nose",
            11: "left_shoulder",
            12: "left_elbow",
            13: "left_wrist",
            14: "right_shoulder",
            15: "right_elbow",
            16: "right_wrist",
        }

        for fi, frame in enumerate(pose_frames):
            lm_map = self._lm_map(frame)
            zmap = {}

            pred_frame = None
            if pred3d is not None and fi < len(pred3d):
                pred_frame = pred3d[fi]

            for idx, name in joint17_to_name.items():
                total_points += 1

                if pred_frame is not None and idx < len(pred_frame):
                    z_value = float(pred_frame[idx][2]) * self.zscale
                    zmap[name] = {
                        "z": round(z_value, 6),
                        "source": "motionbertrel",
                        "blend_ratio": 1.0,
                        "fallback_mode": "none",
                    }
                    mb_points += 1
                else:
                    base = lm_map.get(name, {})
                    z_fallback = self._safe_float(base.get("z"), 0.0)
                    zmap[name] = {
                        "z": round(z_fallback, 6),
                        "source": "mediapipe_fallback",
                        "blend_ratio": 0.0,
                        "fallback_mode": "pose_world_landmarks_fallback",
                    }

            out_frames.append({
                "frame": int(frame.get("frame", fi)),
                "zmap": zmap,
            })

        used_ratio = round(mb_points / max(total_points, 1), 6)
        fallback_ratio = round(1.0 - used_ratio, 6)
        return out_frames, used_ratio, fallback_ratio

    def run(
        self,
        pose_json_path: str,
        output_dir: str,
        viewtype: str,
    ) -> dict:
        pose_json_path = Path(pose_json_path)
        output_dir = Path(output_dir)

        step_dir = output_dir / "step4" / viewtype
        step_dir.mkdir(parents=True, exist_ok=True)

        with open(pose_json_path, "r", encoding="utf-8") as f:
            pose_data = json.load(f)

        pose_frames = pose_data.get("frames", [])
        seq2d = self._build_joint17_sequence(pose_frames)
        pred3d = self._infer_motionbert(seq2d)

        depth_frames, mb_used_ratio, mb_fallback_ratio = self._build_depth_frames(
            pose_frames, pred3d
        )

        zsource = "motionbert" if mb_used_ratio > 0 else "pose_world_landmarks_fallback"
        mbstatus = "ok" if self.model is not None and mb_used_ratio > 0 else "fallback"
        mbarchok = bool(self.model is not None)

        output = {
            "video": pose_data.get("video"),
            "viewtype": viewtype,
            "fps": float(pose_data.get("fps", 30.0)),
            "totalframes": int(pose_data.get("totalframes", len(pose_frames))),
            "zsource": zsource,
            "mbstatus": mbstatus,
            "mbarchok": mbarchok,
            "mbusedratio": float(mb_used_ratio),
            "mbfallbackratio": float(mb_fallback_ratio),
            "load_report": self.load_report,
            "frames": depth_frames,
            "step": "step04motionbertdepth",
        }

        video_name = pose_data.get("video") or pose_json_path.stem.replace("pose", "")
        output_path = step_dir / f"{video_name}depth.json"

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return {
            "depth_json_path": str(output_path),
            "zsource": zsource,
            "mbstatus": mbstatus,
            "mbarchok": mbarchok,
            "mbusedratio": float(mb_used_ratio),
            "mbfallbackratio": float(mb_fallback_ratio),
            "load_report": self.load_report,
            "step": "step04motionbertdepth",
        }