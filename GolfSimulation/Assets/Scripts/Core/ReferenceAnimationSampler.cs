using GolfSimulation.Data;
using UnityEngine;

namespace GolfSimulation.Core
{
    /// <summary>
    /// Mixamo AnimationClip을 미리 샘플링하여 스윙 진행도(0~1) 기반으로
    /// 팔 본 회전을 제공한다.
    ///
    /// [Mixamo 다운로드 설정]
    ///   Format           : FBX for Unity
    ///   Skin             : Without Skin
    ///   Frames per Second: 30
    ///   Keyframe Reduction: None
    ///
    /// [Unity Import 설정]
    ///   Rig → Animation Type : Generic  ← 필수 (SampleAnimation 호환)
    ///   Avatar Definition    : Create From This Model
    ///
    /// [씬 설정]
    ///   1. Assets/Animations/ 에 FBX 배치
    ///   2. 씬에 빈 GameObject 생성 → Animator 컴포넌트 추가
    ///      (메인 Y-Bot과 별도 — scale 0 또는 "Sampling" 레이어 분리로 렌더링 숨김)
    ///   3. samplingAnimator 필드에 해당 Animator 할당
    ///   4. referenceClip 필드에 AnimationClip 할당
    ///   5. Clip Event Mapping 값 Inspector에서 조정
    /// </summary>
    public class ReferenceAnimationSampler : MonoBehaviour
    {
        [Header("Animation")]
        [SerializeField] private AnimationClip referenceClip;
        [Tooltip("샘플링 전용 Animator (Generic 리그, 메인 아바타와 별도 오브젝트)")]
        [SerializeField] private Animator samplingAnimator;
        [SerializeField][Range(30, 240)] private int sampleCount = 120;

        [Header("Clip Event Mapping  (0 = 클립 시작, 1 = 클립 끝)")]
        [Tooltip("Mixamo 클립에서 address 자세에 해당하는 정규화 시간")]
        [SerializeField][Range(0f, 1f)] private float clipAddress      = 0.05f;
        [SerializeField][Range(0f, 1f)] private float clipToeUp        = 0.18f;
        [SerializeField][Range(0f, 1f)] private float clipMidBackswing = 0.30f;
        [SerializeField][Range(0f, 1f)] private float clipTop          = 0.45f;
        [SerializeField][Range(0f, 1f)] private float clipMidDownswing = 0.60f;
        [SerializeField][Range(0f, 1f)] private float clipImpact       = 0.68f;
        [SerializeField][Range(0f, 1f)] private float clipMidFollow    = 0.80f;
        [SerializeField][Range(0f, 1f)] private float clipFinish       = 0.95f;

        public enum ReferenceBone
        {
            Hips,
            Spine,
            Chest,
            UpperChest,
            Neck,
            Head,
            LeftUpperArm,
            LeftLowerArm,
            RightUpperArm,
            RightLowerArm,
            LeftUpperLeg,
            LeftLowerLeg,
            RightUpperLeg,
            RightLowerLeg,
        }

        private static readonly ReferenceBone[] ReferenceBones =
        {
            ReferenceBone.Hips,
            ReferenceBone.Spine,
            ReferenceBone.Chest,
            ReferenceBone.UpperChest,
            ReferenceBone.Neck,
            ReferenceBone.Head,
            ReferenceBone.LeftUpperArm,
            ReferenceBone.LeftLowerArm,
            ReferenceBone.RightUpperArm,
            ReferenceBone.RightLowerArm,
            ReferenceBone.LeftUpperLeg,
            ReferenceBone.LeftLowerLeg,
            ReferenceBone.RightUpperLeg,
            ReferenceBone.RightLowerLeg,
        };

        // 사전 샘플링 데이터: [boneIndex, sampleIndex]
        private Quaternion[,] sampledRotations;
        private bool[] sampledBoneValid;

        // 8이벤트 → 클립 정규화 시간 테이블
        private float[] clipEventNorms;

        // Generic/Humanoid 리그용 본 Transform 캐시
        private Transform[] sampleBones;

        public bool IsReady { get; private set; }

        // ──────────────────────────────────────────────────────────────────────

        /// <summary>BoneMapper.Initialize → HybridBlender.Initialize에서 호출.</summary>
        public void Initialize()
        {
            if (referenceClip == null)
            {
                Debug.LogWarning("[RefSampler] AnimationClip 미할당 — Hybrid Blending 비활성화.");
                return;
            }
            if (samplingAnimator == null)
            {
                Debug.LogError("[RefSampler] samplingAnimator 미할당 — Inspector에서 별도 Animator를 지정하세요.");
                return;
            }

            clipEventNorms = new float[]
            {
                clipAddress, clipToeUp, clipMidBackswing, clipTop,
                clipMidDownswing, clipImpact, clipMidFollow, clipFinish
            };

            CacheReferenceBones();
            PreSampleClip();

            if (ValidateSamples())
            {
                IsReady = true;
                Debug.Log($"[RefSampler] 완료 — clip: {referenceClip.name} ({referenceClip.length:F2}s), samples: {sampleCount}");
            }
            else
            {
                Debug.LogWarning("[RefSampler] 샘플링 검증 실패.\n"
                    + "  → Import 설정: Rig → Animation Type = Generic 인지 확인하세요.\n"
                    + "  → FBX를 Without Skin으로 다운받았는지 확인하세요.");
            }
        }

