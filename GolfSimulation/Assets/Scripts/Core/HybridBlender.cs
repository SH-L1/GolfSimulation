using GolfSimulation.Data;
using UnityEngine;

namespace GolfSimulation.Core
{
    /// <summary>
    /// FK 포즈 위에 Drive 참조 애니메이션을 "motion prior"로 블렌딩한다.
    ///
    /// [동작 조건]
    ///   - ReferenceAnimationSampler.IsReady == true 일 때만 활성화.
    ///   - Drive 모션을 항상 약하게 깔아 골프 스윙의 물리적 prior를 유지한다.
    ///   - 제공 데이터가 믿기 어려운 구간(낮은 visibility, 손목 분리, 점프, finish)에서는
    ///     해당 부위만 Drive 비중을 높인다.
    ///
    /// [파이프라인 위치]
    ///   BoneMapper: FK → ArmProtection → MotionPriorBlend → GripCoupling → IK → Finish → Smooth
    /// </summary>
    public class HybridBlender : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private ReferenceAnimationSampler sampler;

        [Header("Activation")]
        [Tooltip("개별 스윙 데이터 재현을 최우선으로 하므로 Drive prior는 기본 OFF. 실험이 필요할 때만 켭니다.")]
        [SerializeField] private bool enableMotionPrior = false;

        [Header("Base Drive Prior")]
        [Tooltip("상체는 항상 Drive 모션을 약하게 섞어 스윙 자세의 큰 형태를 유지한다.")]
        [SerializeField][Range(0f, 0.8f)] private float baseCoreBlend = 0.30f;
        [Tooltip("팔은 단안 추정 오류가 잦으므로 기본 Drive 비중을 상체보다 높게 둔다.")]
        [SerializeField][Range(0f, 0.9f)] private float baseArmBlend = 0.45f;
        [Tooltip("다리는 비교적 안정적이므로 낮은 기본 비중으로 둔다.")]
        [SerializeField][Range(0f, 0.6f)] private float baseLegBlend = 0.15f;

        [Header("Phase Gate")]
        [Tooltip("Drive 클립에 준비 동작이 없으므로 setup에서는 Drive prior를 끈다.")]
        [SerializeField] private bool disableDriveDuringSetup = true;
        [Tooltip("address 구간에서는 Drive 자세가 데이터 address와 다를 수 있어 약하게만 적용한다.")]
        [SerializeField][Range(0f, 1f)] private float addressDriveMultiplier = 0.20f;
        [Tooltip("toe_up 이후 실제 스윙 구간부터 Drive prior를 정상 적용한다.")]
        [SerializeField][Range(0f, 1f)] private float toeUpDriveMultiplier = 1.0f;

        [Header("Unreliable Data Response")]
        [Tooltip("이 visibility 미만이면 Drive 비중 증가 시작")]
        [SerializeField][Range(0.1f, 0.8f)] private float triggerVisThreshold = 0.40f;
        [Tooltip("저신뢰도 구간에서 적용되는 최대 Drive 비율")]
        [SerializeField][Range(0f, 1f)] private float maxUnreliableBlend = 0.90f;
        [SerializeField][Range(0.05f, 0.6f)] private float maxJumpPerFrame = 0.16f;
        [SerializeField][Range(0.05f, 0.5f)] private float maxWristSeparation = 0.22f;

        [Header("Finish Phase Override")]
        [SerializeField][Range(0f, 1f)] private float finishCoreBlend = 0.55f;
        [SerializeField][Range(0f, 1f)] private float finishArmBlend = 0.95f;
        [SerializeField][Range(0f, 1f)] private float finishLegBlend = 0.25f;

        [Header("Blending Targets")]
        [SerializeField] private bool blendCore = true;
        [SerializeField] private bool blendLeftArm = true;
        [SerializeField] private bool blendRightArm = true;
        [SerializeField] private bool blendLegs = true;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        private Transform hipsBone, spineBone, chestBone, upperChestBone, neckBone, headBone;
        private Transform luaBone, llaBone, ruaBone, rlaBone;
        private Transform lulBone, lllBone, rulBone, rllBone;
        private bool isInitialized;

        private Vector3 prevLeftElbow, prevLeftWrist, prevRightElbow, prevRightWrist;
        private bool hasPrevArmData;

        private float debugCoreBlend, debugLeftBlend, debugRightBlend, debugLegBlend, debugSwingNorm;
        private float debugLeftReliability = 1f, debugRightReliability = 1f;

        // BoneMapper에서 참조하는 공개 상태
        public bool IsReady => enableMotionPrior && isInitialized && sampler != null && sampler.IsReady;

        // ──────────────────────────────────────────────────────────────────────

