using System.Collections.Generic;
using GolfSimulation.Data;
using UnityEngine;

namespace GolfSimulation.Correction
{
    public class PoseCorrector : MonoBehaviour
    {
        [Header("Priority 1 - Anti-Clipping (Face-On, Per-Limb Shift)")]
        [SerializeField] private bool enableDepthClamping = true;
        [SerializeField][Range(0.05f, 0.60f)] private float maxArmBehindShoulder = 0.20f;

        [Header("Priority 2 - Grip Proximity")]
        [SerializeField] private bool enableGripConstraint = true;
        [SerializeField][Range(0.05f, 0.50f)] private float maxWristSeparation = 0.20f;
        [SerializeField][Range(0f, 1f)] private float elbowFollowWeight = 0.35f;

        [Header("Priority 3 - Jump Rejection")]
        [SerializeField] private bool enableJumpRejection = true;
        [SerializeField][Range(0.05f, 0.60f)] private float maxJumpPerFrame = 0.18f;
        [SerializeField][Range(0.5f, 10.0f)] private float hardClampThreshold = 1.5f;
        [SerializeField][Range(0f, 0.5f)] private float extrapolationBlend = 0.15f;

        [Header("Debug")]
        [SerializeField] private bool showStats = true;

        private static readonly string[] AllJoints =
        {
            "nose", "left_eye", "right_eye", "left_ear", "right_ear",
            "left_shoulder", "right_shoulder",
            "left_elbow", "right_elbow",
            "left_wrist", "right_wrist",
            "left_hip", "right_hip",
            "left_knee", "right_knee",
            "left_ankle", "right_ankle"
        };

        private static readonly string[] BackswingPhases = { "mid_backswing", "top" };
        private static readonly string[] FinishPhases = { "mid_follow_through", "finish" };

        public void PreprocessSequence(PoseSequence sequence)
        {
            if (sequence == null || sequence.frames == null || sequence.frames.Count == 0)
            {
                Debug.LogWarning("[PoseCorrector] 시퀀스가 null이거나 프레임이 없습니다.");
                return;
            }

            string viewType = sequence.view_type ?? "unknown";
            List<PoseFrame> frames = sequence.frames;

            Dictionary<string, Vector3> prevPos = new Dictionary<string, Vector3>();
            Dictionary<string, Vector3> prevVel = new Dictionary<string, Vector3>();

            int hardClampCount = 0;
            int jumpCount = 0;
            int depthFixCount = 0;
            int gripFixCount = 0;

            for (int i = 0; i < frames.Count; i++)
            {
                PoseFrame frame = frames[i];
                if (frame == null || frame.landmarks == null || !frame.has_pose)
                    continue;

                Dictionary<string, Landmark> lmMap = new Dictionary<string, Landmark>(frame.landmarks.Count);
                foreach (Landmark lm in frame.landmarks)
                {
                    if (lm != null && lm.name != null)
                        lmMap[lm.name] = lm;
                }

                if (enableJumpRejection)
                    ApplyJumpRejection(lmMap, prevPos, prevVel, ref hardClampCount, ref jumpCount);

                if (enableDepthClamping && viewType == "face_on")
                {
                    string phase = GetPhaseForFrame(sequence, frame.frame);
                    ApplyDepthClamping(lmMap, phase, ref depthFixCount);
                }

                if (enableGripConstraint)
                    ApplyGripConstraint(lmMap, ref gripFixCount);

                UpdateVelocityState(lmMap, prevPos, prevVel);
            }

            if (showStats)
            {
                Debug.Log($"[PoseCorrector] ========== 전처리 완료 ==========");
                Debug.Log($"[PoseCorrector] 영상: {sequence.video} | 뷰: {viewType} | 총 {frames.Count} 프레임");
                Debug.Log($"[PoseCorrector] P3 하드 클램프: {hardClampCount}회 | 점프 제거: {jumpCount}회");
                Debug.Log($"[PoseCorrector] P1 깊이 보정: {depthFixCount}회 | P2 그립 제약: {gripFixCount}회");
            }
        }

        private string GetPhaseForFrame(PoseSequence sequence, int frameNumber)
        {
            if (sequence.events == null) return "unknown";
            string[] ordered = { "finish", "mid_follow_through", "impact", "mid_downswing", "top", "mid_backswing", "toe_up", "address" };
            foreach (string phase in ordered)
            {
                int pf = sequence.events.GetFrameIndex(phase);
                if (pf >= 0 && frameNumber >= pf)
                    return phase;
            }
            return "setup";
        }

        private bool IsBackswingPhase(string phase)
        {
            foreach (string p in BackswingPhases)
                if (p == phase) return true;
            return false;
        }

        private bool IsFinishPhase(string phase)
        {
            foreach (string p in FinishPhases)
                if (p == phase) return true;
            return false;
        }

