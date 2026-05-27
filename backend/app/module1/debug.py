import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import torch


BASE_DIR = Path(__file__).resolve().parent          # .../backend/app/module1
PROJECT_ROOT = BASE_DIR.parent.parent              # .../backend
APP_MODULE1_DIR = BASE_DIR
MODELS_DIR = PROJECT_ROOT / "models"
EXTERNAL_DIR = PROJECT_ROOT / "external"

SWINGNET_CHECKPOINT = MODELS_DIR / "swingnet_1800.pth"
SWINGNET_REPO = EXTERNAL_DIR / "golfdb"
SWINGNET_MODEL_PY = SWINGNET_REPO / "model.py"
SWINGNET_MOBILENET = SWINGNET_REPO / "mobilenet_v2.pth.tar"

MOTIONBERT_CHECKPOINT = MODELS_DIR / "MotionBERT-Base.bin"
MOTIONBERT_REPO = EXTERNAL_DIR / "MotionBERT"
MOTIONBERT_DSTFORMER = MOTIONBERT_REPO / "lib" / "model" / "DSTformer.py"


def safe_children(path: Path, limit: int = 30):
    if path.exists() and path.is_dir():
        try:
            return sorted([p.name for p in path.iterdir()])[:limit]
        except Exception:
            return []
    return []


def clone_repo(repo_dir: Path, repo_url: str, check_file: Path):
    if check_file.exists():
        return {"ok": True, "action": "reuse", "check_file": str(check_file)}

    repo_dir.parent.mkdir(parents=True, exist_ok=True)
    if repo_dir.exists():
        shutil.rmtree(repo_dir, ignore_errors=True)

    cmd = ["git", "clone", "--depth", "1", repo_url, str(repo_dir)]
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return {
            "ok": check_file.exists(),
            "action": "clone",
            "stdout": (result.stdout or "").strip(),
            "stderr": (result.stderr or "").strip(),
            "check_file": str(check_file),
        }
    except subprocess.CalledProcessError as e:
        return {
            "ok": False,
            "action": "clone_failed",
            "stdout": (e.stdout or "").strip(),
            "stderr": (e.stderr or "").strip(),
            "check_file": str(check_file),
        }


def find_local_mobilenet_candidates(root: Path):
    patterns = [
        "mobilenet_v2.pth.tar",
        "mobilenetv2.pth.tar",
        "mobilenet_v2*.pth*",
    ]
    found = []
    for pattern in patterns:
        try:
            for p in root.rglob(pattern):
                if p.is_file():
                    found.append(p)
        except Exception:
            pass

    uniq = []
    seen = set()
    for p in found:
        s = str(p.resolve())
        if s not in seen:
            seen.add(s)
            uniq.append(p)
    return uniq[:20]


def try_fix_swingnet_mobilenet():
    if SWINGNET_MOBILENET.exists():
        return {
            "fixed": True,
            "action": "already_present",
            "target": str(SWINGNET_MOBILENET),
        }

    candidates = find_local_mobilenet_candidates(PROJECT_ROOT)
    if not candidates:
        return {
            "fixed": False,
            "action": "not_found",
            "target": str(SWINGNET_MOBILENET),
            "candidates": [],
        }

    source = candidates[0]
    try:
        shutil.copy2(source, SWINGNET_MOBILENET)
        return {
            "fixed": True,
            "action": "copied",
            "source": str(source),
            "target": str(SWINGNET_MOBILENET),
            "candidates": [str(p) for p in candidates],
        }
    except Exception as e:
        return {
            "fixed": False,
            "action": f"copy_failed:{type(e).__name__}",
            "error": str(e),
            "source": str(source),
            "target": str(SWINGNET_MOBILENET),
            "candidates": [str(p) for p in candidates],
        }


