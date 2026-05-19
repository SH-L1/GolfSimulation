using System.Collections.Generic;
using GolfSimulation.Data;
using UnityEngine;

namespace GolfSimulation.Correction
{
    public class PoseCorrector : MonoBehaviour
    {
        [Header("Minimal Safety")]
        [SerializeField] private bool enableJumpRejection = true;
        [SerializeField][Range(0.05f, 0.60f)] private float maxJumpPerFrame = 0.18f;
        [SerializeField][Range(0.5f, 10.0f)] private float hardClampThreshold = 1.5f;
        [SerializeField][Range(0f, 0.5f)] private float extrapolationBlend = 0.15f;

        [Header("Optional Corrections")]
        [SerializeField] private bool enableDepthClamping = false;
        [SerializeField][Range(0.05f, 0.60f)] private float maxArmBehindShoulder = 0.20f;
        [SerializeField] private bool enableSequenceArmStabilization = false;
        [SerializeField][Range(0.05f, 0.9f)] private float stableVisibilityThreshold = 0.35f;
        [SerializeField][Range(0.05f, 0.4f)] private float sequenceJumpThreshold = 0.14f;
        [SerializeField][Range(1, 40)] private int maxInterpolationGap = 18;
        [SerializeField][Range(0f, 1f)] private float smoothingBlend = 0.35f;
        [SerializeField][Range(0f, 1f)] private float zStabilizationBlend = 0.65f;

        [Header("Debug")]
        [SerializeField] private bool showStats = false;

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
                Debug.LogWarning("[PoseCorrector] Sequence is empty.");
                return;
            }

            string viewType = sequence.view_type ?? "unknown";
            List<PoseFrame> frames = sequence.frames;

            Dictionary<string, Vector3> prevPos = new Dictionary<string, Vector3>();
            Dictionary<string, Vector3> prevVel = new Dictionary<string, Vector3>();

            int hardClampCount = 0;
            int jumpCount = 0;
            int depthFixCount = 0;

            for (int i = 0; i < frames.Count; i++)
            {
                PoseFrame frame = frames[i];
                if (frame == null || frame.landmarks == null || !frame.has_pose)
                    continue;

                Dictionary<string, Landmark> lmMap = BuildLandmarkMap(frame);
                if (lmMap == null) continue;

                if (enableJumpRejection)
                    ApplyJumpRejection(lmMap, prevPos, prevVel, ref hardClampCount, ref jumpCount);

                if (enableDepthClamping && viewType == "face_on")
                {
                    string phase = GetPhaseForFrame(sequence, frame.frame);
                    ApplyDepthClamping(lmMap, phase, ref depthFixCount);
                }

                UpdateVelocityState(lmMap, prevPos, prevVel);
            }

            if (enableSequenceArmStabilization)
            {
                StabilizeArmSequence(sequence, true, ref jumpCount, ref depthFixCount);
                StabilizeArmSequence(sequence, false, ref jumpCount, ref depthFixCount);
            }