        // ──────────────────────────────────────────────────────────────────────

        /// <summary>
        /// 주요 본 Transform 캐시.
        /// Humanoid Avatar가 있으면 GetBoneTransform 사용,
        /// Generic 리그(Avatar 없음)면 Mixamo 본 이름으로 탐색.
        /// </summary>
        private void CacheReferenceBones()
        {
            sampleBones = new Transform[ReferenceBones.Length];

            if (samplingAnimator.avatar != null && samplingAnimator.avatar.isHuman)
            {
                for (int i = 0; i < ReferenceBones.Length; i++)
                    sampleBones[i] = samplingAnimator.GetBoneTransform(ToHumanBodyBone(ReferenceBones[i]));
                Debug.Log("[RefSampler] Humanoid 리그로 주요 본 캐시 완료.");
                return;
            }

            Transform root = samplingAnimator.transform;
            for (int i = 0; i < ReferenceBones.Length; i++)
                sampleBones[i] = FindBoneByPartialName(root, ToMixamoName(ReferenceBones[i]));

            int valid = 0;
            for (int i = 0; i < sampleBones.Length; i++)
                if (sampleBones[i] != null) valid++;

            Debug.Log($"[RefSampler] Generic 리그 주요 본 캐시 완료 — {valid}/{ReferenceBones.Length}");
        }

        private static HumanBodyBones ToHumanBodyBone(ReferenceBone bone)
        {
            switch (bone)
            {
                case ReferenceBone.Hips: return HumanBodyBones.Hips;
                case ReferenceBone.Spine: return HumanBodyBones.Spine;
                case ReferenceBone.Chest: return HumanBodyBones.Chest;
                case ReferenceBone.UpperChest: return HumanBodyBones.UpperChest;
                case ReferenceBone.Neck: return HumanBodyBones.Neck;
                case ReferenceBone.Head: return HumanBodyBones.Head;
                case ReferenceBone.LeftUpperArm: return HumanBodyBones.LeftUpperArm;
                case ReferenceBone.LeftLowerArm: return HumanBodyBones.LeftLowerArm;
                case ReferenceBone.RightUpperArm: return HumanBodyBones.RightUpperArm;
                case ReferenceBone.RightLowerArm: return HumanBodyBones.RightLowerArm;
                case ReferenceBone.LeftUpperLeg: return HumanBodyBones.LeftUpperLeg;
                case ReferenceBone.LeftLowerLeg: return HumanBodyBones.LeftLowerLeg;
                case ReferenceBone.RightUpperLeg: return HumanBodyBones.RightUpperLeg;
                case ReferenceBone.RightLowerLeg: return HumanBodyBones.RightLowerLeg;
                default: return HumanBodyBones.LastBone;
            }
        }

        private static string ToMixamoName(ReferenceBone bone)
        {
            switch (bone)
            {
                case ReferenceBone.Hips: return "Hips";
                case ReferenceBone.Spine: return "Spine";
                case ReferenceBone.Chest: return "Spine1";
                case ReferenceBone.UpperChest: return "Spine2";
                case ReferenceBone.Neck: return "Neck";
                case ReferenceBone.Head: return "Head";
                case ReferenceBone.LeftUpperArm: return "LeftArm";
                case ReferenceBone.LeftLowerArm: return "LeftForeArm";
                case ReferenceBone.RightUpperArm: return "RightArm";
                case ReferenceBone.RightLowerArm: return "RightForeArm";
                case ReferenceBone.LeftUpperLeg: return "LeftUpLeg";
                case ReferenceBone.LeftLowerLeg: return "LeftLeg";
                case ReferenceBone.RightUpperLeg: return "RightUpLeg";
                case ReferenceBone.RightLowerLeg: return "RightLeg";
                default: return "";
            }
        }

        /// <summary>계층 전체를 순회하여 boneName을 포함하는 첫 번째 Transform 반환.</summary>
        private static Transform FindBoneByPartialName(Transform root, string partialName)
        {
            if (root.name.Contains(partialName))
                return root;
            foreach (Transform child in root)
            {
                var found = FindBoneByPartialName(child, partialName);
                if (found != null) return found;
            }
            return null;
        }

        // ──────────────────────────────────────────────────────────────────────

        private void PreSampleClip()
        {
            sampledRotations = new Quaternion[ReferenceBones.Length, sampleCount];
            sampledBoneValid = new bool[ReferenceBones.Length];

            float clipLen      = referenceClip.length;
            bool  wasEnabled   = samplingAnimator.enabled;
            samplingAnimator.enabled = true;

            for (int i = 0; i < sampleCount; i++)
            {
                float t = (float)i / Mathf.Max(1, sampleCount - 1);
                referenceClip.SampleAnimation(samplingAnimator.gameObject, t * clipLen);

                for (int b = 0; b < ReferenceBones.Length; b++)
                {
                    sampledRotations[b, i] = sampleBones[b] != null ? sampleBones[b].rotation : Quaternion.identity;
                    sampledBoneValid[b] |= sampleBones[b] != null && sampledRotations[b, i] != Quaternion.identity;
                }
            }

            samplingAnimator.enabled = wasEnabled;
        }

