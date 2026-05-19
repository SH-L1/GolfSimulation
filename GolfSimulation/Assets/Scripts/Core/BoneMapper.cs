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
        [SerializeField] private bool enableFallbackIK = false;

        [Header("Coordinate Mapping")]
        [SerializeField] private Vector3 dataAxisSigns = new Vector3(-1f, 1f, -1f);
        [SerializeField] private bool enableBodyFrameCalibration = true;
        [SerializeField] private bool preserveBodySideContinuity = true;
        [SerializeField] private bool useBackFacingBodyFrame = true;

        [Header("Golf Posture")]
        [SerializeField] private bool preserveGolfForwardBend = false;
        [SerializeField][Range(8f, 45f)] private float minAddressForwardBend = 22f;
        [SerializeField][Range(8f, 55f)] private float maxAddressForwardBend = 38f;
        [SerializeField][Range(0f, 1f)] private float spineForwardBendWeight = 0f;
        [SerializeField][Range(0f, 0.35f)] private float pelvisTrunkTiltWeight = 0.05f;
        [SerializeField] private bool enableHipDepthCompensation = true;
        [SerializeField][Range(0f, 0.5f)] private float addressHipBackOffset = 0.22f;
        [SerializeField][Range(0f, 1f)] private float hipDepthCompensationWeight = 1f;

        [Header("Rotation Smoothing")]
        [SerializeField] private bool enableSmoothing = false;

        [Header("Finish Blend")]
        [SerializeField] private bool enableFinishBlend = false;
        [SerializeField][Range(0.1f, 0.8f)] private float finishVisThreshold = 0.5f;
        [SerializeField][Range(0.1f, 2f)] private float finishHoldTime = 0.5f;

        [Header("Arm Protection")]
        [SerializeField] private bool enableArmProtection = false;
        [SerializeField][Range(0f, 0.6f)] private float armFreezeVisThreshold = 0.35f;
        [SerializeField][Range(90f, 160f)] private float maxElbowAngle = 140f;

        [Header("Constrained Arm IK")]
        [Tooltip("팔꿈치/손목 좌표 방향을 직접 FK로 쓰지 않고, 손목 target + 팔꿈치 hint 기반 IK로 팔을 풉니다.")]
        [SerializeField] private bool useConstrainedArmIK = true;
        [Tooltip("Constrained IK 사용 시 팔 FK를 건너뛰어 뒤접힘/꼬임을 줄입니다.")]
        [SerializeField] private bool skipArmFKWhenUsingIK = true;
        [SerializeField][Range(0f, 1f)] private float constrainedArmIKWeight = 1f;

        [Header("Arm Bend Plane")]
        [SerializeField][Range(0f, 1f)] private float elbowHintDataWeight = 0.25f;
        [SerializeField][Range(0f, 0.25f)] private float elbowForwardBias = 0.04f;
        [SerializeField] private bool forceArmsInFrontOfTorso = true;
        [SerializeField][Range(0f, 0.25f)] private float minArmForwardOffset = 0.08f;

        [Header("Two Hand Pose")]
        [SerializeField] private bool enableTwoHandGripPose = true;
        [SerializeField][Range(0.03f, 0.3f)] private float targetHandSeparation = 0.07f;
        [SerializeField][Range(0f, 1f)] private float gripTargetBlend = 1f;
        [SerializeField][Range(0f, 1f)] private float handOrientationWeight = 0.9f;
        [SerializeField][Range(0f, 0.15f)] private float gripForwardOffset = 0.035f;

        [Header("Head Stabilization")]
        [SerializeField] private bool enableHeadStabilization = true;
        [SerializeField] private bool useHandsAsHeadLookTarget = false;
        [SerializeField][Range(0f, 1f)] private float neckDataWeight = 0.18f;
        [SerializeField][Range(0f, 1f)] private float headDataWeight = 0.18f;
        [SerializeField][Range(10f, 80f)] private float maxHeadAngleFromTorso = 28f;

        [Header("Constrained Leg IK")]
        [SerializeField] private bool useConstrainedLegIK = true;
        [SerializeField] private bool skipLegFKWhenUsingIK = true;
        [SerializeField][Range(0f, 1f)] private float constrainedLegIKWeight = 0.85f;
        [SerializeField][Range(0f, 1f)] private float kneeHintDataWeight = 0.18f;
        [SerializeField][Range(0f, 0.35f)] private float footLockRadius = 0.08f;
        [SerializeField][Range(0f, 1f)] private float footLockWeight = 0.85f;

        [Header("Foot Stabilization")]
        [SerializeField] private bool enableFootStabilization = true;
        [SerializeField][Range(0f, 1f)] private float footDataWeight = 0.22f;
        [SerializeField][Range(5f, 60f)] private float maxFootAngleFromRest = 24f;
        [SerializeField][Range(0f, 1f)] private float toeStabilizationWeight = 0.85f;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = false;
        [SerializeField] private bool logRetargetDiagnostics = true;

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
        private BoneCache leftFootCache, rightFootCache;

        private Transform leftHandBone;
        private Transform rightHandBone;
        private Transform leftToeBone;
        private Transform rightToeBone;

        private Vector3 hipsRestPosition;
        private float sourceToAvatarScale = 1f;
        private bool isInitialized;
        private Vector3 addressPelvisOffset;

        private Transform[] trackedBones;
        private Quaternion[] prevRotations;
        private Vector3 prevHipsPosition;
        private bool hasPreviousFrame;

        private Quaternion[] finishRotations;
        private Vector3 finishHipsPosition;
        private bool finishPoseCaptured;

        private float currentResponsiveness;
        private string debugPhase = "";
        private float debugFinishBlend;
        private bool diagnosticsLogged;
        private int armTargetClampCount;
        private Quaternion dataFrameToAvatarFrame = Quaternion.identity;
        private Vector3 lastShoulderRight = Vector3.right;
        private Vector3 lastTrunkDir = Vector3.up;
        private Vector3 lastBodyForward = Vector3.forward;
        private Vector3 avatarForwardReference = Vector3.forward;
        private Vector3 avatarUpReference = Vector3.up;
        private Vector3 lastBodyOrigin = Vector3.zero;
        private float leftFootForwardSign = 1f;
        private float rightFootForwardSign = 1f;
        private Vector3 lastLeftShoulderWorld = Vector3.zero;
        private Vector3 lastRightShoulderWorld = Vector3.zero;
        private Vector3 addressLeftFootWorld = Vector3.zero;
        private Vector3 addressRightFootWorld = Vector3.zero;
        private Vector3 addressFootCenterWorld = Vector3.zero;
        private Quaternion leftFootAddressRotation = Quaternion.identity;
        private Quaternion rightFootAddressRotation = Quaternion.identity;
        private Quaternion leftToeRestRotation = Quaternion.identity;
        private Quaternion rightToeRestRotation = Quaternion.identity;
        private float sourceAddressForwardBendDeg = 0f;
        private Vector3 lastStableHeadForward = Vector3.forward;
        private bool hasStableHeadForward;

        private Vector3 sourceRestHipRight = Vector3.right;
        private Vector3 sourceRestShoulderRight = Vector3.right;
        private Vector3 sourceRestTrunkDir = Vector3.up;
        private Vector3 sourceRestNeckDir = Vector3.up;
        private Vector3 sourceRestHeadForward = Vector3.forward;
        private Vector3 sourceRestEarRight = Vector3.right;
        private Vector3 sourceRestLeftUpperArmDir = Vector3.right;
        private Vector3 sourceRestLeftLowerArmDir = Vector3.right;
        private Vector3 sourceRestRightUpperArmDir = Vector3.left;
        private Vector3 sourceRestRightLowerArmDir = Vector3.left;
        private Vector3 sourceRestLeftUpperLegDir = Vector3.down;
        private Vector3 sourceRestLeftLowerLegDir = Vector3.down;
        private Vector3 sourceRestRightUpperLegDir = Vector3.down;
        private Vector3 sourceRestRightLowerLegDir = Vector3.down;
        private Vector3 sourceRestLeftFootForward = Vector3.forward;
        private Vector3 sourceRestLeftFootRight = Vector3.right;
        private Vector3 sourceRestRightFootForward = Vector3.forward;
        private Vector3 sourceRestRightFootRight = Vector3.right;

        // Arm protection — bone indices in trackedBones array
        private int boneIdxLUA = -1, boneIdxLLA = -1, boneIdxRUA = -1, boneIdxRLA = -1;

        // Finish hold timer
        private float finishBlendTimer = 0f;

        private Vector3 DataToAvatarSpace(Vector3 v)
        {
            Vector3 signed = new Vector3(v.x * dataAxisSigns.x, v.y * dataAxisSigns.y, v.z * dataAxisSigns.z);
            return dataFrameToAvatarFrame * signed;
        }

        private Vector3 ApplyAxisSigns(Vector3 v)
        {
            return new Vector3(v.x * dataAxisSigns.x, v.y * dataAxisSigns.y, v.z * dataAxisSigns.z);
        }

        public Vector3 ConvertDataToAvatarSpace(Vector3 v)
        {
            return DataToAvatarSpace(v);
        }

        public Vector3 DataPointToAvatarWorld(Vector3 dataPoint)
        {
            return AvatarSpacePointToWorld(DataToAvatarSpace(dataPoint));
        }

        private Vector3 AvatarSpacePointToWorld(Vector3 avatarPoint)
        {
            return hipsRestPosition + (avatarPoint - addressPelvisOffset) * sourceToAvatarScale * positionScale;
        }

        public bool IsInitialized => isInitialized;
        public Vector3 BodyFrameOrigin => lastBodyOrigin;
        public Vector3 BodyFrameRight => lastShoulderRight;
        public Vector3 BodyFrameUp => lastTrunkDir;
        public Vector3 BodyFrameForward => lastBodyForward;

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
            Transform lt = animator.GetBoneTransform(HumanBodyBones.LeftToes);
            Transform rul = animator.GetBoneTransform(HumanBodyBones.RightUpperLeg);
            Transform rll = animator.GetBoneTransform(HumanBodyBones.RightLowerLeg);
            Transform rf = animator.GetBoneTransform(HumanBodyBones.RightFoot);
            Transform rt = animator.GetBoneTransform(HumanBodyBones.RightToes);

            leftHandBone = lh;
            rightHandBone = rh;
            leftToeBone = lt;
            rightToeBone = rt;
            leftToeRestRotation = lt != null ? lt.rotation : Quaternion.identity;
            rightToeRestRotation = rt != null ? rt.rotation : Quaternion.identity;

            hipsCache = MakeCache(hipsBone);
            hipsRestPosition = hipsBone != null ? hipsBone.position : Vector3.zero;
            avatarForwardReference = ResolveAvatarForwardHint(hipsBone);
            avatarUpReference = ResolveAvatarUp(hipsBone, chestBone, upperChestBone);
            lastBodyForward = avatarForwardReference;

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
            headCache = MakeHeadCache(headBone);

            leftUpperArmCache = MakeLimbCache(lua, lla);
            leftLowerArmCache = MakeLimbCache(lla, lh);
            rightUpperArmCache = MakeLimbCache(rua, rla);
            rightLowerArmCache = MakeLimbCache(rla, rh);

            leftUpperLegCache = MakeLimbCache(lul, lll);
            leftLowerLegCache = MakeLimbCache(lll, lf);
            rightUpperLegCache = MakeLimbCache(rul, rll);
            rightLowerLegCache = MakeLimbCache(rll, rf);
            leftFootCache = MakeFootCache(lf);
            rightFootCache = MakeFootCache(rf);

            CalibrateDataFrame(referenceFrame, loader, hipsBone, chestBone, upperChestBone, lua, rua, lul, rul);
            ComputeScaleFactor(referenceFrame, loader);
            CacheAddressPelvisOffset(loader);
            CalibrateFootForwardSigns(referenceFrame, loader, lf, rf);
            CacheSourceRestPose(referenceFrame, loader);
            CacheAddressFootState(loader);
            BuildTrackedBoneArray();

            if (ikController == null) ikController = GetComponent<IKController>();
            if (ikController != null) ikController.Initialize(animator);

            animator.enabled = false;
            isInitialized = true;
            hasStableHeadForward = false;

            Debug.Log($"[BoneMapper] Initialized — scale: {sourceToAvatarScale:F3}, spine: {count}, addressOffset: {addressPelvisOffset}");
        }

        private void BuildTrackedBoneArray()
        {
            var list = new List<Transform>();
            if (hipsCache.bone != null) list.Add(hipsCache.bone);
            for (int i = 0; i < spineChain.Length; i++)
                if (spineChain[i].bone != null) list.Add(spineChain[i].bone);
            if (neckCache.bone != null) list.Add(neckCache.bone);
            if (headCache.bone != null) list.Add(headCache.bone);

            boneIdxLUA = leftUpperArmCache.bone  != null ? list.Count : -1;
            if (leftUpperArmCache.bone  != null) list.Add(leftUpperArmCache.bone);
            boneIdxLLA = leftLowerArmCache.bone  != null ? list.Count : -1;
            if (leftLowerArmCache.bone  != null) list.Add(leftLowerArmCache.bone);
            boneIdxRUA = rightUpperArmCache.bone != null ? list.Count : -1;
            if (rightUpperArmCache.bone != null) list.Add(rightUpperArmCache.bone);
            boneIdxRLA = rightLowerArmCache.bone != null ? list.Count : -1;
            if (rightLowerArmCache.bone != null) list.Add(rightLowerArmCache.bone);

            if (leftUpperLegCache.bone  != null) list.Add(leftUpperLegCache.bone);
            if (leftLowerLegCache.bone  != null) list.Add(leftLowerLegCache.bone);
            if (leftFootCache.bone      != null) list.Add(leftFootCache.bone);
            if (leftToeBone             != null) list.Add(leftToeBone);
            if (rightUpperLegCache.bone != null) list.Add(rightUpperLegCache.bone);
            if (rightLowerLegCache.bone != null) list.Add(rightLowerLegCache.bone);
            if (rightFootCache.bone     != null) list.Add(rightFootCache.bone);
            if (rightToeBone            != null) list.Add(rightToeBone);

            trackedBones = list.ToArray();
            prevRotations = new Quaternion[trackedBones.Length];
            finishRotations = new Quaternion[trackedBones.Length];
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

        private void CacheAddressFootState(PoseDataLoader loader)
        {
            PoseFrame addressFrame = loader != null ? loader.GetAddressFrame() : null;
            if (addressFrame != null)
            {
                addressLeftFootWorld = DataPointToAvatarWorld(loader.GetLandmarkPosition(addressFrame, "left_ankle"));
                addressRightFootWorld = DataPointToAvatarWorld(loader.GetLandmarkPosition(addressFrame, "right_ankle"));
                addressFootCenterWorld = (addressLeftFootWorld + addressRightFootWorld) * 0.5f;
                sourceAddressForwardBendDeg = Mathf.Clamp(
                    EstimateRawForwardBend(addressFrame, loader),
                    minAddressForwardBend,
                    maxAddressForwardBend);
            }

            leftFootAddressRotation = leftFootCache.bone != null ? leftFootCache.bone.rotation : Quaternion.identity;
            rightFootAddressRotation = rightFootCache.bone != null ? rightFootCache.bone.rotation : Quaternion.identity;
        }

        private float EstimateRawForwardBend(PoseFrame frame, PoseDataLoader loader)
        {
            if (frame == null || loader == null) return minAddressForwardBend;

            Vector3 lHip = ApplyAxisSigns(loader.GetLandmarkPosition(frame, "left_hip"));
            Vector3 rHip = ApplyAxisSigns(loader.GetLandmarkPosition(frame, "right_hip"));
            Vector3 lShoulder = ApplyAxisSigns(loader.GetLandmarkPosition(frame, "left_shoulder"));
            Vector3 rShoulder = ApplyAxisSigns(loader.GetLandmarkPosition(frame, "right_shoulder"));
            Vector3 pelvis = (lHip + rHip) * 0.5f;
            Vector3 shoulders = (lShoulder + rShoulder) * 0.5f;
            Vector3 trunk = shoulders - pelvis;

            float vertical = Mathf.Abs(trunk.y);
            float depth = Mathf.Abs(trunk.z);
            if (vertical < 0.0001f) return minAddressForwardBend;
            return Mathf.Atan2(depth, vertical) * Mathf.Rad2Deg;
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

        private BoneCache MakeFootCache(Transform bone)
        {
            BoneCache c = MakeCache(bone);
            if (bone != null)
            {
                c.restUp = bone.rotation * Vector3.forward;
                c.restAimDir = Vector3.forward;
            }
            return c;
        }

        private BoneCache MakeHeadCache(Transform bone)
        {
            BoneCache c = MakeCache(bone);
            if (bone != null)
            {
                c.restUp = bone.rotation * Vector3.forward;
                c.restAimDir = Vector3.forward;
            }
            return c;
        }

        private void CalibrateDataFrame(PoseFrame refFrame, PoseDataLoader loader, Transform hipsBone,
                                        Transform chestBone, Transform upperChestBone,
                                        Transform leftUpperArm, Transform rightUpperArm,
                                        Transform leftUpperLeg, Transform rightUpperLeg)
        {
            dataFrameToAvatarFrame = Quaternion.identity;
            if (!enableBodyFrameCalibration || refFrame == null || loader == null || hipsBone == null)
                return;

            if (!TryBuildDataBodyFrame(
                    ApplyAxisSigns(loader.GetLandmarkPosition(refFrame, "left_hip")),
                    ApplyAxisSigns(loader.GetLandmarkPosition(refFrame, "right_hip")),
                    ApplyAxisSigns(loader.GetLandmarkPosition(refFrame, "left_shoulder")),
                    ApplyAxisSigns(loader.GetLandmarkPosition(refFrame, "right_shoulder")),
                    out _, out Vector3 dataRight, out Vector3 dataUp, out Vector3 dataForward))
            {
                Debug.LogWarning("[BoneMapper] Body frame calibration skipped: invalid reference landmarks.");
                return;
            }

            Vector3 avatarOrigin = hipsBone.position;
            Vector3 avatarUp = ResolveAvatarUp(hipsBone, chestBone, upperChestBone);
            avatarUpReference = avatarUp;
            Vector3 avatarRight = ResolveAvatarRight(hipsBone, leftUpperArm, rightUpperArm, leftUpperLeg, rightUpperLeg);
            Orthonormalize(ref avatarRight, ref avatarUp, out Vector3 avatarForward);

            Vector3 avatarForwardHint = ResolveAvatarForwardHint(hipsBone);
            if (Vector3.Dot(avatarForward, avatarForwardHint) < 0f)
                avatarForward = -avatarForward;
            avatarRight = Vector3.Cross(avatarUp, avatarForward).normalized;
            avatarForwardReference = avatarForward;

            Quaternion dataRot = Quaternion.LookRotation(dataForward, dataUp);
            Quaternion avatarRot = Quaternion.LookRotation(avatarForward, avatarUp);
            dataFrameToAvatarFrame = avatarRot * Quaternion.Inverse(dataRot);

            lastBodyOrigin = avatarOrigin;
            lastShoulderRight = avatarRight;
            lastTrunkDir = avatarUp;
            lastBodyForward = avatarForward;

            Debug.Log($"[BoneMapper] Body frame calibrated. Data F/U/R: {dataForward}/{dataUp}/{dataRight}, Avatar F/U/R: {avatarForward}/{avatarUp}/{avatarRight}");
        }

        private Vector3 ResolveAvatarForwardHint(Transform hipsBone)
        {
            if (animator != null && animator.transform != null && animator.transform.forward.sqrMagnitude > 0.001f)
                return animator.transform.forward.normalized;

            if (hipsBone != null && hipsBone.forward.sqrMagnitude > 0.001f)
                return hipsBone.forward.normalized;

            return Vector3.forward;
        }

        private Vector3 ResolveAvatarUp(Transform hipsBone, Transform chestBone, Transform upperChestBone)
        {
            Transform upper = upperChestBone != null ? upperChestBone : chestBone;
            if (hipsBone != null && upper != null)
            {
                Vector3 up = upper.position - hipsBone.position;
                if (up.sqrMagnitude > 0.0001f) return up.normalized;
            }
            return Vector3.up;
        }

        private Vector3 ResolveAvatarRight(Transform hipsBone, Transform leftUpperArm, Transform rightUpperArm,
                                           Transform leftUpperLeg, Transform rightUpperLeg)
        {
            if (leftUpperArm != null && rightUpperArm != null)
            {
                Vector3 right = rightUpperArm.position - leftUpperArm.position;
                if (right.sqrMagnitude > 0.0001f) return right.normalized;
            }

            if (leftUpperLeg != null && rightUpperLeg != null)
            {
                Vector3 right = rightUpperLeg.position - leftUpperLeg.position;
                if (right.sqrMagnitude > 0.0001f) return right.normalized;
            }

            return hipsBone != null ? hipsBone.right : Vector3.right;
        }

        private bool TryBuildDataBodyFrame(Vector3 lHip, Vector3 rHip, Vector3 lShoulder, Vector3 rShoulder,
                                           out Vector3 origin, out Vector3 right, out Vector3 up, out Vector3 forward)
        {
            origin = (lHip + rHip) * 0.5f;
            Vector3 shoulders = (lShoulder + rShoulder) * 0.5f;
            right = ((rHip - lHip) + (rShoulder - lShoulder)) * 0.5f;
            up = shoulders - origin;
            forward = Vector3.forward;

            if (right.sqrMagnitude < 0.0001f || up.sqrMagnitude < 0.0001f)
                return false;

            right.Normalize();
            up.Normalize();
            Orthonormalize(ref right, ref up, out forward);
            return forward.sqrMagnitude > 0.0001f;
        }

        private void Orthonormalize(ref Vector3 right, ref Vector3 up, out Vector3 forward)
        {
            up = up.sqrMagnitude > 0.0001f ? up.normalized : Vector3.up;
            right = Vector3.ProjectOnPlane(right, up);
            if (right.sqrMagnitude < 0.0001f)
                right = Vector3.ProjectOnPlane(Vector3.right, up);
            right.Normalize();
            forward = Vector3.Cross(right, up).normalized;
            right = Vector3.Cross(up, forward).normalized;
        }

        private void CalibrateFootForwardSigns(PoseFrame refFrame, PoseDataLoader loader, Transform leftFoot, Transform rightFoot)
        {
            if (refFrame == null || loader == null) return;
            leftFootForwardSign = ResolveFootForwardSign(
                loader.GetLandmarkPosition(refFrame, "left_heel"),
                loader.GetLandmarkPosition(refFrame, "left_foot_index"),
                leftFoot);
            rightFootForwardSign = ResolveFootForwardSign(
                loader.GetLandmarkPosition(refFrame, "right_heel"),
                loader.GetLandmarkPosition(refFrame, "right_foot_index"),
                rightFoot);
        }

        private float ResolveFootForwardSign(Vector3 heelData, Vector3 toeData, Transform foot)
        {
            if (foot == null) return 1f;
            Vector3 dataForward = DataToAvatarSpace(toeData) - DataToAvatarSpace(heelData);
            if (dataForward.sqrMagnitude < 0.0001f) return 1f;
            return Vector3.Dot(dataForward.normalized, foot.forward) < 0f ? -1f : 1f;
        }

        private void CacheSourceRestPose(PoseFrame refFrame, PoseDataLoader loader)
        {
            if (refFrame == null || loader == null) return;

            Vector3 lShoulder = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_shoulder"));
            Vector3 rShoulder = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_shoulder"));
            Vector3 lHip = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_hip"));
            Vector3 rHip = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_hip"));
            Vector3 lElbow = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_elbow"));
            Vector3 rElbow = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_elbow"));
            Vector3 lWrist = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_wrist"));
            Vector3 rWrist = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_wrist"));
            Vector3 lKnee = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_knee"));
            Vector3 rKnee = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_knee"));
            Vector3 lAnkle = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_ankle"));
            Vector3 rAnkle = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_ankle"));
            Vector3 lHeel = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_heel"));
            Vector3 rHeel = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_heel"));
            Vector3 lToe = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_foot_index"));
            Vector3 rToe = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_foot_index"));
            Vector3 nose = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "nose"));
            Vector3 lEar = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "left_ear"));
            Vector3 rEar = DataToAvatarSpace(loader.GetLandmarkPosition(refFrame, "right_ear"));

            Vector3 pelvis = (lHip + rHip) * 0.5f;
            Vector3 shoulders = (lShoulder + rShoulder) * 0.5f;
            Vector3 ears = (lEar + rEar) * 0.5f;

            if (TryBuildDataBodyFrame(lHip, rHip, lShoulder, rShoulder,
                    out _, out Vector3 bodyRight, out Vector3 bodyUp, out _))
            {
                sourceRestHipRight = AlignRightAxisToBody(rHip - lHip, bodyUp, bodyRight);
                sourceRestShoulderRight = AlignRightAxisToBody(rShoulder - lShoulder, bodyUp, bodyRight);
                sourceRestTrunkDir = bodyUp;
            }
            else
            {
                sourceRestHipRight = SafeDir(rHip - lHip, Vector3.right);
                sourceRestShoulderRight = SafeDir(rShoulder - lShoulder, Vector3.right);
                sourceRestTrunkDir = SafeDir(shoulders - pelvis, Vector3.up);
            }

            sourceRestNeckDir = SafeDir(ears - shoulders, sourceRestTrunkDir);
            sourceRestHeadForward = ResolveHeadForward(nose, ears, lWrist, rWrist);
            sourceRestEarRight = SafeDir(rEar - lEar, sourceRestShoulderRight);

            sourceRestLeftUpperArmDir = SafeDir(lElbow - lShoulder, Vector3.left);
            sourceRestLeftLowerArmDir = SafeDir(lWrist - lElbow, Vector3.left);
            sourceRestRightUpperArmDir = SafeDir(rElbow - rShoulder, Vector3.right);
            sourceRestRightLowerArmDir = SafeDir(rWrist - rElbow, Vector3.right);
            sourceRestLeftUpperLegDir = SafeDir(lKnee - lHip, Vector3.down);
            sourceRestLeftLowerLegDir = SafeDir(lAnkle - lKnee, Vector3.down);
            sourceRestRightUpperLegDir = SafeDir(rKnee - rHip, Vector3.down);
            sourceRestRightLowerLegDir = SafeDir(rAnkle - rKnee, Vector3.down);

            BuildFootFrame(lAnkle, lHeel, lToe, leftFootForwardSign, out sourceRestLeftFootForward, out sourceRestLeftFootRight);
            BuildFootFrame(rAnkle, rHeel, rToe, rightFootForwardSign, out sourceRestRightFootForward, out sourceRestRightFootRight);
            Debug.Log("[BoneMapper] Source rest pose cached from reference frame.");
        }

        private Vector3 SafeDir(Vector3 dir, Vector3 fallback)
        {
            return dir.sqrMagnitude > 0.0001f ? dir.normalized : fallback.normalized;
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
            Vector3 lHeel = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_heel"));
            Vector3 rHeel = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_heel"));
            Vector3 lToe = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_foot_index"));
            Vector3 rToe = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_foot_index"));
            Vector3 nose = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "nose"));
            Vector3 lEar = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_ear"));
            Vector3 rEar = DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_ear"));

            Vector3 pelvis = (lHip + rHip) * 0.5f;
            Vector3 shoulders = (lShoulder + rShoulder) * 0.5f;
            Vector3 ears = (lEar + rEar) * 0.5f;
            lastLeftShoulderWorld = DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, "left_shoulder"));
            lastRightShoulderWorld = DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, "right_shoulder"));

            Vector3 hipRight = (rHip - lHip).normalized;
            Vector3 shoulderRight = (rShoulder - lShoulder).normalized;
            Vector3 trunkDir = (shoulders - pelvis).normalized;
            if (TryBuildDataBodyFrame(lHip, rHip, lShoulder, rShoulder,
                    out pelvis, out Vector3 bodyRight, out Vector3 bodyUp, out Vector3 bodyForward))
            {
                StabilizeBodyFrameHandedness(ref bodyRight, ref bodyForward);
                hipRight = AlignRightAxisToBody(rHip - lHip, bodyUp, bodyRight);
                shoulderRight = AlignRightAxisToBody(rShoulder - lShoulder, bodyUp, bodyRight);
                trunkDir = bodyUp;
            }
            UpdateBodyReference(pelvis, hipRight, shoulderRight, trunkDir, bodyForward);

            if (hipsCache.bone != null)
            {
                Vector3 pelvisDelta = pelvis - addressPelvisOffset;
                Vector3 hipsPosition = hipsRestPosition + pelvisDelta * sourceToAvatarScale * positionScale;
                hipsCache.bone.position = ApplyHipDepthCompensation(hipsPosition);
                ApplyAimTwist(ref hipsCache, ResolvePelvisUp(trunkDir), hipRight);
            }

            for (int i = 0; i < spineChain.Length; i++)
            {
                if (spineChain[i].bone == null) continue;
                Vector3 blendedRight = Vector3.Slerp(hipRight, shoulderRight, spineWeights[i]).normalized;
                ApplyAimTwist(ref spineChain[i], trunkDir, blendedRight);
            }

            ApplyGolfForwardBend();

            Vector3 neckDir = (ears - shoulders).normalized;
            if (neckCache.bone != null && neckDir.sqrMagnitude > 0.001f)
                ApplyNeckRotation(ref neckCache, neckDir, shoulderRight);

            Vector3 headFwd = ResolveHeadForward(nose, ears, lWrist, rWrist);
            Vector3 earRight = (rEar - lEar).normalized;
            Vector3 headUp = Vector3.Cross(earRight, headFwd).normalized;
            if (headCache.bone != null && headFwd.sqrMagnitude > 0.001f)
                ApplyHeadRotation(ref headCache, headFwd, earRight, shoulderRight, lWrist, rWrist);

            if (!useConstrainedArmIK || !skipArmFKWhenUsingIK)
            {
                ApplyLimbDelta(ref leftUpperArmCache, sourceRestLeftUpperArmDir, lShoulder, lElbow);
                ApplyLimbDelta(ref leftLowerArmCache, sourceRestLeftLowerArmDir, lElbow, lWrist);
                ApplyLimbDelta(ref rightUpperArmCache, sourceRestRightUpperArmDir, rShoulder, rElbow);
                ApplyLimbDelta(ref rightLowerArmCache, sourceRestRightLowerArmDir, rElbow, rWrist);
            }

            if (!useConstrainedLegIK || !skipLegFKWhenUsingIK)
            {
                ApplyLimbDelta(ref leftUpperLegCache, sourceRestLeftUpperLegDir, lHip, lKnee);
                ApplyLimbDelta(ref leftLowerLegCache, sourceRestLeftLowerLegDir, lKnee, lAnkle);
                ApplyLimbDelta(ref rightUpperLegCache, sourceRestRightUpperLegDir, rHip, rKnee);
                ApplyLimbDelta(ref rightLowerLegCache, sourceRestRightLowerLegDir, rKnee, rAnkle);
            }

            if (!useConstrainedLegIK)
            {
                if (loader.GetLandmarkVisibility(frame, "left_foot_index") > 0.2f)
                    ApplyFootOrientation(ref leftFootCache, lAnkle, lHeel, lToe, leftFootForwardSign);
                if (loader.GetLandmarkVisibility(frame, "right_foot_index") > 0.2f)
                    ApplyFootOrientation(ref rightFootCache, rAnkle, rHeel, rToe, rightFootForwardSign);
            }
        }

        private void StabilizeBodyFrameHandedness(ref Vector3 bodyRight, ref Vector3 bodyForward)
        {
            if (!preserveBodySideContinuity || bodyRight.sqrMagnitude < 0.0001f)
                return;

            Vector3 referenceRight = sourceRestShoulderRight.sqrMagnitude > 0.0001f
                ? sourceRestShoulderRight
                : lastShoulderRight;

            if (referenceRight.sqrMagnitude < 0.0001f)
                return;

            if (useBackFacingBodyFrame)
                referenceRight = -referenceRight;

            if (Vector3.Dot(bodyRight.normalized, referenceRight.normalized) < 0f)
            {
                bodyRight = -bodyRight;
                bodyForward = -bodyForward;
            }
        }

        public void ApplyPose(PoseFrame frame, PoseDataLoader loader, string phase, int frameIndex = 0)
        {
            if (!isInitialized || frame == null) return;

            UpdatePhaseParameters(phase);

            ApplyFKInternal(frame, loader);

            if (useConstrainedArmIK)
                ApplyConstrainedArmIK(frame, loader);

            if (useConstrainedLegIK)
                ApplyConstrainedLegIK(frame, loader);

            if (enableArmProtection)
                ApplyArmProtection(frame, loader);

            if (enableFallbackIK && ikController != null)
            {
                ikController.SkipArms = useConstrainedArmIK;
                ikController.SkipLegs = useConstrainedLegIK;
                ikController.Apply(frame, loader, DataPointToAvatarWorld);
            }

            if (enableFinishBlend)
                HandleFinishPhase(frame, loader, phase);

            if (enableSmoothing)
                ApplySmoothing();

            LogRetargetDiagnosticsOnce(frame, loader, frameIndex);
            CacheCurrentPose();
        }

        private void LogRetargetDiagnosticsOnce(PoseFrame frame, PoseDataLoader loader, int frameIndex)
        {
            if (!logRetargetDiagnostics || diagnosticsLogged || frame == null || loader == null) return;
            if (frameIndex <= 0 && debugPhase != "address") return;

            float leftFootIndexVis = loader.GetLandmarkVisibility(frame, "left_foot_index");
            float rightFootIndexVis = loader.GetLandmarkVisibility(frame, "right_foot_index");

            Vector3 leftWristWorld = DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, "left_wrist"));
            Vector3 rightWristWorld = DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, "right_wrist"));
            Vector3 bodyFront = GetAnatomicalFrontDirection();
            float leftArmForward = Vector3.Dot(leftWristWorld - lastLeftShoulderWorld, bodyFront);
            float rightArmForward = Vector3.Dot(rightWristWorld - lastRightShoulderWorld, bodyFront);

            Debug.Log(
                $"[BoneMapper][Diagnostics] frame={frameIndex}, phase={debugPhase}, " +
                $"bodyF={lastBodyForward}, bodyFront={bodyFront}, trunk={lastTrunkDir}, " +
                $"wristForward(L/R)=({leftArmForward:F3}/{rightArmForward:F3}), " +
                $"armClamps={armTargetClampCount}, footIndexVis(L/R)=({leftFootIndexVis:F2}/{rightFootIndexVis:F2}), " +
                $"axisSigns={dataAxisSigns}");

            diagnosticsLogged = true;
        }

        private void UpdatePhaseParameters(string phase)
        {
            debugPhase = phase;
            switch (phase)
            {
                case "setup":
                    currentResponsiveness = 0.35f;
                    break;
                case "address":
                    currentResponsiveness = 0.35f;
                    break;
                case "toe_up":
                case "mid_backswing":
                    currentResponsiveness = 0.55f;
                    break;
                case "top":
                    currentResponsiveness = 0.5f;
                    break;
                case "mid_downswing":
                    currentResponsiveness = 0.85f;
                    break;
                case "impact":
                    currentResponsiveness = 0.9f;
                    break;
                case "mid_follow_through":
                    currentResponsiveness = 0.55f;
                    break;
                case "finish":
                    currentResponsiveness = 0.3f;
                    break;
                default:
                    currentResponsiveness = 0.5f;
                    break;
            }
        }

        private void ApplyConstrainedArmIK(PoseFrame frame, PoseDataLoader loader)
        {
            Vector3 leftTarget = DataJointToWorldFromAnchor(
                frame,
                loader,
                "left_wrist",
                "left_shoulder",
                leftUpperArmCache.bone);
            Vector3 rightTarget = DataJointToWorldFromAnchor(
                frame,
                loader,
                "right_wrist",
                "right_shoulder",
                rightUpperArmCache.bone);
            armTargetClampCount = 0;

            if (enableTwoHandGripPose)
                ApplyTwoHandGripTargets(ref leftTarget, ref rightTarget);

            if (forceArmsInFrontOfTorso)
            {
                ClampArmTargetInFront(ref leftTarget, leftUpperArmCache.bone != null ? leftUpperArmCache.bone.position : lastLeftShoulderWorld);
                ClampArmTargetInFront(ref rightTarget, rightUpperArmCache.bone != null ? rightUpperArmCache.bone.position : lastRightShoulderWorld);
            }

            Vector3 leftHint = ResolveArmHint(
                leftUpperArmCache.bone,
                frame,
                loader,
                true);
            Vector3 rightHint = ResolveArmHint(
                rightUpperArmCache.bone,
                frame,
                loader,
                false);

            SolveArmFromTarget(leftUpperArmCache.bone, leftLowerArmCache.bone, leftHandBone, leftTarget, leftHint);
            SolveArmFromTarget(rightUpperArmCache.bone, rightLowerArmCache.bone, rightHandBone, rightTarget, rightHint);

            if (enableTwoHandGripPose)
                ApplyHandGripOrientation();
        }

        private void ApplyConstrainedLegIK(PoseFrame frame, PoseDataLoader loader)
        {
            Vector3 leftTarget = DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, "left_ankle"));
            Vector3 rightTarget = DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, "right_ankle"));

            ApplyFootLock(ref leftTarget, addressLeftFootWorld);
            ApplyFootLock(ref rightTarget, addressRightFootWorld);

            Vector3 leftHint = ResolveLegHint(
                leftUpperLegCache.bone,
                loader.GetLandmarkPosition(frame, "left_knee"),
                true);
            Vector3 rightHint = ResolveLegHint(
                rightUpperLegCache.bone,
                loader.GetLandmarkPosition(frame, "right_knee"),
                false);

            SolveLegFromTarget(leftUpperLegCache.bone, leftLowerLegCache.bone, leftFootCache.bone, leftTarget, leftHint);
            SolveLegFromTarget(rightUpperLegCache.bone, rightLowerLegCache.bone, rightFootCache.bone, rightTarget, rightHint);

            if (loader.GetLandmarkVisibility(frame, "left_foot_index") > 0.2f)
            {
                ApplyFootOrientation(
                    ref leftFootCache,
                    DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_ankle")),
                    DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_heel")),
                    DataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_foot_index")),
                    leftFootForwardSign);
            }

            if (loader.GetLandmarkVisibility(frame, "right_foot_index") > 0.2f)
            {
                ApplyFootOrientation(
                    ref rightFootCache,
                    DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_ankle")),
                    DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_heel")),
                    DataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_foot_index")),
                    rightFootForwardSign);
            }

            StabilizeToe(leftToeBone, leftToeRestRotation);
            StabilizeToe(rightToeBone, rightToeRestRotation);
        }

        private void ClampArmTargetInFront(ref Vector3 target, Vector3 shoulderWorld)
        {
            Vector3 bodyFront = GetAnatomicalFrontDirection();
            if (shoulderWorld == Vector3.zero || bodyFront.sqrMagnitude < 0.001f) return;

            float forward = Vector3.Dot(target - shoulderWorld, bodyFront);
            if (forward >= minArmForwardOffset) return;

            target += bodyFront * (minArmForwardOffset - forward);
            armTargetClampCount++;
        }

        private Vector3 DataJointToWorldFromAnchor(PoseFrame frame, PoseDataLoader loader,
                                                   string jointName, string anchorName, Transform anchorBone)
        {
            if (anchorBone == null)
                return DataPointToAvatarWorld(loader.GetLandmarkPosition(frame, jointName));

            Vector3 joint = DataToAvatarSpace(loader.GetLandmarkPosition(frame, jointName));
            Vector3 anchor = DataToAvatarSpace(loader.GetLandmarkPosition(frame, anchorName));
            return anchorBone.position + (joint - anchor) * sourceToAvatarScale * positionScale;
        }

        private void SolveArmFromTarget(Transform upper, Transform lower, Transform hand,
                                        Vector3 target, Vector3 hint)
        {
            if (upper == null || lower == null || hand == null) return;

            Quaternion fkUpper = upper.rotation;
            Quaternion fkLower = lower.rotation;

            TwoBoneIKSolver.Solve(upper, lower, hand, target, hint);

            if (constrainedArmIKWeight < 0.999f)
            {
                upper.rotation = Quaternion.Slerp(fkUpper, upper.rotation, constrainedArmIKWeight);
                lower.rotation = Quaternion.Slerp(fkLower, lower.rotation, constrainedArmIKWeight);
            }
        }

        private void SolveLegFromTarget(Transform upper, Transform lower, Transform foot,
                                        Vector3 target, Vector3 hint)
        {
            if (upper == null || lower == null || foot == null) return;

            Quaternion fkUpper = upper.rotation;
            Quaternion fkLower = lower.rotation;

            TwoBoneIKSolver.Solve(upper, lower, foot, target, hint);

            if (constrainedLegIKWeight < 0.999f)
            {
                upper.rotation = Quaternion.Slerp(fkUpper, upper.rotation, constrainedLegIKWeight);
                lower.rotation = Quaternion.Slerp(fkLower, lower.rotation, constrainedLegIKWeight);
            }
        }

        private void ApplyFootLock(ref Vector3 target, Vector3 addressTarget)
        {
            if (addressTarget == Vector3.zero) return;

            float phaseWeight = GetFootLockPhaseWeight();
            float lockBlend = footLockWeight * phaseWeight;
            if (lockBlend <= 0.001f) return;

            Vector3 delta = target - addressTarget;
            if (delta.magnitude > footLockRadius)
                target = addressTarget + delta.normalized * footLockRadius;

            target = Vector3.Lerp(target, addressTarget, lockBlend);
        }

        private float GetFootLockPhaseWeight()
        {
            switch (debugPhase)
            {
                case "setup":
                case "address":
                case "toe_up":
                case "mid_backswing":
                case "top":
                case "mid_downswing":
                case "impact":
                    return 1f;
                case "mid_follow_through":
                    return 0.55f;
                case "finish":
                    return 0.2f;
                default:
                    return 0.8f;
            }
        }

        private void UpdateBodyReference(Vector3 origin, Vector3 hipRight, Vector3 shoulderRight, Vector3 trunkDir, Vector3 bodyForward)
        {
            lastBodyOrigin = origin;

            if (shoulderRight.sqrMagnitude > 0.001f)
                lastShoulderRight = shoulderRight.normalized;
            else if (hipRight.sqrMagnitude > 0.001f)
                lastShoulderRight = hipRight.normalized;

            if (trunkDir.sqrMagnitude > 0.001f)
                lastTrunkDir = trunkDir.normalized;

            if (bodyForward.sqrMagnitude > 0.001f)
                lastBodyForward = StabilizeBodyForward(bodyForward.normalized);
            else
            {
                Vector3 forward = Vector3.Cross(lastShoulderRight, lastTrunkDir).normalized;
                if (forward.sqrMagnitude > 0.001f)
                    lastBodyForward = StabilizeBodyForward(forward);
            }
        }

        private Vector3 StabilizeBodyForward(Vector3 candidate)
        {
            if (candidate.sqrMagnitude < 0.001f)
                return lastBodyForward.sqrMagnitude > 0.001f ? lastBodyForward.normalized : avatarForwardReference;

            candidate.Normalize();

            Vector3 reference = lastBodyForward.sqrMagnitude > 0.001f
                ? lastBodyForward.normalized
                : avatarForwardReference.normalized;

            if (reference.sqrMagnitude > 0.001f && Vector3.Dot(candidate, reference) < 0f)
                candidate = -candidate;

            return candidate;
        }

        private Vector3 AlignRightAxisToBody(Vector3 rawRight, Vector3 bodyUp, Vector3 bodyRight)
        {
            Vector3 right = Vector3.ProjectOnPlane(rawRight, bodyUp);
            if (right.sqrMagnitude < 0.0001f)
                return bodyRight;

            right.Normalize();
            if (Vector3.Dot(right, bodyRight) < 0f)
                right = -right;
            return right;
        }

        private Vector3 GetBodyFrontDirection()
        {
            if (lastBodyForward.sqrMagnitude < 0.001f)
                return avatarForwardReference.sqrMagnitude > 0.001f ? avatarForwardReference.normalized : Vector3.forward;

            return lastBodyForward.normalized;
        }

        private Vector3 GetAnatomicalFrontDirection()
        {
            Vector3 front = GetBodyFrontDirection();
            return useBackFacingBodyFrame ? -front : front;
        }

        private Vector3 GetAnatomicalRightDirection()
        {
            Vector3 right = lastShoulderRight.sqrMagnitude > 0.001f
                ? lastShoulderRight.normalized
                : Vector3.right;
            return useBackFacingBodyFrame ? -right : right;
        }

        private Vector3 ResolvePelvisUp(Vector3 trunkDir)
        {
            Vector3 up = avatarUpReference.sqrMagnitude > 0.001f ? avatarUpReference.normalized : Vector3.up;
            if (trunkDir.sqrMagnitude < 0.001f || pelvisTrunkTiltWeight <= 0.001f)
                return up;

            return Vector3.Slerp(up, trunkDir.normalized, pelvisTrunkTiltWeight).normalized;
        }

        private Vector3 ApplyHipDepthCompensation(Vector3 hipsPosition)
        {
            if (!enableHipDepthCompensation || addressFootCenterWorld == Vector3.zero)
                return hipsPosition;

            Vector3 bodyFront = GetAnatomicalFrontDirection();
            if (bodyFront.sqrMagnitude < 0.001f)
                return hipsPosition;

            float phaseWeight = GetHipDepthCompensationPhaseWeight();
            float weight = hipDepthCompensationWeight * phaseWeight;
            if (weight <= 0.001f)
                return hipsPosition;

            float currentDepth = Vector3.Dot(hipsPosition - addressFootCenterWorld, bodyFront);
            float desiredDepth = -addressHipBackOffset;
            float correctedDepth = Mathf.Lerp(currentDepth, desiredDepth, weight);
            return hipsPosition + bodyFront * (correctedDepth - currentDepth);
        }

        private float GetHipDepthCompensationPhaseWeight()
        {
            switch (debugPhase)
            {
                case "setup":
                case "address":
                case "toe_up":
                case "mid_backswing":
                case "top":
                case "mid_downswing":
                case "impact":
                    return 1f;
                case "mid_follow_through":
                    return 0.6f;
                case "finish":
                    return 0.25f;
                default:
                    return 0.8f;
            }
        }

        private Vector3 ResolveArmHint(Transform upper, PoseFrame frame, PoseDataLoader loader, bool isLeft)
        {
            string elbowName = isLeft ? "left_elbow" : "right_elbow";
            string shoulderName = isLeft ? "left_shoulder" : "right_shoulder";
            Vector3 dataHint = DataJointToWorldFromAnchor(frame, loader, elbowName, shoulderName, upper);
            if (upper == null) return dataHint;

            Vector3 bodyFront = GetAnatomicalFrontDirection();
            Vector3 anatomicalRight = GetAnatomicalRightDirection();
            Vector3 side = isLeft ? -anatomicalRight : anatomicalRight;
            Vector3 preferredDir = (side * 1.15f + bodyFront * 1.45f + lastTrunkDir * 0.1f).normalized;
            float upperLen = upper.childCount > 0 ? Vector3.Distance(upper.position, upper.GetChild(0).position) : 0.25f;
            Vector3 preferredHint = upper.position + preferredDir * Mathf.Max(upperLen, 0.12f);

            Vector3 shoulderToHint = dataHint - upper.position;
            float behind = Vector3.Dot(shoulderToHint, -bodyFront);
            if (behind > 0f)
                dataHint += bodyFront * (behind + elbowForwardBias);

            if (forceArmsInFrontOfTorso)
            {
                ClampArmTargetInFront(ref dataHint, upper.position);
            }

            return Vector3.Lerp(preferredHint, dataHint, elbowHintDataWeight);
        }

        private Vector3 ResolveLegHint(Transform upper, Vector3 kneeData, bool isLeft)
        {
            Vector3 dataHint = DataPointToAvatarWorld(kneeData);
            if (upper == null) return dataHint;

            Vector3 bodyFront = GetAnatomicalFrontDirection();
            Vector3 anatomicalRight = GetAnatomicalRightDirection();
            Vector3 side = isLeft ? -anatomicalRight : anatomicalRight;
            Vector3 preferredDir = (bodyFront * 0.85f - lastTrunkDir * 0.25f + side * 0.12f).normalized;
            float upperLen = upper.childCount > 0 ? Vector3.Distance(upper.position, upper.GetChild(0).position) : 0.42f;
            Vector3 preferredHint = upper.position + preferredDir * Mathf.Max(upperLen, 0.18f);

            return Vector3.Lerp(preferredHint, dataHint, kneeHintDataWeight);
        }

        private void ApplyTwoHandGripTargets(ref Vector3 leftTarget, ref Vector3 rightTarget)
        {
            Vector3 axis = rightTarget - leftTarget;
            float distance = axis.magnitude;
            if (distance < 0.0001f)
            {
                axis = GetAnatomicalRightDirection();
                distance = axis.magnitude;
            }

            float phaseWeight = GetGripPhaseWeight();
            if (phaseWeight <= 0.001f) return;

            Vector3 dir = axis / distance;
            Vector3 center = (leftTarget + rightTarget) * 0.5f;
            Vector3 bodyFront = GetAnatomicalFrontDirection();
            if (bodyFront.sqrMagnitude > 0.001f)
                center += bodyFront * gripForwardOffset * phaseWeight;

            float desiredDistance = Mathf.Max(0.01f, targetHandSeparation);
            Vector3 desiredLeft = center - dir * (desiredDistance * 0.5f);
            Vector3 desiredRight = center + dir * (desiredDistance * 0.5f);
            float blend = gripTargetBlend * phaseWeight;

            leftTarget = Vector3.Lerp(leftTarget, desiredLeft, blend);
            rightTarget = Vector3.Lerp(rightTarget, desiredRight, blend);
        }

        private float GetGripPhaseWeight()
        {
            switch (debugPhase)
            {
                case "setup":
                    return 0.45f;
                case "address":
                case "toe_up":
                case "mid_backswing":
                case "top":
                case "mid_downswing":
                case "impact":
                case "mid_follow_through":
                    return 1f;
                case "finish":
                    return 0.65f;
                default:
                    return 0.8f;
            }
        }

        private void ApplyHandGripOrientation()
        {
            if (leftHandBone == null || rightHandBone == null) return;

            Vector3 gripAxis = rightHandBone.position - leftHandBone.position;
            if (gripAxis.sqrMagnitude < 0.0001f) return;
            gripAxis.Normalize();

            RollHandTowardGrip(leftHandBone, leftLowerArmCache.bone, gripAxis);
            RollHandTowardGrip(rightHandBone, rightLowerArmCache.bone, -gripAxis);
        }

        private void ApplyGolfForwardBend()
        {
            if (!preserveGolfForwardBend || spineForwardBendWeight <= 0.001f) return;
            if (lastShoulderRight.sqrMagnitude < 0.001f || lastTrunkDir.sqrMagnitude < 0.001f) return;

            float phaseWeight = GetForwardBendPhaseWeight();
            if (phaseWeight <= 0.001f) return;

            float angle = sourceAddressForwardBendDeg * spineForwardBendWeight * phaseWeight;
            if (angle <= 0.01f) return;

            Vector3 axis = GetAnatomicalRightDirection();
            Quaternion bend = Quaternion.AngleAxis(angle, axis);
            Vector3 bodyFront = GetAnatomicalFrontDirection();
            Vector3 bentDir = bend * lastTrunkDir;
            if (Vector3.Dot(bentDir, bodyFront) < Vector3.Dot(lastTrunkDir, bodyFront))
                bend = Quaternion.AngleAxis(-angle, axis);

            for (int i = 0; i < spineChain.Length; i++)
            {
                if (spineChain[i].bone == null) continue;
                float weight = Mathf.Lerp(0.35f, 1f, spineWeights[i]);
                spineChain[i].bone.rotation = Quaternion.Slerp(
                    spineChain[i].bone.rotation,
                    bend * spineChain[i].bone.rotation,
                    weight);
            }
        }

        private float GetForwardBendPhaseWeight()
        {
            switch (debugPhase)
            {
                case "setup":
                case "address":
                case "toe_up":
                case "mid_backswing":
                case "top":
                case "mid_downswing":
                case "impact":
                    return 1f;
                case "mid_follow_through":
                    return 0.65f;
                case "finish":
                    return 0.25f;
                default:
                    return 0.8f;
            }
        }

        private void RollHandTowardGrip(Transform hand, Transform lowerArm, Vector3 desiredRight)
        {
            if (hand == null || lowerArm == null) return;

            Vector3 forearmAxis = hand.position - lowerArm.position;
            if (forearmAxis.sqrMagnitude < 0.0001f) return;
            forearmAxis.Normalize();

            Vector3 currentRight = Vector3.ProjectOnPlane(hand.right, forearmAxis).normalized;
            Vector3 targetRight = Vector3.ProjectOnPlane(desiredRight, forearmAxis).normalized;
            if (currentRight.sqrMagnitude < 0.001f || targetRight.sqrMagnitude < 0.001f) return;

            float roll = Vector3.SignedAngle(currentRight, targetRight, forearmAxis);
            hand.rotation = Quaternion.AngleAxis(roll * handOrientationWeight, forearmAxis) * hand.rotation;
        }

        private void HandleFinishPhase(PoseFrame frame, PoseDataLoader loader, string phase)
        {
            if ((phase == "impact" || phase == "mid_follow_through") && !finishPoseCaptured)
                CaptureFinishPose();

            if (phase == "finish" && finishPoseCaptured)
            {
                finishBlendTimer += Time.deltaTime;

                // visibility 기반 가중치 (가시성이 낮으면 캡처 포즈 유지)
                float visWeight  = ComputeFinishBlendWeight(frame, loader);
                // 시간 기반 가중치 (finish 진입 후 finishHoldTime초 동안 점진적 증가)
                float timeWeight = Mathf.SmoothStep(0f, 1f, finishBlendTimer / finishHoldTime);
                float blendWeight = Mathf.Max(visWeight, timeWeight);

                debugFinishBlend = blendWeight;
                if (blendWeight > 0.01f)
                    ApplyFinishBlend(blendWeight);
            }
            else
            {
                finishBlendTimer = 0f;
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
            finishBlendTimer = 0f;
            hasStableHeadForward = false;
            Debug.Log("[BoneMapper] Post-process state reset");
        }

        // ─── Phase 7A/B: 팔 보호 ────────────────────────────────────────────────

        /// <summary>
        /// A) 팔꿈치 각도 클램핑 (과신전 방지)
        /// B) 저가시성 구간에서 이전 프레임 포즈로 Slerp 고정
        /// </summary>
        private void ApplyArmProtection(PoseFrame frame, PoseDataLoader loader)
        {
            // A. 팔꿈치 과신전 클램핑
            ClampElbowAngle(leftUpperArmCache,  leftLowerArmCache);
            ClampElbowAngle(rightUpperArmCache, rightLowerArmCache);

            // B. Visibility 기반 포즈 고정 (이전 프레임 필요)
            if (!hasPreviousFrame) return;

            float lElbowVis = loader.GetLandmarkVisibility(frame, "left_elbow");
            float lWristVis = loader.GetLandmarkVisibility(frame, "left_wrist");
            float rElbowVis = loader.GetLandmarkVisibility(frame, "right_elbow");
            float rWristVis = loader.GetLandmarkVisibility(frame, "right_wrist");

            float leftArmVis  = Mathf.Min(lElbowVis, lWristVis);
            float rightArmVis = Mathf.Min(rElbowVis, rWristVis);

            if (leftArmVis < armFreezeVisThreshold && boneIdxLUA >= 0)
            {
                float blend = Mathf.InverseLerp(armFreezeVisThreshold, 0.05f, leftArmVis);
                leftUpperArmCache.bone.rotation = Quaternion.Slerp(
                    leftUpperArmCache.bone.rotation, prevRotations[boneIdxLUA], blend);
                if (boneIdxLLA >= 0)
                    leftLowerArmCache.bone.rotation = Quaternion.Slerp(
                        leftLowerArmCache.bone.rotation, prevRotations[boneIdxLLA], blend);
            }

            if (rightArmVis < armFreezeVisThreshold && boneIdxRUA >= 0)
            {
                float blend = Mathf.InverseLerp(armFreezeVisThreshold, 0.05f, rightArmVis);
                rightUpperArmCache.bone.rotation = Quaternion.Slerp(
                    rightUpperArmCache.bone.rotation, prevRotations[boneIdxRUA], blend);
                if (boneIdxRLA >= 0)
                    rightLowerArmCache.bone.rotation = Quaternion.Slerp(
                        rightLowerArmCache.bone.rotation, prevRotations[boneIdxRLA], blend);
            }
        }

        /// <summary>
        /// 상완→전완 방향 벡터 사이 각도가 maxElbowAngle을 초과하면 전완 회전을 보정한다.
        /// (angle 0° = 완전히 편 팔, angle → maxElbowAngle = 최대 굽힘)
        /// </summary>
        private void ClampElbowAngle(BoneCache upperArm, BoneCache lowerArm)
        {
            if (upperArm.bone == null || lowerArm.bone == null) return;

            Vector3 upperDir = (upperArm.bone.rotation * upperArm.restAimDir).normalized;
            Vector3 lowerDir = (lowerArm.bone.rotation * lowerArm.restAimDir).normalized;

            float angle = Vector3.Angle(upperDir, lowerDir);
            if (angle <= maxElbowAngle) return;

            float excess = angle - maxElbowAngle;
            Vector3 axis = Vector3.Cross(lowerDir, upperDir).normalized;
            if (axis.sqrMagnitude < 0.001f) return;

            Quaternion correction = Quaternion.AngleAxis(-excess, axis);
            lowerArm.bone.rotation = correction * lowerArm.bone.rotation;
        }

        // ────────────────────────────────────────────────────────────────────────

        private void ApplyAimTwist(ref BoneCache cache, Vector3 aimTarget, Vector3 rightTarget)
        {
            if (cache.bone == null) return;
            cache.bone.rotation = ResolveAimTwistRotation(cache, aimTarget, rightTarget);
        }

        private void ApplyAimTwistDelta(ref BoneCache cache, Vector3 sourceAim, Vector3 currentAim,
                                        Vector3 sourceRight, Vector3 currentRight)
        {
            if (cache.bone == null) return;

            Quaternion sourceRotation = ResolveAimTwistRotation(cache, sourceAim, sourceRight);
            Quaternion currentRotation = ResolveAimTwistRotation(cache, currentAim, currentRight);
            Quaternion delta = currentRotation * Quaternion.Inverse(sourceRotation);
            cache.bone.rotation = delta * cache.restRot;
        }

        private Quaternion ResolveAimTwistRotation(BoneCache cache, Vector3 aimTarget, Vector3 rightTarget)
        {
            if (aimTarget.sqrMagnitude < 0.001f) return cache.bone != null ? cache.bone.rotation : cache.restRot;
            aimTarget.Normalize();

            Quaternion aim = Quaternion.FromToRotation(cache.restUp, aimTarget);
            Quaternion afterAim = aim * cache.restRot;

            Vector3 aimedRight = afterAim * Vector3.right;
            Vector3 projAimed = Vector3.ProjectOnPlane(aimedRight, aimTarget).normalized;
            Vector3 projTarget = Vector3.ProjectOnPlane(rightTarget, aimTarget).normalized;

            if (projAimed.sqrMagnitude < 0.001f || projTarget.sqrMagnitude < 0.001f)
            {
                return afterAim;
            }

            float angle = Vector3.SignedAngle(projAimed, projTarget, aimTarget);
            Quaternion twist = Quaternion.AngleAxis(angle, aimTarget);
            return twist * afterAim;
        }

        private void ApplyNeckRotation(ref BoneCache cache, Vector3 dataDir, Vector3 right)
        {
            if (cache.bone == null) return;
            if (!enableHeadStabilization)
            {
                ApplyAimTwistDelta(ref cache, sourceRestNeckDir, dataDir, sourceRestShoulderRight, right);
                return;
            }

            Vector3 anatomicalRight = GetAnatomicalRightDirection();
            Quaternion stable = ResolveAimTwistDeltaRotation(cache, sourceRestTrunkDir, lastTrunkDir, sourceRestShoulderRight, anatomicalRight);
            Quaternion data = ResolveAimTwistDeltaRotation(cache, sourceRestNeckDir, dataDir, sourceRestShoulderRight, anatomicalRight);
            cache.bone.rotation = Quaternion.Slerp(stable, data, neckDataWeight);
        }

        private Vector3 ResolveHeadForward(Vector3 nose, Vector3 ears, Vector3 leftWrist, Vector3 rightWrist)
        {
            Vector3 faceForward = nose - ears;
            if (useHandsAsHeadLookTarget)
            {
                Vector3 handsCenter = (leftWrist + rightWrist) * 0.5f;
                Vector3 handLook = handsCenter - ears;
                handLook = Vector3.ProjectOnPlane(handLook, lastTrunkDir);
                if (handLook.sqrMagnitude > 0.0001f)
                    return Vector3.Slerp(GetAnatomicalFrontDirection(), handLook.normalized, 0.65f).normalized;
            }

            if (faceForward.sqrMagnitude > 0.0001f)
            {
                Vector3 projected = Vector3.ProjectOnPlane(faceForward, lastTrunkDir);
                Vector3 candidate = projected.sqrMagnitude > 0.0001f ? projected.normalized : faceForward.normalized;
                if (!enableHeadStabilization)
                    return candidate;

                Vector3 anatomicalFront = GetAnatomicalFrontDirection();
                if (anatomicalFront.sqrMagnitude > 0.001f && Vector3.Dot(candidate, anatomicalFront.normalized) < 0.15f)
                    candidate = anatomicalFront.normalized;

                if (hasStableHeadForward)
                    candidate = Vector3.Slerp(lastStableHeadForward, candidate, 0.35f).normalized;

                lastStableHeadForward = candidate;
                hasStableHeadForward = true;
                return candidate;
            }

            return GetAnatomicalFrontDirection();
        }

        private void ApplyHeadRotation(ref BoneCache cache, Vector3 dataForward, Vector3 earRight, Vector3 shoulderRight,
                                       Vector3 leftWrist, Vector3 rightWrist)
        {
            if (cache.bone == null) return;
            if (useHandsAsHeadLookTarget)
            {
                Vector3 handCenter = AvatarSpacePointToWorld((leftWrist + rightWrist) * 0.5f);
                Vector3 lookDir = handCenter - cache.bone.position;
                lookDir = Vector3.ProjectOnPlane(lookDir, lastTrunkDir);
                if (lookDir.sqrMagnitude > 0.001f)
                {
                    Vector3 anatomicalRight = GetAnatomicalRightDirection();
                    Quaternion lookStable = ResolveAimTwistRotation(cache, GetAnatomicalFrontDirection(), anatomicalRight);
                    Quaternion look = ResolveAimTwistRotation(cache, lookDir.normalized, anatomicalRight);
                    Quaternion lookClamped = ClampRotationFromReference(lookStable, look, maxHeadAngleFromTorso);
                    cache.bone.rotation = Quaternion.Slerp(lookStable, lookClamped, headDataWeight);
                    return;
                }
            }

            if (!enableHeadStabilization)
            {
                ApplyAimTwistDelta(ref cache, sourceRestHeadForward, dataForward, sourceRestEarRight, earRight);
                return;
            }

            Vector3 stableRight = GetAnatomicalRightDirection();
            Quaternion stable = ResolveAimTwistDeltaRotation(cache, sourceRestHeadForward, GetAnatomicalFrontDirection(), sourceRestEarRight, stableRight);
            Quaternion data = ResolveAimTwistDeltaRotation(cache, sourceRestHeadForward, dataForward, sourceRestEarRight, stableRight);
            Quaternion clamped = ClampRotationFromReference(stable, data, maxHeadAngleFromTorso);
            cache.bone.rotation = Quaternion.Slerp(stable, clamped, headDataWeight);
        }

        private Quaternion ResolveAimTwistDeltaRotation(BoneCache cache, Vector3 sourceAim, Vector3 currentAim,
                                                       Vector3 sourceRight, Vector3 currentRight)
        {
            Quaternion sourceRotation = ResolveAimTwistRotation(cache, sourceAim, sourceRight);
            Quaternion currentRotation = ResolveAimTwistRotation(cache, currentAim, currentRight);
            return (currentRotation * Quaternion.Inverse(sourceRotation)) * cache.restRot;
        }

        private Quaternion ClampRotationFromReference(Quaternion reference, Quaternion candidate, float maxAngle)
        {
            float angle = Quaternion.Angle(reference, candidate);
            if (angle <= maxAngle || angle < 0.001f) return candidate;
            return Quaternion.Slerp(reference, candidate, maxAngle / angle);
        }

        private void ApplyFootOrientation(ref BoneCache cache, Vector3 ankle, Vector3 heel, Vector3 toe, float forwardSign)
        {
            if (cache.bone == null) return;

            BuildFootFrame(ankle, heel, toe, forwardSign, out Vector3 forward, out Vector3 right);
            if (forward.sqrMagnitude < 0.0001f || right.sqrMagnitude < 0.0001f) return;

            bool isLeft = ReferenceEquals(cache.bone, leftFootCache.bone);
            Vector3 sourceForward = isLeft ? sourceRestLeftFootForward : sourceRestRightFootForward;
            Vector3 sourceRight = isLeft ? sourceRestLeftFootRight : sourceRestRightFootRight;
            Quaternion dataRotation = ResolveAimTwistDeltaRotation(cache, sourceForward, forward, sourceRight, right);
            if (!enableFootStabilization)
            {
                cache.bone.rotation = dataRotation;
                return;
            }

            Quaternion restRotation = isLeft ? leftFootAddressRotation : rightFootAddressRotation;
            Quaternion clamped = ClampRotationFromReference(restRotation, dataRotation, maxFootAngleFromRest);
            float phaseWeight = GetFootRotationPhaseWeight();
            cache.bone.rotation = Quaternion.Slerp(restRotation, clamped, footDataWeight * phaseWeight);
        }

        private float GetFootRotationPhaseWeight()
        {
            switch (debugPhase)
            {
                case "setup":
                case "address":
                case "toe_up":
                case "mid_backswing":
                case "top":
                case "mid_downswing":
                case "impact":
                    return 0.65f;
                case "mid_follow_through":
                    return 0.8f;
                case "finish":
                    return 1f;
                default:
                    return 0.7f;
            }
        }

        private void StabilizeToe(Transform toe, Quaternion restRotation)
        {
            if (!enableFootStabilization || toe == null) return;
            toe.rotation = Quaternion.Slerp(toe.rotation, restRotation, toeStabilizationWeight);
        }

        private void BuildFootFrame(Vector3 ankle, Vector3 heel, Vector3 toe, float forwardSign,
                                    out Vector3 forward, out Vector3 right)
        {
            forward = SafeDir((toe - heel) * forwardSign, lastBodyForward);
            Vector3 up = SafeDir(ankle - ((heel + toe) * 0.5f), lastTrunkDir);
            right = Vector3.Cross(up, forward).normalized;
            if (right.sqrMagnitude < 0.001f)
                right = lastShoulderRight;

            if (Vector3.Dot(right, lastShoulderRight) < 0f)
                right = -right;
        }

        private void ApplyLimb(ref BoneCache cache, Vector3 from, Vector3 to)
        {
            if (cache.bone == null) return;
            Vector3 dir = to - from;
            if (dir.sqrMagnitude < 0.0001f) return;
            Quaternion delta = Quaternion.FromToRotation(cache.restAimDir, dir.normalized);
            cache.bone.rotation = delta * cache.restRot;
        }

        private void ApplyLimbDelta(ref BoneCache cache, Vector3 sourceDir, Vector3 from, Vector3 to)
        {
            if (cache.bone == null) return;
            Vector3 dir = to - from;
            if (dir.sqrMagnitude < 0.0001f || sourceDir.sqrMagnitude < 0.0001f) return;
            Quaternion delta = Quaternion.FromToRotation(sourceDir.normalized, dir.normalized);
            cache.bone.rotation = delta * cache.restRot;
        }

        private void OnGUI()
        {
            if (!showDebugInfo || !isInitialized) return;
            GUILayout.BeginArea(new Rect(10, 130, 420, 140));
            GUILayout.Label($"[BoneMapper] Phase: {debugPhase} | Spine: {spineChain.Length}");
            GUILayout.Label($"  Smoothing: {(enableSmoothing ? $"ON (resp: {currentResponsiveness:F2})" : "OFF")}");
            GUILayout.Label($"  Finish Blend: {(enableFinishBlend ? $"{debugFinishBlend:F2} (t={finishBlendTimer:F2}s)" : "OFF")} | Captured: {finishPoseCaptured}");
            GUILayout.Label($"  Arm Protect: {(enableArmProtection ? $"ON (freeze<{armFreezeVisThreshold:F2}, maxElbow={maxElbowAngle:F0}°)" : "OFF")}");
            GUILayout.EndArea();
        }
    }
}
