using System;
using System.Collections.Generic;
using System.Runtime.Serialization;
using Newtonsoft.Json;

namespace GolfSimulation.Data
{
    [Serializable]
    public class PoseSequence
    {
        public string video;
        public string view_type;
        public string viewtype;
        public OriginalSize original_size;
        public float fps;
        public int total_frames;
        public int totalframes;
        public int frames_with_pose;
        public int keypoint_count;
        public List<string> keypoint_names;
        public List<string> landmarknames;
        public SwingEvents events;
        public FixesApplied fixes_applied;
        public ConversionInfo conversion;
        public List<PoseFrame> frames;

        [OnDeserialized]
        private void OnDeserialized(StreamingContext context)
        {
            Normalize();
        }

        public void Normalize()
        {
            if (string.IsNullOrEmpty(view_type))
                view_type = viewtype;

            if (total_frames <= 0)
                total_frames = totalframes > 0 ? totalframes : frames?.Count ?? 0;

            if ((keypoint_names == null || keypoint_names.Count == 0) && landmarknames != null)
                keypoint_names = new List<string>(landmarknames);

            NormalizeKeypointNames();
            NormalizeFrameLandmarks();

            if (keypoint_count <= 0)
                keypoint_count = keypoint_names?.Count ?? FirstLandmarkCount();

            if (frames_with_pose <= 0 && frames != null)
                frames_with_pose = CountFramesWithPose();

            NormalizeEventsToSequenceFrames();
        }

        private void NormalizeKeypointNames()
        {
            if (keypoint_names == null) return;

            for (int i = 0; i < keypoint_names.Count; i++)
                keypoint_names[i] = LandmarkNameNormalizer.ToCanonical(keypoint_names[i]);
        }

        private void NormalizeFrameLandmarks()
        {
            if (frames == null) return;

            foreach (PoseFrame frame in frames)
            {
                if (frame?.landmarks == null) continue;

                foreach (Landmark lm in frame.landmarks)
                {
                    if (lm == null) continue;
                    lm.name = LandmarkNameNormalizer.ToCanonical(lm.name);
                }
            }
        }

        private int FirstLandmarkCount()
        {
            if (frames == null) return 0;
            foreach (PoseFrame frame in frames)
                if (frame?.landmarks != null)
                    return frame.landmarks.Count;
            return 0;
        }

        private int CountFramesWithPose()
        {
            int count = 0;
            foreach (PoseFrame frame in frames)
                if (frame != null && frame.has_pose)
                    count++;
            return count;
        }

        private void NormalizeEventsToSequenceFrames()
        {
            if (events == null || frames == null || frames.Count == 0) return;

            events.NormalizeAliases();

            int minOrig = int.MaxValue;
            int maxOrig = int.MinValue;
            bool hasOriginalFrameNumbers = false;

            foreach (PoseFrame frame in frames)
            {
                if (frame == null || frame.frame_orig < 0) continue;
                minOrig = Math.Min(minOrig, frame.frame_orig);
                maxOrig = Math.Max(maxOrig, frame.frame_orig);
                hasOriginalFrameNumbers = true;
            }

            foreach (SwingEvent swingEvent in events.All())
            {
                if (swingEvent == null) continue;

                int sourceFrame = swingEvent.original_frame >= 0
                    ? swingEvent.original_frame
                    : swingEvent.frame;

                if (swingEvent.original_frame < 0)
                    swingEvent.original_frame = sourceFrame;

                if (!hasOriginalFrameNumbers && swingEvent.frame >= 0 && swingEvent.frame < frames.Count)
                    continue;

                if (hasOriginalFrameNumbers && sourceFrame >= minOrig && sourceFrame <= maxOrig)
                {
                    swingEvent.frame = FindNearestSequenceFrameIndex(sourceFrame);
                    continue;
                }

                if (TryFindNearestTimestampFrameIndex(swingEvent.timestamp, out int timestampFrame))
                {
                    swingEvent.frame = timestampFrame;
                    continue;
                }

                swingEvent.frame = ClampFrameIndex(swingEvent.frame);
            }
        }

        private int FindNearestSequenceFrameIndex(int originalFrame)
        {
            int bestIndex = 0;
            int bestDistance = int.MaxValue;

            for (int i = 0; i < frames.Count; i++)
            {
                PoseFrame frame = frames[i];
                if (frame == null || frame.frame_orig < 0) continue;

                int distance = Math.Abs(frame.frame_orig - originalFrame);
                if (distance >= bestDistance) continue;

                bestDistance = distance;
                bestIndex = i;
            }

            return bestIndex;
        }

