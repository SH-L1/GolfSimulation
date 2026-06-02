using System.Collections.Generic;
using GolfSimulation.Data;

namespace GolfSimulation.Filter
{
    public class PoseFilter
    {
        private Dictionary<string, OneEuroFilter[]> filters;
        private PoseFrame cachedFrame;

        public PoseFilter(List<string> keypointNames, float minCutoff, float beta, float dCutoff)
        {
            filters = new Dictionary<string, OneEuroFilter[]>();
            foreach (var name in keypointNames)
            {
                filters[name] = new OneEuroFilter[]
                {
                    new OneEuroFilter(minCutoff, beta, dCutoff),
                    new OneEuroFilter(minCutoff, beta, dCutoff),
                    new OneEuroFilter(minCutoff, beta, dCutoff)
                };
            }
        }

        public PoseFrame Apply(PoseFrame frame, float timestamp)
        {
            if (frame == null || frame.landmarks == null) return frame;

            if (cachedFrame == null || cachedFrame.landmarks == null ||
                cachedFrame.landmarks.Count != frame.landmarks.Count)
            {
                cachedFrame = new PoseFrame();
                cachedFrame.landmarks = new List<Landmark>(frame.landmarks.Count);
                for (int i = 0; i < frame.landmarks.Count; i++)
                    cachedFrame.landmarks.Add(new Landmark());
            }

            cachedFrame.frame = frame.frame;
            cachedFrame.timestamp = frame.timestamp;
            cachedFrame.has_pose = frame.has_pose;

            for (int i = 0; i < frame.landmarks.Count; i++)
            {
                var src = frame.landmarks[i];
                var dst = cachedFrame.landmarks[i];
                dst.name = src.name;
                dst.visibility = src.visibility;

                if (filters.TryGetValue(src.name, out var f))
                {
                    dst.x = f[0].Filter(src.x, timestamp);
                    dst.y = f[1].Filter(src.y, timestamp);
                    dst.z = f[2].Filter(src.z, timestamp);
                }
                else
                {
                    dst.x = src.x;
                    dst.y = src.y;
                    dst.z = src.z;
                }
            }

            return cachedFrame;
        }

        public void UpdateParams(float minCutoff, float beta, float dCutoff)
        {
            foreach (var pair in filters)
            {
                foreach (var f in pair.Value)
                    f.UpdateParams(minCutoff, beta, dCutoff);
            }
        }

        public void Reset()
        {
            foreach (var pair in filters)
            {
                foreach (var f in pair.Value)
                    f.Reset();
            }
        }
    }
}
