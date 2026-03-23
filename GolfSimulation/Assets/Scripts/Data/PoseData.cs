using System;
using System.Collections.Generic;

namespace GolfSimulation.Data
{
    [Serializable]
    public class PoseSequence
    {
        public string video;
        public string view_type;
        public OriginalSize original_size;
        public float fps;
        public int total_frames;
        public int frames_with_pose;
        public int keypoint_count;
        public List<string> keypoint_names;
        public SwingEvents events;
        public FixesApplied fixes_applied;
        public ConversionInfo conversion;
        public List<PoseFrame> frames;
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
        public float timestamp;
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
        public SwingEvent finish;

        public SwingEvent GetEvent(string name)
        {
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
        public float timestamp;
        public bool has_pose;
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
    }
}