            if (showStats)
            {
                Debug.Log("[PoseCorrector] ========== Preprocess complete ==========");
                Debug.Log($"[PoseCorrector] Video: {sequence.video} | View: {viewType} | Frames: {frames.Count}");
                Debug.Log($"[PoseCorrector] Hard clamps: {hardClampCount} | Jump repairs: {jumpCount} | Depth shifts: {depthFixCount}");
            }
        }

        private void StabilizeArmSequence(PoseSequence sequence, bool leftArm, ref int repairCount, ref int depthFixCount)
        {
            string prefix = leftArm ? "left" : "right";
            string shoulderKey = prefix + "_shoulder";
            string elbowKey = prefix + "_elbow";
            string wristKey = prefix + "_wrist";
            bool isFaceOn = sequence.view_type == "face_on";

            List<PoseFrame> frames = sequence.frames;
            int n = frames.Count;
            Vector3[] shoulders = new Vector3[n];
            Vector3[] elbows = new Vector3[n];
            Vector3[] wrists = new Vector3[n];
            bool[] valid = new bool[n];

            for (int i = 0; i < n; i++)
            {
                Dictionary<string, Landmark> map = BuildLandmarkMap(frames[i]);
                if (map == null
                    || !map.TryGetValue(shoulderKey, out Landmark shoulder)
                    || !map.TryGetValue(elbowKey, out Landmark elbow)
                    || !map.TryGetValue(wristKey, out Landmark wrist))
                {
                    valid[i] = false;
                    continue;
                }

                shoulders[i] = ToVector(shoulder);
                elbows[i] = ToVector(elbow);
                wrists[i] = ToVector(wrist);

                float minVis = Mathf.Min(elbow.visibility, wrist.visibility);
                bool reliable = minVis >= stableVisibilityThreshold;

                if (i > 0)
                {
                    float jump = Mathf.Max(
                        Vector3.Distance(elbows[i], elbows[i - 1]),
                        Vector3.Distance(wrists[i], wrists[i - 1]));
                    reliable &= jump <= sequenceJumpThreshold;
                }

                if (isFaceOn)
                    reliable &= Mathf.Max(elbows[i].z, wrists[i].z) <= shoulders[i].z + maxArmBehindShoulder * 1.25f;

                valid[i] = reliable;
            }

            RepairUnreliableRuns(elbows, valid, ref repairCount);
            RepairUnreliableRuns(wrists, valid, ref repairCount);
            SmoothPositions(elbows, valid);
            SmoothPositions(wrists, valid);

            if (isFaceOn)
            {
                for (int i = 0; i < n; i++)
                {
                    float maxAllowed = shoulders[i].z + maxArmBehindShoulder;
                    float worstZ = Mathf.Max(elbows[i].z, wrists[i].z);
                    if (worstZ > maxAllowed)
                    {
                        float shift = (worstZ - maxAllowed) * zStabilizationBlend;
                        elbows[i].z -= shift;
                        wrists[i].z -= shift;
                        depthFixCount++;
                    }
                }
            }

            for (int i = 0; i < n; i++)
            {
                Dictionary<string, Landmark> map = BuildLandmarkMap(frames[i]);
                if (map == null) continue;
                if (map.TryGetValue(elbowKey, out Landmark elbow)) FromVector(elbow, elbows[i]);
                if (map.TryGetValue(wristKey, out Landmark wrist)) FromVector(wrist, wrists[i]);
            }
        }

        private Dictionary<string, Landmark> BuildLandmarkMap(PoseFrame frame)
        {
            if (frame == null || frame.landmarks == null || !frame.has_pose) return null;
            Dictionary<string, Landmark> map = new Dictionary<string, Landmark>(frame.landmarks.Count);
            foreach (Landmark lm in frame.landmarks)
                if (lm != null && lm.name != null) map[lm.name] = lm;
            return map;
        }

        private static Vector3 ToVector(Landmark lm) => new Vector3(lm.x, lm.y, lm.z);

        private static void FromVector(Landmark lm, Vector3 v)
        {
            lm.x = v.x;
            lm.y = v.y;
            lm.z = v.z;
        }

        private void RepairUnreliableRuns(Vector3[] values, bool[] valid, ref int repairCount)
        {
            int n = values.Length;
            int i = 0;
            while (i < n)
            {
                if (valid[i]) { i++; continue; }

                int start = i;
                while (i < n && !valid[i]) i++;
                int end = i - 1;
                int before = start - 1;
                int after = i < n ? i : -1;
                int gap = end - start + 1;

                if (before >= 0 && after >= 0 && gap <= maxInterpolationGap)
                {
                    for (int f = start; f <= end; f++)
                    {
                        float t = (float)(f - before) / (after - before);
                        values[f] = Vector3.Lerp(values[before], values[after], t);
                        repairCount++;
                    }
                }
                else if (before >= 0)
                {
                    for (int f = start; f <= end; f++)
                    {
                        values[f] = Vector3.Lerp(values[f], values[before], 0.65f);
                        repairCount++;
                    }
                }
                else if (after >= 0)
                {
                    for (int f = start; f <= end; f++)
                    {
                        values[f] = Vector3.Lerp(values[f], values[after], 0.65f);
                        repairCount++;
                    }
                }
            }
        }

        private void SmoothPositions(Vector3[] values, bool[] valid)
        {
            if (smoothingBlend <= 0.001f || values.Length < 5) return;
            Vector3[] copy = (Vector3[])values.Clone();
            for (int i = 2; i < values.Length - 2; i++)
            {
                Vector3 smoothed =
                    copy[i - 2] * 0.10f +
                    copy[i - 1] * 0.20f +
                    copy[i] * 0.40f +
                    copy[i + 1] * 0.20f +
                    copy[i + 2] * 0.10f;

                float blend = valid[i] ? smoothingBlend * 0.35f : smoothingBlend;
                values[i] = Vector3.Lerp(copy[i], smoothed, blend);
            }
        }

        private string GetPhaseForFrame(PoseSequence sequence, int frameNumber)
        {
            if (sequence.events == null) return "unknown";
            string[] ordered = { "finish", "mid_follow_through", "impact", "mid_downswing", "top", "mid_backswing", "toe_up", "address" };
            foreach (string phase in ordered)
            {
                int phaseFrame = sequence.events.GetFrameIndex(phase);
                if (phaseFrame >= 0 && frameNumber >= phaseFrame)
                    return phase;
            }
            return "setup";
        }

        private static bool ContainsPhase(string[] phases, string phase)
        {
            foreach (string p in phases)
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
                        FromVector(lm, safePos);
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
                        FromVector(lm, Vector3.Lerp(extrapolated, curr, extrapolationBlend));
                        jumpCount++;
                    }
                }
            }
        }

        private void ApplyDepthClamping(Dictionary<string, Landmark> lmMap, string phase, ref int depthFixCount)
        {
            bool clampLeft = !ContainsPhase(FinishPhases, phase);
            bool clampRight = !ContainsPhase(BackswingPhases, phase);

            if (clampLeft)
                ApplyArmDepthShift(lmMap, "left_shoulder", "left_elbow", "left_wrist", ref depthFixCount);

            if (clampRight)
                ApplyArmDepthShift(lmMap, "right_shoulder", "right_elbow", "right_wrist", ref depthFixCount);
        }

        private void ApplyArmDepthShift(Dictionary<string, Landmark> lmMap, string shoulderKey, string elbowKey, string wristKey, ref int count)
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

        private void UpdateVelocityState(Dictionary<string, Landmark> lmMap, Dictionary<string, Vector3> prevPos, Dictionary<string, Vector3> prevVel)
        {
            foreach (string joint in AllJoints)
            {
                if (!lmMap.TryGetValue(joint, out Landmark lm))
                    continue;

                Vector3 curr = new Vector3(lm.x, lm.y, lm.z);
                Vector3 vel = prevPos.TryGetValue(joint, out Vector3 prev) ? curr - prev : Vector3.zero;

                prevVel[joint] = vel;
                prevPos[joint] = curr;
            }
        }

        private void OnGUI()
        {
            if (!showStats) return;
            GUILayout.BeginArea(new Rect(10, 260, 420, 75));
            GUILayout.Label("[PoseCorrector] Minimal safety");
            GUILayout.Label($"  Jump rejection: {(enableJumpRejection ? $"ON (jump={maxJumpPerFrame:F2}, hard={hardClampThreshold:F1})" : "OFF")}");
            GUILayout.Label($"  Optional depth: {(enableDepthClamping ? $"ON (maxBehind={maxArmBehindShoulder:F2})" : "OFF")}");
            GUILayout.EndArea();
        }
    }
}