        /// <summary>BoneMapper.Initialize에서 호출.</summary>
        public void Initialize(Animator animator)
        {
            hipsBone = animator.GetBoneTransform(HumanBodyBones.Hips);
            spineBone = animator.GetBoneTransform(HumanBodyBones.Spine);
            chestBone = animator.GetBoneTransform(HumanBodyBones.Chest);
            upperChestBone = animator.GetBoneTransform(HumanBodyBones.UpperChest);
            neckBone = animator.GetBoneTransform(HumanBodyBones.Neck);
            headBone = animator.GetBoneTransform(HumanBodyBones.Head);

            luaBone = animator.GetBoneTransform(HumanBodyBones.LeftUpperArm);
            llaBone = animator.GetBoneTransform(HumanBodyBones.LeftLowerArm);
            ruaBone = animator.GetBoneTransform(HumanBodyBones.RightUpperArm);
            rlaBone = animator.GetBoneTransform(HumanBodyBones.RightLowerArm);

            lulBone = animator.GetBoneTransform(HumanBodyBones.LeftUpperLeg);
            lllBone = animator.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
            rulBone = animator.GetBoneTransform(HumanBodyBones.RightUpperLeg);
            rllBone = animator.GetBoneTransform(HumanBodyBones.RightLowerLeg);

            isInitialized = true;
            hasPrevArmData = false;

            if (sampler != null)
                sampler.Initialize();
            else
                Debug.LogWarning("[HybridBlender] ReferenceAnimationSampler 미할당 — 참조 블렌딩 비활성화.");
        }

        /// <summary>
        /// FK + ArmProtection 이후 호출. 부위별 신뢰도에 따라 Drive 모션 방향으로 Slerp.
        /// </summary>
        public void Apply(PoseFrame frame, PoseDataLoader loader,
                          int frameIndex, SwingEvents events, int totalFrames,
                          string phase = "")
        {
            if (!IsReady || frame == null) return;

            float swingNorm = sampler.ComputeSwingNorm(frameIndex, events, totalFrames);
            debugSwingNorm = swingNorm;

            float leftReliability = ComputeArmReliability(frame, loader, true);
            float rightReliability = ComputeArmReliability(frame, loader, false);
            debugLeftReliability = leftReliability;
            debugRightReliability = rightReliability;

            bool isFinish = phase == "finish";
            bool isLateFollow = phase == "mid_follow_through";
            float phaseMultiplier = ComputePhaseMultiplier(phase);

            float coreBlend = (isFinish ? finishCoreBlend : baseCoreBlend) * phaseMultiplier;
            float leftBlend = ComputeBlend(baseArmBlend, leftReliability) * phaseMultiplier;
            float rightBlend = ComputeBlend(baseArmBlend, rightReliability) * phaseMultiplier;
            float legBlend = (isFinish ? finishLegBlend : baseLegBlend) * phaseMultiplier;

            if (isLateFollow)
            {
                leftBlend = Mathf.Max(leftBlend, 0.70f * phaseMultiplier);
                rightBlend = Mathf.Max(rightBlend, 0.60f * phaseMultiplier);
            }

            if (isFinish)
            {
                leftBlend = Mathf.Max(leftBlend, finishArmBlend);
                rightBlend = Mathf.Max(rightBlend, finishArmBlend);
            }

            debugCoreBlend = coreBlend;
            debugLeftBlend = leftBlend;
            debugRightBlend = rightBlend;
            debugLegBlend = legBlend;

            if (blendCore)
            {
                BlendBone(hipsBone, ReferenceAnimationSampler.ReferenceBone.Hips, swingNorm, coreBlend * 0.65f);
                BlendBone(spineBone, ReferenceAnimationSampler.ReferenceBone.Spine, swingNorm, coreBlend);
                BlendBone(chestBone, ReferenceAnimationSampler.ReferenceBone.Chest, swingNorm, coreBlend);
                BlendBone(upperChestBone, ReferenceAnimationSampler.ReferenceBone.UpperChest, swingNorm, coreBlend);
                BlendBone(neckBone, ReferenceAnimationSampler.ReferenceBone.Neck, swingNorm, coreBlend * 0.5f);
                BlendBone(headBone, ReferenceAnimationSampler.ReferenceBone.Head, swingNorm, coreBlend * 0.35f);
            }

            if (blendLeftArm)
            {
                BlendBone(luaBone, ReferenceAnimationSampler.ReferenceBone.LeftUpperArm, swingNorm, leftBlend);
                BlendBone(llaBone, ReferenceAnimationSampler.ReferenceBone.LeftLowerArm, swingNorm, leftBlend);
            }

            if (blendRightArm)
            {
                BlendBone(ruaBone, ReferenceAnimationSampler.ReferenceBone.RightUpperArm, swingNorm, rightBlend);
                BlendBone(rlaBone, ReferenceAnimationSampler.ReferenceBone.RightLowerArm, swingNorm, rightBlend);
            }

            if (blendLegs)
            {
                BlendBone(lulBone, ReferenceAnimationSampler.ReferenceBone.LeftUpperLeg, swingNorm, legBlend);
                BlendBone(lllBone, ReferenceAnimationSampler.ReferenceBone.LeftLowerLeg, swingNorm, legBlend);
                BlendBone(rulBone, ReferenceAnimationSampler.ReferenceBone.RightUpperLeg, swingNorm, legBlend);
                BlendBone(rllBone, ReferenceAnimationSampler.ReferenceBone.RightLowerLeg, swingNorm, legBlend);
            }

            CacheArmData(frame, loader);
        }

