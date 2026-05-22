import json
import sys
from pathlib import Path

import torch


def extract_state_dict(checkpoint):
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


def build_model(repo_dir: Path, device: torch.device):
    if str(repo_dir) not in sys.path:
        sys.path.insert(0, str(repo_dir))

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
    ).to(device)
    return model


def checkpoint_match_report(model, state: dict):
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


def main():
    checkpoint_path = Path(r"D:\jongP\GolfSimulation\backend\models\MotionBERT-Base.bin")
    repo_dir = Path(r"D:\jongP\GolfSimulation\backend\external\MotionBERT")
    dstformer_path = repo_dir / "lib" / "model" / "DSTformer.py"
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    result = {
        "checkpoint_path": str(checkpoint_path.resolve()),
        "repo_dir": str(repo_dir.resolve()),
        "dstformer_path": str(dstformer_path.resolve()),
        "device": str(device),
        "checkpoint_exists": checkpoint_path.exists(),
        "repo_exists": repo_dir.exists(),
        "dstformer_exists": dstformer_path.exists(),
        "import_ok": False,
        "model_build_ok": False,
        "checkpoint_load_ok": False,
        "state_source": None,
        "state_key_count": 0,
        "loaded": False,
        "reason": None,
    }

    if not checkpoint_path.exists():
        result["reason"] = "checkpoint_not_found"
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    if not dstformer_path.exists():
        result["reason"] = "dstformer_not_found"
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    try:
        model = build_model(repo_dir, device)
        result["import_ok"] = True
        result["model_build_ok"] = True
    except Exception as e:
        result["reason"] = f"import_or_build_exception:{type(e).__name__}"
        result["message"] = str(e)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    try:
        checkpoint = torch.load(checkpoint_path, map_location=device)
        result["checkpoint_load_ok"] = True
    except Exception as e:
        result["reason"] = f"checkpoint_load_exception:{type(e).__name__}"
        result["message"] = str(e)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    try:
        state, state_source = extract_state_dict(checkpoint)
        result["state_source"] = state_source

        if not isinstance(state, dict):
            result["reason"] = f"invalid_state_type:{type(state).__name__}"
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return

        state = {
            key[7:] if key.startswith("module.") else key: value
            for key, value in state.items()
        }
        result["state_key_count"] = len(state)

        report = checkpoint_match_report(model, state)
        result.update(report)

        compatible_state = {}
        model_state = model.state_dict()
        for key, value in state.items():
            if key in model_state and tuple(model_state[key].shape) == tuple(value.shape):
                compatible_state[key] = value

        result["compatible_key_count"] = len(compatible_state)

        if result["shape_match_ratio"] < 0.30 or result["critical_match_ratio"] < 0.20:
            result["loaded"] = False
            result["reason"] = "arch_mismatch"
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return

        missing, unexpected = model.load_state_dict(compatible_state, strict=False)
        model.eval()

        result["loaded"] = True
        result["reason"] = "ok"
        result["missing_after_load"] = list(missing)[:20]
        result["unexpected_after_load"] = list(unexpected)[:20]
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    except Exception as e:
        result["reason"] = f"final_exception:{type(e).__name__}"
        result["message"] = str(e)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return


if __name__ == "__main__":
    main()