using GolfSimulation.Data;
using UnityEngine;

namespace GolfSimulation.IK
{
    public class IKController : MonoBehaviour
    {
        [Header("Visibility Thresholds")]
        [SerializeField] private float highThreshold = 0.7f;
        [SerializeField] private float lowThreshold = 0.3f;

        private Transform leftUpperArm, leftLowerArm, leftHand;
        private Transform rightUpperArm, rightLowerArm, rightHand;
        private Transform leftUpperLeg, leftLowerLeg, leftFoot;
        private Transform rightUpperLeg, rightLowerLeg, rightFoot;

        private Quaternion fkLeftUpperArm, fkLeftLowerArm;
        private Quaternion fkRightUpperArm, fkRightLowerArm;
        private Quaternion fkLeftUpperLeg, fkLeftLowerLeg;
        private Quaternion fkRightUpperLeg, fkRightLowerLeg;

        private bool isInitialized;

        private float lastLeftArmVis, lastRightArmVis;
        private float lastLeftLegVis, lastRightLegVis;
        private float lastLeftArmWeight, lastRightArmWeight;
        private float lastLeftLegWeight, lastRightLegWeight;

        public bool SkipArms { get; set; }

        public void Initialize(Animator animator)
        {
            leftUpperArm = animator.GetBoneTransform(HumanBodyBones.LeftUpperArm);
            leftLowerArm = animator.GetBoneTransform(HumanBodyBones.LeftLowerArm);
            leftHand = animator.GetBoneTransform(HumanBodyBones.LeftHand);

            rightUpperArm = animator.GetBoneTransform(HumanBodyBones.RightUpperArm);
            rightLowerArm = animator.GetBoneTransform(HumanBodyBones.RightLowerArm);
            rightHand = animator.GetBoneTransform(HumanBodyBones.RightHand);

            leftUpperLeg = animator.GetBoneTransform(HumanBodyBones.LeftUpperLeg);
            leftLowerLeg = animator.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
            leftFoot = animator.GetBoneTransform(HumanBodyBones.LeftFoot);

            rightUpperLeg = animator.GetBoneTransform(HumanBodyBones.RightUpperLeg);
            rightLowerLeg = animator.GetBoneTransform(HumanBodyBones.RightLowerLeg);
            rightFoot = animator.GetBoneTransform(HumanBodyBones.RightFoot);

            isInitialized = true;
            Debug.Log($"[IKController] Initialized — SkipArms support enabled");
        }

        public void Apply(PoseFrame frame, PoseDataLoader loader,
                         System.Func<Vector3, Vector3> dataToAvatarSpace,
                         float sourceToAvatarScale)
        {
            if (!isInitialized || frame == null) return;

            if (!SkipArms)
            {
                float leftWristVis = loader.GetLandmarkVisibility(frame, "left_wrist");
                float leftElbowVis = loader.GetLandmarkVisibility(frame, "left_elbow");
                float leftArmVis = Mathf.Min(leftWristVis, leftElbowVis);
                lastLeftArmVis = leftArmVis;

                float leftArmIKWeight = ComputeIKWeight(leftArmVis);
                lastLeftArmWeight = leftArmIKWeight;

                if (leftArmIKWeight > 0.001f)
                {
                    BackupFK(leftUpperArm, leftLowerArm, out fkLeftUpperArm, out fkLeftLowerArm);

                    Vector3 target = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_wrist"));
                    Vector3 hint = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_elbow"));
                    SolveAndBlend(leftUpperArm, leftLowerArm, leftHand,
                                  target, hint, sourceToAvatarScale,
                                  fkLeftUpperArm, fkLeftLowerArm, leftArmIKWeight);
                }

                float rightWristVis = loader.GetLandmarkVisibility(frame, "right_wrist");
                float rightElbowVis = loader.GetLandmarkVisibility(frame, "right_elbow");
                float rightArmVis = Mathf.Min(rightWristVis, rightElbowVis);
                lastRightArmVis = rightArmVis;

                float rightArmIKWeight = ComputeIKWeight(rightArmVis);
                lastRightArmWeight = rightArmIKWeight;

                if (rightArmIKWeight > 0.001f)
                {
                    BackupFK(rightUpperArm, rightLowerArm, out fkRightUpperArm, out fkRightLowerArm);

                    Vector3 target = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_wrist"));
                    Vector3 hint = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_elbow"));
                    SolveAndBlend(rightUpperArm, rightLowerArm, rightHand,
                                  target, hint, sourceToAvatarScale,
                                  fkRightUpperArm, fkRightLowerArm, rightArmIKWeight);
                }
            }
            else
            {
                lastLeftArmVis = 0f;
                lastLeftArmWeight = 0f;
                lastRightArmVis = 0f;
                lastRightArmWeight = 0f;
            }

            float leftAnkleVis = loader.GetLandmarkVisibility(frame, "left_ankle");
            float leftKneeVis = loader.GetLandmarkVisibility(frame, "left_knee");
            float leftLegVis = Mathf.Min(leftAnkleVis, leftKneeVis);
            lastLeftLegVis = leftLegVis;

            float leftLegIKWeight = ComputeIKWeight(leftLegVis);
            lastLeftLegWeight = leftLegIKWeight;

            if (leftLegIKWeight > 0.001f)
            {
                BackupFK(leftUpperLeg, leftLowerLeg, out fkLeftUpperLeg, out fkLeftLowerLeg);

                Vector3 target = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_ankle"));
                Vector3 hint = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "left_knee"));
                SolveAndBlend(leftUpperLeg, leftLowerLeg, leftFoot,
                              target, hint, sourceToAvatarScale,
                              fkLeftUpperLeg, fkLeftLowerLeg, leftLegIKWeight);
            }

