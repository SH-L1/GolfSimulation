using System.Collections.Generic;
using GolfSimulation.Data;
using GolfSimulation.IK;
using UnityEngine;

namespace GolfSimulation.Core
{
    public class BoneMapper : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Animator animator;

        [Header("Scale")]
        [SerializeField] private float positionScale = 1f;

        [Header("Spine Weights (0=Hip, 1=Shoulder)")]
        [SerializeField][Range(0f, 1f)] private float spineWeight = 0.25f;
        [SerializeField][Range(0f, 1f)] private float chestWeight = 0.55f;
        [SerializeField][Range(0f, 1f)] private float upperChestWeight = 0.85f;

        [Header("IK")]
        [SerializeField] private IKController ikController;

        [Header("Grip Coupling")]
        [SerializeField] private bool enableGripCoupling = true;

        [Header("Rotation Smoothing")]
        [SerializeField] private bool enableSmoothing = true;

        [Header("Finish Blend")]
        [SerializeField] private bool enableFinishBlend = true;
        [SerializeField][Range(0.1f, 0.8f)] private float finishVisThreshold = 0.5f;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        private struct BoneCache
        {
            public Transform bone;
            public Quaternion restRot;
            public Vector3 restUp;
            public Vector3 restAimDir;
        }

        private BoneCache hipsCache;
        private BoneCache[] spineChain;
        private float[] spineWeights;
        private BoneCache neckCache;
        private BoneCache headCache;

        private BoneCache leftUpperArmCache, leftLowerArmCache;
        private BoneCache rightUpperArmCache, rightLowerArmCache;
        private BoneCache leftUpperLegCache, leftLowerLegCache;
        private BoneCache rightUpperLegCache, rightLowerLegCache;

        private Transform leftHandBone;
        private Transform rightHandBone;

        private Vector3 hipsRestPosition;
        private float sourceToAvatarScale = 1f;
        private bool isInitialized;
        private Vector3 addressPelvisOffset;

        private Transform[] trackedBones;
        private Quaternion[] prevRotations;
        private Vector3 prevHipsPosition;
        private bool hasPreviousFrame;

        private Vector3 gripOffsetLocal;
        private bool gripOffsetCaptured;

        private Quaternion[] finishRotations;
        private Vector3 finishHipsPosition;
        private bool finishPoseCaptured;

        private float currentResponsiveness;
        private float currentGripWeight;
        private string debugPhase = "";
        private float debugFinishBlend;

        private Vector3 DataToAvatarSpace(Vector3 v)
        {
            return new Vector3(-v.x, v.y, -v.z);
        }