        private void ApplyJumpRejection(
            Dictionary<string, Landmark> lmMap,
            Dictionary<string, Vector3> prevPos,
            Dictionary<string, Vector3> prevVel,
            ref int hardClampCount,
            ref int jumpCount)
        {
            foreach (string joint in AllJoints)
            {
                if (!lmMap.TryGetValue(joint, out Landmark lm))
                    continue;

                Vector3 curr = new Vector3(lm.x, lm.y, lm.z);

                bool isHardOutlier = Mathf.Abs(curr.x) > hardClampThreshold
                    || Mathf.Abs(curr.y) > hardClampThreshold
                    || Mathf.Abs(curr.z) > hardClampThreshold;

                if (isHardOutlier)
                {
                    if (prevPos.TryGetValue(joint, out Vector3 safePos))
                    {
                        curr = safePos;
                        lm.x = curr.x;
                        lm.y = curr.y;
                        lm.z = curr.z;
                        hardClampCount++;
                    }
                    continue;
                }

                if (prevPos.TryGetValue(joint, out Vector3 prev))
                {
                    float delta = Vector3.Distance(curr, prev);
                    if (delta > maxJumpPerFrame)
                    {
                        Vector3 vel = prevVel.TryGetValue(joint, out Vector3 v) ? v : Vector3.zero;
                        Vector3 extrapolated = prev + vel * 0.5f;
                        curr = Vector3.Lerp(extrapolated, curr, extrapolationBlend);
                        lm.x = curr.x;
                        lm.y = curr.y;
                        lm.z = curr.z;
                        jumpCount++;
                    }
                }
            }
        }

        private void ApplyDepthClamping(Dictionary<string, Landmark> lmMap, string phase, ref int depthFixCount)
        {
            bool clampLeft = !IsFinishPhase(phase);
            bool clampRight = !IsBackswingPhase(phase);

            if (clampLeft)
                ApplyArmDepthShift(lmMap, "left_shoulder", "left_elbow", "left_wrist", ref depthFixCount);

            if (clampRight)
                ApplyArmDepthShift(lmMap, "right_shoulder", "right_elbow", "right_wrist", ref depthFixCount);
        }

        private void ApplyArmDepthShift(
            Dictionary<string, Landmark> lmMap,
            string shoulderKey, string elbowKey, string wristKey,
            ref int count)
        {
            if (!lmMap.TryGetValue(shoulderKey, out Landmark shoulder)) return;
            if (!lmMap.TryGetValue(elbowKey, out Landmark elbow)) return;
            if (!lmMap.TryGetValue(wristKey, out Landmark wrist)) return;

            float maxAllowedZ = shoulder.z + maxArmBehindShoulder;
            float worstZ = Mathf.Max(elbow.z, wrist.z);

            if (worstZ <= maxAllowedZ) return;

            float shift = worstZ - maxAllowedZ;
            elbow.z -= shift;
            wrist.z -= shift;
            count++;
        }

        private void ApplyGripConstraint(Dictionary<string, Landmark> lmMap, ref int gripFixCount)
        {
            if (!lmMap.TryGetValue("left_wrist", out Landmark lw)) return;
            if (!lmMap.TryGetValue("right_wrist", out Landmark rw)) return;

            Vector3 lwPos = new Vector3(lw.x, lw.y, lw.z);
            Vector3 rwPos = new Vector3(rw.x, rw.y, rw.z);
            float sep = Vector3.Distance(lwPos, rwPos);

            if (sep <= maxWristSeparation || sep < 0.001f)
                return;

            Vector3 dir = (rwPos - lwPos) / sep;
            Vector3 correctedRW = lwPos + dir * maxWristSeparation;

            rw.x = correctedRW.x;
            rw.y = correctedRW.y;
            rw.z = correctedRW.z;

            if (elbowFollowWeight > 0.001f
                && lmMap.TryGetValue("right_elbow", out Landmark re)
                && lmMap.TryGetValue("right_shoulder", out Landmark rsh))
            {
                Vector3 shPos = new Vector3(rsh.x, rsh.y, rsh.z);
                Vector3 oldElbow = new Vector3(re.x, re.y, re.z);
                Vector3 targetElbow = shPos + (correctedRW - shPos) * 0.5f;
                Vector3 blended = Vector3.Lerp(oldElbow, targetElbow, elbowFollowWeight);
                re.x = blended.x;
                re.y = blended.y;
                re.z = blended.z;
            }

            gripFixCount++;
        }

        private void UpdateVelocityState(
            Dictionary<string, Landmark> lmMap,
            Dictionary<string, Vector3> prevPos,
            Dictionary<string, Vector3> prevVel)
        {
            foreach (string joint in AllJoints)
            {
                if (!lmMap.TryGetValue(joint, out Landmark lm))
                    continue;

                Vector3 curr = new Vector3(lm.x, lm.y, lm.z);
                Vector3 vel = prevPos.TryGetValue(joint, out Vector3 prev)
                    ? curr - prev
                    : Vector3.zero;

                prevVel[joint] = vel;
                prevPos[joint] = curr;
            }
        }

        private void OnGUI()
        {
            if (!showStats) return;
            GUILayout.BeginArea(new Rect(10, 260, 420, 90));
            GUILayout.Label("[PoseCorrector] 설정");
            GUILayout.Label($"  P1 깊이 (팔 단위 shift): {(enableDepthClamping ? $"ON (maxBehind={maxArmBehindShoulder:F2})" : "OFF")}");
            GUILayout.Label($"  P2 그립 제약: {(enableGripConstraint ? $"ON (max={maxWristSeparation:F2})" : "OFF")}");
            GUILayout.Label($"  P3 점프 제거: {(enableJumpRejection ? $"ON (jump={maxJumpPerFrame:F2}, hard={hardClampThreshold:F1})" : "OFF")}");
            GUILayout.EndArea();
        }
    }
}