        /// <summary>샘플의 90% 이상이 identity가 아닌지 확인 (SampleAnimation 정상 동작 여부)</summary>
        private bool ValidateSamples()
        {
            if (sampledRotations == null || sampledBoneValid == null) return false;
            int validBones = 0;
            for (int b = 0; b < sampledBoneValid.Length; b++)
                if (sampledBoneValid[b]) validBones++;
            if (validBones < 6) return false;

            int identityCount = 0;
            for (int i = 0; i < sampleCount; i++)
                if (sampledRotations[(int)ReferenceBone.LeftUpperArm, i] == Quaternion.identity) identityCount++;
            return identityCount < sampleCount * 0.9f;
        }

        // ──────────────────────────────────────────────────────────────────────

        /// <summary>
        /// frameIndex → 이벤트 공간 진행도 [0=address, 1=finish].
        ///
        /// 단순히 address~finish 전체 길이를 0~1로 정규화하면 데이터 이벤트 간격과
        /// Mixamo 클립 이벤트 간격이 달라져 타이밍이 밀린다. 따라서 실제 데이터의
        /// SwingNet 8이벤트 구간별로 보간한 뒤, SwingToClipNorm에서 클립 이벤트
        /// 시간으로 다시 매핑한다.
        /// </summary>
        public float ComputeSwingNorm(int frameIndex, SwingEvents events, int totalFrames)
        {
            if (events == null) return 0f;

            string[] names =
            {
                "address", "toe_up", "mid_backswing", "top",
                "mid_downswing", "impact", "mid_follow_through", "finish"
            };

            int[] frames = new int[names.Length];
            for (int i = 0; i < names.Length; i++)
                frames[i] = events.GetFrameIndex(names[i]);

            if (frames[0] < 0 || frames[frames.Length - 1] <= frames[0])
                return 0f;

            if (frameIndex <= frames[0]) return 0f;
            if (frameIndex >= frames[frames.Length - 1]) return 1f;

            for (int i = 0; i < frames.Length - 1; i++)
            {
                int a = frames[i];
                int b = frames[i + 1];
                if (a < 0 || b <= a) continue;

                if (frameIndex >= a && frameIndex <= b)
                {
                    float segmentT = Mathf.InverseLerp(a, b, frameIndex);
                    return (i + segmentT) / (frames.Length - 1);
                }
            }

            return Mathf.Clamp01((float)(frameIndex - frames[0]) / (frames[frames.Length - 1] - frames[0]));
        }

        /// <summary>스윙 진행도 → 클립 정규화 시간 (이벤트 구간 선형 보간)</summary>
        private float SwingToClipNorm(float swingNorm)
        {
            swingNorm = Mathf.Clamp01(swingNorm);
            float segCount = clipEventNorms.Length - 1;
            float idx      = swingNorm * segCount;
            int   a        = Mathf.FloorToInt(idx);
            int   b        = Mathf.Min(a + 1, clipEventNorms.Length - 1);
            return Mathf.Lerp(clipEventNorms[a], clipEventNorms[b], idx - a);
        }

        /// <summary>스윙 진행도에 해당하는 참조 팔 본 회전 반환 (Slerp 보간)</summary>
        public void GetArmRotations(float swingNorm,
            out Quaternion lua, out Quaternion lla,
            out Quaternion rua, out Quaternion rla)
        {
            TryGetRotation(ReferenceBone.LeftUpperArm, swingNorm, out lua);
            TryGetRotation(ReferenceBone.LeftLowerArm, swingNorm, out lla);
            TryGetRotation(ReferenceBone.RightUpperArm, swingNorm, out rua);
            TryGetRotation(ReferenceBone.RightLowerArm, swingNorm, out rla);
        }

        /// <summary>스윙 진행도에 해당하는 주요 본 회전 반환.</summary>
        public bool TryGetRotation(ReferenceBone bone, float swingNorm, out Quaternion rotation)
        {
            rotation = Quaternion.identity;
            int boneIndex = (int)bone;

            if (!IsReady || sampledRotations == null
                || boneIndex < 0 || boneIndex >= ReferenceBones.Length
                || sampledBoneValid == null || !sampledBoneValid[boneIndex])
                return false;

            float clipNorm = SwingToClipNorm(swingNorm);
            float rawIdx   = clipNorm * (sampleCount - 1);
            int   a        = Mathf.FloorToInt(rawIdx);
            int   b        = Mathf.Min(a + 1, sampleCount - 1);
            float t        = rawIdx - a;

            rotation = Quaternion.Slerp(sampledRotations[boneIndex, a], sampledRotations[boneIndex, b], t);
            return true;
        }
    }
}