        public void Initialize(Animator targetAnimator, PoseFrame referenceFrame, PoseDataLoader loader)
        {
            animator = targetAnimator;

            Transform hipsBone = animator.GetBoneTransform(HumanBodyBones.Hips);
            Transform spineBone = animator.GetBoneTransform(HumanBodyBones.Spine);
            Transform chestBone = animator.GetBoneTransform(HumanBodyBones.Chest);
            Transform upperChestBone = animator.GetBoneTransform(HumanBodyBones.UpperChest);
            Transform neckBone = animator.GetBoneTransform(HumanBodyBones.Neck);
            Transform headBone = animator.GetBoneTransform(HumanBodyBones.Head);

            Transform lua = animator.GetBoneTransform(HumanBodyBones.LeftUpperArm);
            Transform lla = animator.GetBoneTransform(HumanBodyBones.LeftLowerArm);
            Transform lh = animator.GetBoneTransform(HumanBodyBones.LeftHand);
            Transform rua = animator.GetBoneTransform(HumanBodyBones.RightUpperArm);
            Transform rla = animator.GetBoneTransform(HumanBodyBones.RightLowerArm);
            Transform rh = animator.GetBoneTransform(HumanBodyBones.RightHand);

            Transform lul = animator.GetBoneTransform(HumanBodyBones.LeftUpperLeg);
            Transform lll = animator.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
            Transform lf = animator.GetBoneTransform(HumanBodyBones.LeftFoot);
            Transform rul = animator.GetBoneTransform(HumanBodyBones.RightUpperLeg);
            Transform rll = animator.GetBoneTransform(HumanBodyBones.RightLowerLeg);
            Transform rf = animator.GetBoneTransform(HumanBodyBones.RightFoot);

            leftHandBone = lh;
            rightHandBone = rh;

            hipsCache = MakeCache(hipsBone);
            hipsRestPosition = hipsBone != null ? hipsBone.position : Vector3.zero;

            int count = 0;
            if (spineBone != null) count++;
            if (chestBone != null) count++;
            if (upperChestBone != null) count++;
            spineChain = new BoneCache[count];
            spineWeights = new float[count];
            int idx = 0;
            if (spineBone != null) { spineChain[idx] = MakeCache(spineBone); spineWeights[idx] = spineWeight; idx++; }
            if (chestBone != null) { spineChain[idx] = MakeCache(chestBone); spineWeights[idx] = chestWeight; idx++; }
            if (upperChestBone != null) { spineChain[idx] = MakeCache(upperChestBone); spineWeights[idx] = upperChestWeight; idx++; }

            neckCache = MakeCache(neckBone);
            headCache = MakeCache(headBone);

            leftUpperArmCache = MakeLimbCache(lua, lla);
            leftLowerArmCache = MakeLimbCache(lla, lh);
            rightUpperArmCache = MakeLimbCache(rua, rla);
            rightLowerArmCache = MakeLimbCache(rla, rh);

            leftUpperLegCache = MakeLimbCache(lul, lll);
            leftLowerLegCache = MakeLimbCache(lll, lf);
            rightUpperLegCache = MakeLimbCache(rul, rll);
            rightLowerLegCache = MakeLimbCache(rll, rf);

            ComputeScaleFactor(referenceFrame, loader);
            CacheAddressPelvisOffset(loader);
            BuildTrackedBoneArray();

            if (enableGripCoupling)
                CaptureGripOffset(referenceFrame, loader);

            if (ikController == null) ikController = GetComponent<IKController>();
            if (ikController != null) ikController.Initialize(animator);

            animator.enabled = false;
            isInitialized = true;

            Debug.Log($"[BoneMapper] Initialized — scale: {sourceToAvatarScale:F3}, spine: {count}, grip: {gripOffsetCaptured}, addressOffset: {addressPelvisOffset}");
        }

        private void BuildTrackedBoneArray()
        {
            var list = new List<Transform>();
            if (hipsCache.bone != null) list.Add(hipsCache.bone);
            for (int i = 0; i < spineChain.Length; i++)
                if (spineChain[i].bone != null) list.Add(spineChain[i].bone);
            if (neckCache.bone != null) list.Add(neckCache.bone);
            if (headCache.bone != null) list.Add(headCache.bone);
            if (leftUpperArmCache.bone != null) list.Add(leftUpperArmCache.bone);
            if (leftLowerArmCache.bone != null) list.Add(leftLowerArmCache.bone);
            if (rightUpperArmCache.bone != null) list.Add(rightUpperArmCache.bone);
            if (rightLowerArmCache.bone != null) list.Add(rightLowerArmCache.bone);
            if (leftUpperLegCache.bone != null) list.Add(leftUpperLegCache.bone);
            if (leftLowerLegCache.bone != null) list.Add(leftLowerLegCache.bone);
            if (rightUpperLegCache.bone != null) list.Add(rightUpperLegCache.bone);
            if (rightLowerLegCache.bone != null) list.Add(rightLowerLegCache.bone);

            trackedBones = list.ToArray();
            prevRotations = new Quaternion[trackedBones.Length];
            finishRotations = new Quaternion[trackedBones.Length];
        }

        private void CaptureGripOffset(PoseFrame refFrame, PoseDataLoader loader)
        {
            if (refFrame == null || leftHandBone == null || rightHandBone == null) return;

            Quaternion[] savedRots = new Quaternion[trackedBones.Length];
            for (int i = 0; i < trackedBones.Length; i++)
                savedRots[i] = trackedBones[i].rotation;
            Vector3 savedHipsPos = hipsCache.bone != null ? hipsCache.bone.position : Vector3.zero;

            ApplyFKInternal(refFrame, loader);

            gripOffsetLocal = leftHandBone.InverseTransformPoint(rightHandBone.position);
            gripOffsetCaptured = true;

            for (int i = 0; i < trackedBones.Length; i++)
                trackedBones[i].rotation = savedRots[i];
            if (hipsCache.bone != null)
                hipsCache.bone.position = savedHipsPos;

            Debug.Log($"[BoneMapper] Grip offset captured: {gripOffsetLocal}");
        }