            float rightAnkleVis = loader.GetLandmarkVisibility(frame, "right_ankle");
            float rightKneeVis = loader.GetLandmarkVisibility(frame, "right_knee");
            float rightLegVis = Mathf.Min(rightAnkleVis, rightKneeVis);
            lastRightLegVis = rightLegVis;

            float rightLegIKWeight = ComputeIKWeight(rightLegVis);
            lastRightLegWeight = rightLegIKWeight;

            if (rightLegIKWeight > 0.001f)
            {
                BackupFK(rightUpperLeg, rightLowerLeg, out fkRightUpperLeg, out fkRightLowerLeg);

                Vector3 target = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_ankle"));
                Vector3 hint = dataToAvatarSpace(loader.GetLandmarkPosition(frame, "right_knee"));
                SolveAndBlend(rightUpperLeg, rightLowerLeg, rightFoot,
                              target, hint, sourceToAvatarScale,
                              fkRightUpperLeg, fkRightLowerLeg, rightLegIKWeight);
            }
        }

        private float ComputeIKWeight(float visibility)
        {
            if (visibility >= highThreshold) return 0f;
            if (visibility <= lowThreshold) return 1f;
            return 1f - (visibility - lowThreshold) / (highThreshold - lowThreshold);
        }

        private void BackupFK(Transform upper, Transform lower,
                              out Quaternion fkUpper, out Quaternion fkLower)
        {
            fkUpper = upper != null ? upper.rotation : Quaternion.identity;
            fkLower = lower != null ? lower.rotation : Quaternion.identity;
        }

        private void SolveAndBlend(Transform upper, Transform mid, Transform tip,
                                   Vector3 targetLocal, Vector3 hintLocal,
                                   float scale,
                                   Quaternion fkUpper, Quaternion fkMid,
                                   float ikWeight)
        {
            if (upper == null || mid == null || tip == null) return;

            Vector3 worldTarget = upper.root.position + targetLocal * scale;
            Vector3 worldHint = upper.root.position + hintLocal * scale;

            TwoBoneIKSolver.Solve(upper, mid, tip, worldTarget, worldHint);

            if (ikWeight < 0.999f)
            {
                upper.rotation = Quaternion.Slerp(fkUpper, upper.rotation, ikWeight);
                mid.rotation = Quaternion.Slerp(fkMid, mid.rotation, ikWeight);
            }
        }

        private void OnGUI()
        {
            if (!isInitialized) return;

            GUILayout.BeginArea(new Rect(10, 260, 350, 200));
            if (SkipArms)
            {
                GUILayout.Label("[IK] Arms: SKIP (Grip Coupling active)");
            }
            else
            {
                GUILayout.Label($"[IK] Left Arm — vis: {lastLeftArmVis:F2}, weight: {lastLeftArmWeight:F2}");
                GUILayout.Label($"[IK] Right Arm — vis: {lastRightArmVis:F2}, weight: {lastRightArmWeight:F2}");
            }
            GUILayout.Label($"[IK] Left Leg — vis: {lastLeftLegVis:F2}, weight: {lastLeftLegWeight:F2}");
            GUILayout.Label($"[IK] Right Leg — vis: {lastRightLegVis:F2}, weight: {lastRightLegWeight:F2}");
            GUILayout.EndArea();
        }
    }
}
