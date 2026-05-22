using System.IO;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace GolfSimulation.Data
{
    public class PoseDataLoader : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private string fileName = "613_square_cleanswing.json";
        [SerializeField] private bool usePoseCache = false;
        [SerializeField] private bool searchPreprocessedFaceOn = true;
        [SerializeField] private string preprocessedView = "face_on";

        [Header("Cache")]
        [Tooltip("Optional binary pose cache. Disabled by default so StreamingAssets JSON stays authoritative.")]
        [SerializeField] private PoseDataCache poseCache;

        public PoseSequence Sequence { get; private set; }
        public bool IsLoaded { get; private set; }
        public int AddressFrameIndex { get; private set; } = -1;
        public string CurrentFileName => fileName;

        private void Awake()
        {
            LoadData();
        }

        /// <summary>Load a different pose JSON file from StreamingAssets.</summary>
        public void LoadFromFile(string newFileName)
        {
            fileName = newFileName;
            IsLoaded = false;
            Sequence = null;
            LoadData();
        }

        public bool LoadPreprocessedByIndex(int index)
        {
            List<string> files = GetAvailablePreprocessedFiles();
            if (index < 0 || index >= files.Count)
            {
                Debug.LogWarning($"[PoseDataLoader] Preprocessed index out of range: {index} / {files.Count}");
                return false;
            }

            LoadFromFile(files[index]);
            return IsLoaded;
        }

        public List<string> GetAvailablePreprocessedFiles()
        {
            List<string> results = new List<string>();
            HashSet<string> seen = new HashSet<string>();

            foreach (string directory in GetPreprocessedSearchDirectories())
            {
                if (!Directory.Exists(directory))
                    continue;

                string[] files = Directory.GetFiles(directory, "*.json");
                System.Array.Sort(files);
                foreach (string file in files)
                {
                    string name = Path.GetFileName(file);
                    if (seen.Add(name))
                        results.Add(name);
                }
            }

            return results;
        }

        public string GetAvailablePreprocessedFilesJson()
        {
            return JsonConvert.SerializeObject(GetAvailablePreprocessedFiles());
        }

        public void LoadData()
        {
            if (usePoseCache && poseCache != null && poseCache.IsValid)
            {
                Sequence = poseCache.ToSequence();
                if (Sequence != null)
                {
                    Sequence.Normalize();
                    AddressFrameIndex = Mathf.Clamp(poseCache.AddressFrameIndex, 0, Sequence.frames.Count - 1);
                    IsLoaded = true;
                    Debug.Log($"[PoseDataLoader] Loaded pose cache: {Sequence.total_frames} frames, {Sequence.fps}fps");
                    return;
                }

                Debug.LogWarning("[PoseDataLoader] Pose cache is invalid. Falling back to JSON.");
            }

            string path = ResolvePosePath(fileName);

            if (!File.Exists(path))
            {
                Debug.LogError($"[PoseDataLoader] File not found: {path}");
                return;
            }

            string json = File.ReadAllText(path);
            Sequence = JsonConvert.DeserializeObject<PoseSequence>(json);

            if (Sequence == null || Sequence.frames == null)
            {
                Debug.LogError("[PoseDataLoader] Failed to parse pose JSON.");
                return;
            }

            Sequence.Normalize();
            ResolveAddressFrame();

            IsLoaded = true;
            LogLoadSummary(path);
        }

        private string ResolvePosePath(string requestedFileName)
        {
            if (string.IsNullOrWhiteSpace(requestedFileName))
                return Path.Combine(Application.streamingAssetsPath, fileName);

            if (Path.IsPathRooted(requestedFileName))
                return requestedFileName;

            string directStreamingPath = Path.Combine(Application.streamingAssetsPath, requestedFileName);
            if (File.Exists(directStreamingPath))
                return directStreamingPath;

            string nestedStreamingPath = Path.Combine(Application.streamingAssetsPath, "preprocessed", preprocessedView, requestedFileName);
            if (File.Exists(nestedStreamingPath))
                return nestedStreamingPath;

            if (searchPreprocessedFaceOn)
            {
                string projectRootPath = Path.GetFullPath(Path.Combine(
                    Application.dataPath, "..", "..", "data", "preprocessed", preprocessedView, requestedFileName));
                if (File.Exists(projectRootPath))
                    return projectRootPath;
            }

            return directStreamingPath;
        }

        private IEnumerable<string> GetPreprocessedSearchDirectories()
        {
            yield return Path.Combine(Application.streamingAssetsPath, "preprocessed", preprocessedView);

            if (!searchPreprocessedFaceOn)
                yield break;

            yield return Path.GetFullPath(Path.Combine(
                Application.dataPath, "..", "..", "data", "preprocessed", preprocessedView));
        }

        private void ResolveAddressFrame()
        {
            if (Sequence.events != null && Sequence.events.address != null)
            {
                AddressFrameIndex = Mathf.Clamp(Sequence.events.address.frame, 0, Sequence.frames.Count - 1);
                Debug.Log($"[PoseDataLoader] Address frame from events: {AddressFrameIndex}");
                return;
            }

            if (Sequence.fixes_applied != null && Sequence.fixes_applied.anchor_frame > 0)
            {
                AddressFrameIndex = Mathf.Clamp(Sequence.fixes_applied.anchor_frame, 0, Sequence.frames.Count - 1);
                Debug.Log($"[PoseDataLoader] Address frame from fixes_applied: {AddressFrameIndex}");
                return;
            }

            AddressFrameIndex = 0;
            Debug.LogWarning("[PoseDataLoader] Address frame not found. Using frame 0.");
        }

        private void LogLoadSummary(string path)
        {
            Debug.Log("[PoseDataLoader] ========== Pose data loaded ==========");
            Debug.Log($"[PoseDataLoader] File: {path}");
            Debug.Log($"[PoseDataLoader] Video: {Sequence.video} | View: {Sequence.view_type} | {Sequence.total_frames} frames | {Sequence.fps}fps | keypoints {Sequence.keypoint_count}");
            Debug.Log($"[PoseDataLoader] Address frame: {AddressFrameIndex} | Events: {(Sequence.events != null ? "yes" : "no")}");

            if (Sequence.frames.Count <= 0) return;

            PoseFrame f0 = Sequence.frames[0];
            if (f0.landmarks == null || f0.landmarks.Count <= 0) return;

            Landmark sample = f0.landmarks[0];
            Debug.Log($"[PoseDataLoader] Frame0 sample {sample.name}: ({sample.x:F4}, {sample.y:F4}, {sample.z:F4}) vis={sample.visibility:F3}");
        }

        public PoseFrame GetFrame(int index)
        {
            if (!IsLoaded || index < 0 || index >= Sequence.frames.Count)
                return null;

            return Sequence.frames[index];
        }

        public PoseFrame GetAddressFrame()
        {
            return GetFrame(AddressFrameIndex);
        }

        public Vector3 GetLandmarkPosition(PoseFrame frame, string keypointName)
        {
            if (frame == null || frame.landmarks == null) return Vector3.zero;

            keypointName = LandmarkNameNormalizer.ToCanonical(keypointName);
            foreach (Landmark lm in frame.landmarks)
            {
                if (lm.name == keypointName)
                    return new Vector3(lm.x, lm.y, lm.z);
            }

            Debug.LogWarning($"[PoseDataLoader] Landmark not found: {keypointName}");
            return Vector3.zero;
        }

        public float GetLandmarkVisibility(PoseFrame frame, string keypointName)
        {
            if (frame == null || frame.landmarks == null) return 0f;

            keypointName = LandmarkNameNormalizer.ToCanonical(keypointName);
            foreach (Landmark lm in frame.landmarks)
            {
                if (lm.name == keypointName)
                    return lm.visibility;
            }

            return 0f;
        }

        public string GetCurrentSwingPhase(int frameIndex)
        {
            if (Sequence.events == null) return "unknown";

            string[] phases =
            {
                "finish", "mid_follow_through", "impact", "mid_downswing",
                "top", "mid_backswing", "toe_up", "address"
            };

            foreach (string phase in phases)
            {
                int phaseFrame = Sequence.events.GetFrameIndex(phase);
                if (phaseFrame >= 0 && frameIndex >= phaseFrame)
                    return phase;
            }

            return "setup";
        }
    }
}