        private void CacheAddressPelvisOffset(PoseDataLoader loader)
        {
            PoseFrame addressFrame = loader.GetAddressFrame();
            if (addressFrame == null)
            {
                addressPelvisOffset = Vector3.zero;
                Debug.LogWarning("[BoneMapper] Address frame이 없어 pelvis offset을 (0,0,0)으로 설정");
                return;
            }

            Vector3 lHip = loader.GetLandmarkPosition(addressFrame, "left_hip");
            Vector3 rHip = loader.GetLandmarkPosition(addressFrame, "right_hip");
            Vector3 rawPelvis = (lHip + rHip) * 0.5f;
            addressPelvisOffset = DataToAvatarSpace(rawPelvis);

            Debug.Log($"[BoneMapper] Address pelvis offset: {addressPelvisOffset}");
        }

        private BoneCache MakeCache(Transform bone)
        {
            BoneCache c;
            c.bone = bone;
            c.restRot = bone != null ? bone.rotation : Quaternion.identity;
            c.restUp = bone != null ? bone.rotation * Vector3.up : Vector3.up;
            c.restAimDir = Vector3.up;
            return c;
        }

        private BoneCache MakeLimbCache(Transform bone, Transform child)
        {
            BoneCache c = MakeCache(bone);
            if (bone != null && child != null)
                c.restAimDir = (child.position - bone.position).normalized;
            return c;
        }

        private void ComputeScaleFactor(PoseFrame refFrame, PoseDataLoader loader)
        {
            if (refFrame == null || loader == null) return;
            Transform leftFoot = animator.GetBoneTransform(HumanBodyBones.LeftFoot);
            Transform hipsBone = animator.GetBoneTransform(HumanBodyBones.Hips);
            if (leftFoot == null || hipsBone == null) return;

            float avatarLen = Vector3.Distance(hipsBone.position, leftFoot.position);
            Vector3 srcHip = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_hip"));
            Vector3 srcAnkle = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_ankle"));
            float srcLen = Vector3.Distance(srcHip, srcAnkle);

            if (srcLen > 0.001f)
                sourceToAvatarScale = avatarLen / srcLen;
        }