        // ──────────────────────────────────────────────────────────────────────

        private void BlendBone(Transform target, ReferenceAnimationSampler.ReferenceBone referenceBone,
                               float swingNorm, float weight)
        {
            if (target == null || weight <= 0.001f) return;
            if (!sampler.TryGetRotation(referenceBone, swingNorm, out Quaternion refRot)) return;
            target.rotation = Quaternion.Slerp(target.rotation, refRot, Mathf.Clamp01(weight));
        }

        private float ComputeBlend(float baseWeight, float reliability)
        {
            float unreliable = 1f - Mathf.Clamp01(reliability);
            return Mathf.Lerp(baseWeight, maxUnreliableBlend, unreliable);
        }

        private float ComputePhaseMultiplier(string phase)
        {
            switch (phase)
            {
                case "setup":
                    return disableDriveDuringSetup ? 0f : addressDriveMultiplier;
                case "address":
                    return addressDriveMultiplier;
                case "toe_up":
                    return toeUpDriveMultiplier;
                case "mid_backswing":
                case "top":
                case "mid_downswing":
                case "impact":
                case "mid_follow_through":
                case "finish":
                    return 1f;
                default:
                    return 0f;
            }
        }

        private float ComputeArmReliability(PoseFrame frame, PoseDataLoader loader, bool left)
        {
            string elbowKey = left ? "left_elbow" : "right_elbow";
            string wristKey = left ? "left_wrist" : "right_wrist";
            string shoulderKey = left ? "left_shoulder" : "right_shoulder";

            float elbowVis = loader.GetLandmarkVisibility(frame, elbowKey);
            float wristVis = loader.GetLandmarkVisibility(frame, wristKey);
            float vis = Mathf.Min(elbowVis, wristVis);
            float visRel = Mathf.InverseLerp(0.05f, triggerVisThreshold, vis);

            Vector3 shoulder = loader.GetLandmarkPosition(frame, shoulderKey);
            Vector3 elbow = loader.GetLandmarkPosition(frame, elbowKey);
            Vector3 wrist = loader.GetLandmarkPosition(frame, wristKey);

            float jumpRel = 1f;
            if (hasPrevArmData)
            {
                Vector3 prevElbow = left ? prevLeftElbow : prevRightElbow;
                Vector3 prevWrist = left ? prevLeftWrist : prevRightWrist;
                float jump = Mathf.Max(Vector3.Distance(elbow, prevElbow), Vector3.Distance(wrist, prevWrist));
                jumpRel = 1f - Mathf.InverseLerp(maxJumpPerFrame, maxJumpPerFrame * 2f, jump);
            }

            float wristSep = Vector3.Distance(
                loader.GetLandmarkPosition(frame, "left_wrist"),
                loader.GetLandmarkPosition(frame, "right_wrist"));
            float gripRel = 1f - Mathf.InverseLerp(maxWristSeparation, maxWristSeparation * 2f, wristSep);

            float elbowAngle = Vector3.Angle(shoulder - elbow, wrist - elbow);
            float elbowRel = 1f;
            if (elbowAngle < 18f)
                elbowRel = Mathf.InverseLerp(5f, 18f, elbowAngle);
            else if (elbowAngle > 176f)
                elbowRel = 1f - Mathf.InverseLerp(176f, 179.5f, elbowAngle);

            float rel = Mathf.Min(visRel, jumpRel, gripRel, elbowRel);
            return Mathf.Clamp01(rel);
        }

        private void CacheArmData(PoseFrame frame, PoseDataLoader loader)
        {
            prevLeftElbow = loader.GetLandmarkPosition(frame, "left_elbow");
            prevLeftWrist = loader.GetLandmarkPosition(frame, "left_wrist");
            prevRightElbow = loader.GetLandmarkPosition(frame, "right_elbow");
            prevRightWrist = loader.GetLandmarkPosition(frame, "right_wrist");
            hasPrevArmData = true;
        }

        private void OnGUI()
        {
            if (!showDebugInfo || !isInitialized) return;
            GUILayout.BeginArea(new Rect(440, 130, 340, 70));
            if (!IsReady)
            {
                GUILayout.Label("[HybridBlender] 참조 AnimationClip 미설정 (비활성)");
            }
            else
            {
                GUILayout.Label($"[HybridBlender] swing={debugSwingNorm:F2}");
                GUILayout.Label($"  core={debugCoreBlend:F2} legs={debugLegBlend:F2}");
                GUILayout.Label($"  L={debugLeftBlend:F2} (rel {debugLeftReliability:F2})  R={debugRightBlend:F2} (rel {debugRightReliability:F2})");
                GUILayout.Label($"  trigger<{triggerVisThreshold:F2}  max={maxUnreliableBlend:F2}");
            }
            GUILayout.EndArea();
        }
    }
}