        private bool TryFindNearestTimestampFrameIndex(float timestamp, out int frameIndex)
        {
            frameIndex = 0;
            if (frames == null || frames.Count == 0 || timestamp <= 0f) return false;

            int bestIndex = 0;
            double bestDistance = double.MaxValue;
            bool found = false;

            for (int i = 0; i < frames.Count; i++)
            {
                PoseFrame frame = frames[i];
                if (frame == null || frame.timestamp <= 0f) continue;

                double distance = Math.Abs(frame.timestamp - timestamp);
                if (distance >= bestDistance) continue;

                bestDistance = distance;
                bestIndex = i;
                found = true;
            }

            if (!found) return false;
            frameIndex = bestIndex;
            return true;
        }

        private int ClampFrameIndex(int frameIndex)
        {
            if (frames == null || frames.Count == 0) return 0;
            return Math.Max(0, Math.Min(frameIndex, frames.Count - 1));
        }
    }

    [Serializable]
    public class OriginalSize
    {
        public int width;
        public int height;
    }

    [Serializable]
    public class SwingEvent
    {
        public int frame;
        [JsonIgnore] public int original_frame = -1;
        public float timestamp;
        public float confidence;
        public string method;
    }

    [Serializable]
    public class SwingEvents
    {
        public SwingEvent address;
        public SwingEvent toe_up;
        public SwingEvent mid_backswing;
        public SwingEvent top;
        public SwingEvent mid_downswing;
        public SwingEvent impact;
        public SwingEvent mid_follow_through;
        public SwingEvent mid_followthrough;
        public SwingEvent finish;

        public void NormalizeAliases()
        {
            if (mid_follow_through == null)
                mid_follow_through = mid_followthrough;
        }

        public IEnumerable<SwingEvent> All()
        {
            yield return address;
            yield return toe_up;
            yield return mid_backswing;
            yield return top;
            yield return mid_downswing;
            yield return impact;
            yield return mid_follow_through;
            yield return finish;
        }

        public SwingEvent GetEvent(string name)
        {
            NormalizeAliases();
            switch (name)
            {
                case "address": return address;
                case "toe_up": return toe_up;
                case "mid_backswing": return mid_backswing;
                case "top": return top;
                case "mid_downswing": return mid_downswing;
                case "impact": return impact;
                case "mid_follow_through": return mid_follow_through;
                case "finish": return finish;
                default: return null;
            }
        }

        public int GetFrameIndex(string name)
        {
            var e = GetEvent(name);
            return e != null ? e.frame : -1;
        }
    }

    [Serializable]
    public class AnchorValue
    {
        public float x;
        public float y;
    }

    [Serializable]
    public class FixesApplied
    {
        public string anchor;
        public int anchor_frame;
        public AnchorValue anchor_value;
        public float visibility_threshold;
        public int total_keypoints_replaced;
    }

    [Serializable]
    public class ConversionInfo
    {
        public string step1;
        public string step2;
        public string step3;
        public string step4;
    }

    [Serializable]
    public class PoseFrame
    {
        public int frame;
        public int frame_orig = -1;
        public float timestamp;
        public bool has_pose;
        public int observed_count;
        public int predicted_count;
        public int corrected_count;
        public List<Landmark> landmarks;
    }

    [Serializable]
    public class Landmark
    {
        public string name;
        public float x;
        public float y;
        public float z;
        public float visibility;
        public string source;
        public List<string> flags;
        public int observed_mask;
        public int predicted_mask;
        public int corrected_mask;
    }

    public static class LandmarkNameNormalizer
    {
        private static readonly Dictionary<string, string> CanonicalNames = new Dictionary<string, string>
        {
            { "lefteye", "left_eye" },
            { "righteye", "right_eye" },
            { "leftear", "left_ear" },
            { "rightear", "right_ear" },
            { "leftshoulder", "left_shoulder" },
            { "rightshoulder", "right_shoulder" },
            { "leftelbow", "left_elbow" },
            { "rightelbow", "right_elbow" },
            { "leftwrist", "left_wrist" },
            { "rightwrist", "right_wrist" },
            { "lefthip", "left_hip" },
            { "righthip", "right_hip" },
            { "leftknee", "left_knee" },
            { "rightknee", "right_knee" },
            { "leftankle", "left_ankle" },
            { "rightankle", "right_ankle" },
            { "leftheel", "left_heel" },
            { "rightheel", "right_heel" },
            { "leftfootindex", "left_foot_index" },
            { "rightfootindex", "right_foot_index" },
            { "hipcenter", "hip_center" },
            { "lefteyeinner", "left_eye_inner" },
            { "lefteyeouter", "left_eye_outer" },
            { "righteyeinner", "right_eye_inner" },
            { "righteyeouter", "right_eye_outer" },
            { "mouthleft", "mouth_left" },
            { "mouthright", "mouth_right" }
        };

        public static string ToCanonical(string name)
        {
            if (string.IsNullOrEmpty(name)) return name;

            string compact = name.Trim().ToLowerInvariant().Replace("_", "");
            return CanonicalNames.TryGetValue(compact, out string canonical)
                ? canonical
                : name.Trim();
        }
    }
}