        private void ApplyFKInternal(PoseFrame frame, PoseDataLoader loader)
        {
            Vector3 lShoulder = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_shoulder"));
            Vector3 rShoulder = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_shoulder"));
            Vector3 lHip = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_hip"));
            Vector3 rHip = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_hip"));
            Vector3 lElbow = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_elbow"));
            Vector3 rElbow = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_elbow"));
            Vector3 lWrist = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_wrist"));
            Vector3 rWrist = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_wrist"));
            Vector3 lKnee = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_knee"));
            Vector3 rKnee = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_knee"));
            Vector3 lAnkle = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_ankle"));
            Vector3 rAnkle = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_ankle"));
            Vector3 nose = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "nose"));
            Vector3 lEar = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_ear"));
            Vector3 rEar = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_ear"));

            Vector3 pelvis = (lHip + rHip) * 0.5f;
            Vector3 shoulders = (lShoulder + rShoulder) * 0.5f;
            Vector3 ears = (lEar + rEar) * 0.5f;

            Vector3 hipRight = (rHip - lHip).normalized;
            Vector3 shoulderRight = (rShoulder - lShoulder).normalized;
            Vector3 trunkDir = (shoulders - pelvis).normalized;

            if (hipsCache.bone != null)
            {
                Vector3 pelvisDelta = pelvis - addressPelvisOffset;
                hipsCache.bone.position = hipsRestPosition + pelvisDelta * sourceToAvatarScale * positionScale;
                ApplyAimTwist(ref hipsCache, trunkDir, hipRight);
            }

            for (int i = 0; i < spineChain.Length; i++)
            {
                if (spineChain[i].bone == null) continue;
                Vector3 blendedRight = Vector3.Slerp(hipRight, shoulderRight, spineWeights[i]).normalized;
                ApplyAimTwist(ref spineChain[i], trunkDir, blendedRight);
            }

            Vector3 neckDir = (ears - shoulders).normalized;
            if (neckCache.bone != null && neckDir.sqrMagnitude > 0.001f)
                ApplyAimTwist(ref neckCache, neckDir, shoulderRight);

            Vector3 headFwd = (nose - ears).normalized;
            Vector3 earRight = (rEar - lEar).normalized;
            Vector3 headUp = Vector3.Cross(headFwd, earRight).normalized;
            if (headCache.bone != null && headUp.sqrMagnitude > 0.001f)
                ApplyAimTwist(ref headCache, headUp, earRight);

            ApplyLimb(ref leftUpperArmCache, lShoulder, lElbow);
            ApplyLimb(ref leftLowerArmCache, lElbow, lWrist);
            ApplyLimb(ref rightUpperArmCache, rShoulder, rElbow);
            ApplyLimb(ref rightLowerArmCache, rElbow, rWrist);

            ApplyLimb(ref leftUpperLegCache, lHip, lKnee);
            ApplyLimb(ref leftLowerLegCache, lKnee, lAnkle);
            ApplyLimb(ref rightUpperLegCache, rHip, rKnee);
            ApplyLimb(ref rightLowerLegCache, rKnee, rAnkle);
        }

        public void ApplyPose(PoseFrame frame, PoseDataLoader loader, string phase)
        {
            if (!isInitialized || frame == null) return;

            UpdatePhaseParameters(phase);

            ApplyFKInternal(frame, loader);

            bool gripActive = enableGripCoupling && gripOffsetCaptured && currentGripWeight > 0.01f;
            if (gripActive)
                ApplyGripCoupling();

            if (ikController != null)
            {
                ikController.SkipArms = gripActive;
                ikController.Apply(frame, loader, DataToAvatarSpace, sourceToAvatarScale);
            }

            if (enableFinishBlend)
                HandleFinishPhase(frame, loader, phase);

            if (enableSmoothing)
                ApplySmoothing();

            CacheCurrentPose();
        }

        private void UpdatePhaseParameters(string phase)
        {
            debugPhase = phase;
            switch (phase)
            {
                case "setup":
                    currentResponsiveness = 0.35f;
                    currentGripWeight = 0f;
                    break;
                case "address":
                    currentResponsiveness = 0.35f;
                    currentGripWeight = 0.9f;
                    break;
                case "toe_up":
                case "mid_backswing":
                    currentResponsiveness = 0.55f;
                    currentGripWeight = 1f;
                    break;
                case "top":
                    currentResponsiveness = 0.5f;
                    currentGripWeight = 1f;
                    break;
                case "mid_downswing":
                    currentResponsiveness = 0.85f;
                    currentGripWeight = 1f;
                    break;
                case "impact":
                    currentResponsiveness = 0.9f;
                    currentGripWeight = 1f;
                    break;
                case "mid_follow_through":
                    currentResponsiveness = 0.55f;
                    currentGripWeight = 0.7f;
                    break;
                case "finish":
                    currentResponsiveness = 0.3f;
                    currentGripWeight = 0.3f;
                    break;
                default:
                    currentResponsiveness = 0.5f;
                    currentGripWeight = 0f;
                    break;
            }
        }

        private void ApplyGripCoupling()
        {
            if (leftHandBone == null || rightUpperArmCache.bone == null ||
                rightLowerArmCache.bone == null || rightHandBone == null) return;

            Vector3 coupledTarget = leftHandBone.TransformPoint(gripOffsetLocal);
            Vector3 hint = rightLowerArmCache.bone.position;

            Quaternion fkUpperRot = rightUpperArmCache.bone.rotation;
            Quaternion fkLowerRot = rightLowerArmCache.bone.rotation;

            TwoBoneIKSolver.Solve(
                rightUpperArmCache.bone,
                rightLowerArmCache.bone,
                rightHandBone,
                coupledTarget,
                hint);

            if (currentGripWeight < 0.999f)
            {
                rightUpperArmCache.bone.rotation = Quaternion.Slerp(fkUpperRot, rightUpperArmCache.bone.rotation, currentGripWeight);
                rightLowerArmCache.bone.rotation = Quaternion.Slerp(fkLowerRot, rightLowerArmCache.bone.rotation, currentGripWeight);
            }
        }

        private void HandleFinishPhase(PoseFrame frame, PoseDataLoader loader, string phase)
        {
            if ((phase == "impact" || phase == "mid_follow_through") && !finishPoseCaptured)
                CaptureFinishPose();

            if (phase == "finish" && finishPoseCaptured)
            {
                float blendWeight = ComputeFinishBlendWeight(frame, loader);
                debugFinishBlend = blendWeight;
                if (blendWeight > 0.01f)
                    ApplyFinishBlend(blendWeight);
            }
            else
            {
                debugFinishBlend = 0f;
            }
        }

        private void CaptureFinishPose()
        {
            for (int i = 0; i < trackedBones.Length; i++)
                finishRotations[i] = trackedBones[i].rotation;
            finishHipsPosition = hipsCache.bone != null ? hipsCache.bone.position : Vector3.zero;
            finishPoseCaptured = true;
            Debug.Log("[BoneMapper] Finish reference pose captured");
        }

        private float ComputeFinishBlendWeight(PoseFrame frame, PoseDataLoader loader)
        {
            float lElbowVis = loader.GetLandmarkVisibility(frame, "left_elbow");
            float lWristVis = loader.GetLandmarkVisibility(frame, "left_wrist");
            float rElbowVis = loader.GetLandmarkVisibility(frame, "right_elbow");
            float rWristVis = loader.GetLandmarkVisibility(frame, "right_wrist");

            float minArmVis = Mathf.Min(
                Mathf.Min(lElbowVis, lWristVis),
                Mathf.Min(rElbowVis, rWristVis));

            if (minArmVis >= finishVisThreshold) return 0f;
            return Mathf.InverseLerp(finishVisThreshold, 0.05f, minArmVis);
        }

        private void ApplyFinishBlend(float weight)
        {
            for (int i = 0; i < trackedBones.Length; i++)
                trackedBones[i].rotation = Quaternion.Slerp(trackedBones[i].rotation, finishRotations[i], weight);

            if (hipsCache.bone != null)
                hipsCache.bone.position = Vector3.Lerp(hipsCache.bone.position, finishHipsPosition, weight * 0.5f);
        }

        private void ApplySmoothing()
        {
            if (!hasPreviousFrame) return;

            float smoothLerp = 1f - Mathf.Pow(1f - currentResponsiveness, Time.deltaTime * 60f);

            for (int i = 0; i < trackedBones.Length; i++)
                trackedBones[i].rotation = Quaternion.Slerp(prevRotations[i], trackedBones[i].rotation, smoothLerp);

            if (hipsCache.bone != null)
                hipsCache.bone.position = Vector3.Lerp(prevHipsPosition, hipsCache.bone.position, smoothLerp);
        }

        private void CacheCurrentPose()
        {
            for (int i = 0; i < trackedBones.Length; i++)
                prevRotations[i] = trackedBones[i].rotation;
            prevHipsPosition = hipsCache.bone != null ? hipsCache.bone.position : Vector3.zero;
            hasPreviousFrame = true;
        }

        public void ResetPostProcessState()
        {
            hasPreviousFrame = false;
            finishPoseCaptured = false;
            Debug.Log("[BoneMapper] Post-process state reset");
        }

        private void ApplyAimTwist(ref BoneCache cache, Vector3 aimTarget, Vector3 rightTarget)
        {
            if (cache.bone == null) return;

            Quaternion aim = Quaternion.FromToRotation(cache.restUp, aimTarget);
            Quaternion afterAim = aim * cache.restRot;

            Vector3 aimedRight = afterAim * Vector3.right;
            Vector3 projAimed = Vector3.ProjectOnPlane(aimedRight, aimTarget).normalized;
            Vector3 projTarget = Vector3.ProjectOnPlane(rightTarget, aimTarget).normalized;

            if (projAimed.sqrMagnitude < 0.001f || projTarget.sqrMagnitude < 0.001f)
            {
                cache.bone.rotation = afterAim;
                return;
            }

            float angle = Vector3.SignedAngle(projAimed, projTarget, aimTarget);
            Quaternion twist = Quaternion.AngleAxis(angle, aimTarget);
            cache.bone.rotation = twist * afterAim;
        }

        private void ApplyLimb(ref BoneCache cache, Vector3 from, Vector3 to)
        {
            if (cache.bone == null) return;
            Vector3 dir = to - from;
            if (dir.sqrMagnitude < 0.0001f) return;
            Quaternion delta = Quaternion.FromToRotation(cache.restAimDir, dir.normalized);
            cache.bone.rotation = delta * cache.restRot;
        }

        private void OnGUI()
        {
            if (!showDebugInfo || !isInitialized) return;
            GUILayout.BeginArea(new Rect(10, 130, 400, 120));
            GUILayout.Label($"[BoneMapper] Phase: {debugPhase} | Spine: {spineChain.Length}");
            GUILayout.Label($"  Grip: {(enableGripCoupling && gripOffsetCaptured ? $"ON ({currentGripWeight:F2})" : "OFF")}");
            GUILayout.Label($"  Smoothing: {(enableSmoothing ? $"ON (resp: {currentResponsiveness:F2})" : "OFF")}");
            GUILayout.Label($"  Finish Blend: {(enableFinishBlend ? $"{debugFinishBlend:F2}" : "OFF")} | Captured: {finishPoseCaptured}");
            GUILayout.EndArea();
        }
    }
}