def swingnet_event_detector_cwd_check(EventDetector):
    result = {
        "cwd_before": os.getcwd(),
        "repo_dir": str(SWINGNET_REPO),
        "without_chdir": None,
        "with_chdir": None,
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    try:
        model = EventDetector(
            pretrain=False,
            width_mult=1.0,
            lstm_layers=1,
            lstm_hidden=256,
            bidirectional=True,
            dropout=False,
        ).to(device)
        result["without_chdir"] = {
            "ok": True,
            "cwd": os.getcwd(),
            "model_type": type(model).__name__,
        }
    except Exception as e:
        result["without_chdir"] = {
            "ok": False,
            "cwd": os.getcwd(),
            "error_type": type(e).__name__,
            "error": str(e),
        }

    old_cwd = os.getcwd()
    try:
        os.chdir(str(SWINGNET_REPO))
        model = EventDetector(
            pretrain=False,
            width_mult=1.0,
            lstm_layers=1,
            lstm_hidden=256,
            bidirectional=True,
            dropout=False,
        ).to(device)
        result["with_chdir"] = {
            "ok": True,
            "cwd": os.getcwd(),
            "model_type": type(model).__name__,
        }
    except Exception as e:
        result["with_chdir"] = {
            "ok": False,
            "cwd": os.getcwd(),
            "error_type": type(e).__name__,
            "error": str(e),
        }
    finally:
        os.chdir(old_cwd)

    result["cwd_restored"] = os.getcwd()
    return result


def debug_swingnet():
    info = {
        "checkpoint_path": str(SWINGNET_CHECKPOINT),
        "checkpoint_exists": SWINGNET_CHECKPOINT.exists(),
        "repo_dir": str(SWINGNET_REPO),
        "repo_exists_before": SWINGNET_REPO.exists(),
        "model_py": str(SWINGNET_MODEL_PY),
        "model_py_exists_before": SWINGNET_MODEL_PY.exists(),
        "mobilenet_weight": str(SWINGNET_MOBILENET),
        "mobilenet_weight_exists_before": SWINGNET_MOBILENET.exists(),
        "repo_children_before": safe_children(SWINGNET_REPO),
    }

    info["ensure_repo"] = clone_repo(
        SWINGNET_REPO,
        "https://github.com/wmcnally/golfdb.git",
        SWINGNET_MODEL_PY,
    )
    info["model_py_exists_after"] = SWINGNET_MODEL_PY.exists()
    info["repo_children_after"] = safe_children(SWINGNET_REPO)

    repo_path = str(SWINGNET_REPO)
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    EventDetector = None
    import_check = {"import_ok": False, "import_mode": None, "error": None}
    try:
        from model import EventDetector as ImportedEventDetector
        EventDetector = ImportedEventDetector
        import_check["import_ok"] = True
        import_check["import_mode"] = "from model import EventDetector"
    except Exception as e:
        import_check["error"] = f"{type(e).__name__}: {e}"

    info["import_check"] = import_check

    if not SWINGNET_CHECKPOINT.exists():
        info["load_check"] = {"loadable": False, "reason": "checkpoint_not_found"}
        return info

    if EventDetector is None:
        info["load_check"] = {
            "loadable": False,
            "reason": "event_detector_import_failed",
            "error": import_check["error"],
        }
        return info

    mobilenet_fix = try_fix_swingnet_mobilenet()
    info["mobilenet_fix"] = mobilenet_fix
    info["cwd_check"] = swingnet_event_detector_cwd_check(EventDetector)

    if not info["cwd_check"]["with_chdir"]["ok"]:
        info["load_check"] = {
            "loadable": False,
            "reason": "event_detector_init_failed",
            "cwd_check": info["cwd_check"],
        }
        return info

    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        old_cwd = os.getcwd()
        try:
            os.chdir(str(SWINGNET_REPO))
            model = EventDetector(
                pretrain=False,
                width_mult=1.0,
                lstm_layers=1,
                lstm_hidden=256,
                bidirectional=True,
                dropout=False,
            ).to(device)
        finally:
            os.chdir(old_cwd)

        checkpoint_obj = torch.load(SWINGNET_CHECKPOINT, map_location=device)
        state = (
            checkpoint_obj.get("model_state_dict")
            or checkpoint_obj.get("state_dict")
            or checkpoint_obj
        )
        state = {
            k[7:] if isinstance(k, str) and k.startswith("module.") else k: v
            for k, v in state.items()
        }
        missing, unexpected = model.load_state_dict(state, strict=False)
        model.eval()

        info["load_check"] = {
            "loadable": True,
            "reason": "ok",
            "device": str(device),
            "state_key_count": len(state),
            "missing_after_load": list(missing)[:30],
            "unexpected_after_load": list(unexpected)[:30],
        }
    except Exception as e:
        info["load_check"] = {
            "loadable": False,
            "reason": f"exception:{type(e).__name__}",
            "error": str(e),
        }

    return info


def motionbert_match_report(model, state: dict):
    model_state = model.state_dict()
    total = len(model_state)
    matched = 0
    critical_keys = []
    for key in model_state.keys():
        lowered = key.lower()
        if any(x in lowered for x in ["joints_embed", "pos_embed", "blocks.0", "blocks.1", "head"]):
            critical_keys.append(key)
    critical_total = len(critical_keys)
    critical_matched = 0
    for key, value in state.items():
        if key in model_state and tuple(model_state[key].shape) == tuple(value.shape):
            matched += 1
            if key in critical_keys:
                critical_matched += 1
    return {
        "shape_match_ratio": round(matched / max(total, 1), 4),
        "critical_match_ratio": round(critical_matched / max(critical_total, 1), 4),
        "matched_keys": matched,
        "total_keys": total,
        "critical_matched": critical_matched,
        "critical_total": critical_total,
    }


def debug_motionbert():
    info = {
        "checkpoint_path": str(MOTIONBERT_CHECKPOINT),
        "checkpoint_exists": MOTIONBERT_CHECKPOINT.exists(),
        "repo_dir": str(MOTIONBERT_REPO),
        "repo_exists_before": MOTIONBERT_REPO.exists(),
        "dstformer_py": str(MOTIONBERT_DSTFORMER),
        "dstformer_py_exists_before": MOTIONBERT_DSTFORMER.exists(),
        "repo_children_before": safe_children(MOTIONBERT_REPO),
    }

    info["ensure_repo"] = clone_repo(
        MOTIONBERT_REPO,
        "https://github.com/Walter0807/MotionBERT.git",
        MOTIONBERT_DSTFORMER,
    )
    info["dstformer_py_exists_after"] = MOTIONBERT_DSTFORMER.exists()
    info["repo_children_after"] = safe_children(MOTIONBERT_REPO)

    repo_path = str(MOTIONBERT_REPO)
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    DSTformer = None
    import_check = {"import_ok": False, "import_mode": None, "error": None}
    try:
        from lib.model.DSTformer import DSTformer as ImportedDSTformer
        DSTformer = ImportedDSTformer
        import_check["import_ok"] = True
        import_check["import_mode"] = "from lib.model.DSTformer import DSTformer"
    except Exception as e:
        import_check["error"] = f"{type(e).__name__}: {e}"
    info["import_check"] = import_check

    if not MOTIONBERT_CHECKPOINT.exists():
        info["load_check"] = {"loadable": False, "reason": "checkpoint_not_found"}
        return info
    if DSTformer is None:
        info["load_check"] = {
            "loadable": False,
            "reason": "dstformer_import_failed",
            "error": import_check["error"],
        }
        return info

    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
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
        ).to(device)
        checkpoint_obj = torch.load(MOTIONBERT_CHECKPOINT, map_location=device)
        state = (
            checkpoint_obj.get("model_pos")
            or checkpoint_obj.get("model")
            or checkpoint_obj.get("model_state_dict")
            or checkpoint_obj.get("state_dict")
            or checkpoint_obj
        )
        state = {
            k[7:] if isinstance(k, str) and k.startswith("module.") else k: v
            for k, v in state.items()
        }
        report = motionbert_match_report(model, state)
        compatible_state = {}
        model_state = model.state_dict()
        for key, value in state.items():
            if key in model_state and tuple(model_state[key].shape) == tuple(value.shape):
                compatible_state[key] = value
        missing, unexpected = model.load_state_dict(compatible_state, strict=False)
        model.eval()
        info["load_check"] = {
            "loadable": True,
            "reason": "ok",
            "device": str(device),
            "compatible_state_key_count": len(compatible_state),
            "missing_after_load": list(missing)[:30],
            "unexpected_after_load": list(unexpected)[:30],
            **report,
        }
    except Exception as e:
        info["load_check"] = {
            "loadable": False,
            "reason": f"exception:{type(e).__name__}",
            "error": str(e),
        }
    return info


def main():
    result = {
        "project_root": str(PROJECT_ROOT),
        "python": sys.executable,
        "cuda_available": torch.cuda.is_available(),
        "swingnet": debug_swingnet(),
        "motionbert": debug_motionbert(),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()