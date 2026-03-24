using System.Collections.Generic;
using GolfSimulation.Correction;
using GolfSimulation.Data;
using GolfSimulation.Filter;
using UnityEngine;

namespace GolfSimulation.Core
{
    public class SwingPlayer : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private PoseDataLoader dataLoader;
        [SerializeField] private BoneMapper boneMapper;
        [SerializeField] private Animator targetAnimator;

        [Header("Playback")]
        [SerializeField] private bool autoPlay = true;
        [SerializeField] private bool loop = true;
        [SerializeField][Range(0.1f, 3f)] private float playbackSpeed = 1f;

        [Header("Interpolation")]
        [SerializeField] private bool enableInterpolation = true;

        [Header("One Euro Filter")]
        [SerializeField] private bool enableFilter = true;
        [SerializeField][Range(0.01f, 10f)] private float filterMinCutoff = 1.0f;
        [SerializeField][Range(0f, 1f)] private float filterBeta = 0.007f;
        [SerializeField][Range(0.1f, 5f)] private float filterDCutoff = 1.0f;

        [Header("Pose Correction")]
        [SerializeField] private bool enablePoseCorrection = true;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        private float playbackTime;
        private int currentFrameIndex;
        private bool isPlaying;
        private float frameDuration;
        private string currentPhase = "";

        private PoseFilter poseFilter;
        private PoseFrame interpolatedFrame;

        public int CurrentFrameIndex => currentFrameIndex;
        public int TotalFrames => dataLoader != null && dataLoader.IsLoaded ? dataLoader.Sequence.total_frames : 0;
        public bool IsPlaying => isPlaying;
        public string CurrentPhase => currentPhase;
        public bool EnableInterpolation { get => enableInterpolation; set => enableInterpolation = value; }
        public bool EnableFilter { get => enableFilter; set => enableFilter = value; }
        public float FilterMinCutoff { get => filterMinCutoff; set => filterMinCutoff = value; }
        public float FilterBeta { get => filterBeta; set => filterBeta = value; }
        public float FilterDCutoff { get => filterDCutoff; set => filterDCutoff = value; }

        private void Start()
        {
            if (targetAnimator == null)
                targetAnimator = GetComponentInChildren<Animator>();

            if (dataLoader == null)
                dataLoader = GetComponent<PoseDataLoader>();

            if (boneMapper == null)
                boneMapper = GetComponent<BoneMapper>();

            if (!ValidateReferences()) return;

            if (enablePoseCorrection)
            {
                PoseCorrector corrector = GetComponent<PoseCorrector>();
                if (corrector != null)
                    corrector.PreprocessSequence(dataLoader.Sequence);
                else
                    Debug.LogWarning("[SwingPlayer] PoseCorrector 컴포넌트를 찾을 수 없습니다. 보정 없이 진행합니다.");
            }

            PoseFrame referenceFrame = dataLoader.GetAddressFrame();
            if (referenceFrame == null)
                referenceFrame = dataLoader.GetFrame(0);

            boneMapper.Initialize(targetAnimator, referenceFrame, dataLoader);

            frameDuration = 1f / dataLoader.Sequence.fps;

            poseFilter = new PoseFilter(
                dataLoader.Sequence.keypoint_names,
                filterMinCutoff, filterBeta, filterDCutoff);

            if (autoPlay)
                Play();

            Debug.Log($"[SwingPlayer] Initialized — {TotalFrames} frames, {dataLoader.Sequence.fps}fps, interp: {enableInterpolation}, filter: {enableFilter}, addressFrame: {dataLoader.AddressFrameIndex}");
        }

        private bool ValidateReferences()
        {
            if (dataLoader == null || !dataLoader.IsLoaded)
            {
                Debug.LogError("[SwingPlayer] PoseDataLoader missing or not loaded");
                return false;
            }
            if (targetAnimator == null)
            {
                Debug.LogError("[SwingPlayer] Animator not found");
                return false;
            }
            if (boneMapper == null)
            {
                Debug.LogError("[SwingPlayer] BoneMapper not found");
                return false;
            }
            return true;
        }

        private void LateUpdate()
        {
            if (!isPlaying || !dataLoader.IsLoaded) return;

            playbackTime += Time.deltaTime * playbackSpeed;

            float framePos = playbackTime / frameDuration;
            int frameA = Mathf.FloorToInt(framePos);

            if (frameA >= TotalFrames - 1)
            {
                if (loop)
                {
                    playbackTime = 0f;
                    frameA = 0;
                    if (poseFilter != null) poseFilter.Reset();
                    boneMapper.ResetPostProcessState();
                    Debug.Log("[SwingPlayer] Loop restart");
                }
                else
                {
                    frameA = TotalFrames - 1;
                    isPlaying = false;
                    Debug.Log("[SwingPlayer] Playback complete");
                    return;
                }
            }

            currentFrameIndex = frameA;
            currentPhase = dataLoader.GetCurrentSwingPhase(currentFrameIndex);

            PoseFrame frame;

            if (enableInterpolation && frameA < TotalFrames - 1)
            {
                float t = framePos - frameA;
                frame = InterpolateFrames(
                    dataLoader.GetFrame(frameA),
                    dataLoader.GetFrame(frameA + 1),
                    t);
            }
            else
            {
                frame = dataLoader.GetFrame(frameA);
            }

            if (enableFilter && poseFilter != null)
            {
                poseFilter.UpdateParams(filterMinCutoff, filterBeta, filterDCutoff);
                frame = poseFilter.Apply(frame, playbackTime);
            }

            if (frame != null && frame.has_pose)
            {
                boneMapper.ApplyPose(frame, dataLoader, currentPhase);
            }
        }

        private PoseFrame InterpolateFrames(PoseFrame a, PoseFrame b, float t)
        {
            if (a == null) return b;
            if (b == null) return a;

            int count = a.landmarks.Count;

            if (interpolatedFrame == null || interpolatedFrame.landmarks == null ||
                interpolatedFrame.landmarks.Count != count)
            {
                interpolatedFrame = new PoseFrame();
                interpolatedFrame.landmarks = new List<Landmark>(count);
                for (int i = 0; i < count; i++)
                    interpolatedFrame.landmarks.Add(new Landmark());
            }

            interpolatedFrame.frame = a.frame;
            interpolatedFrame.has_pose = a.has_pose && b.has_pose;
            interpolatedFrame.timestamp = Mathf.Lerp(a.timestamp, b.timestamp, t);

            for (int i = 0; i < count && i < b.landmarks.Count; i++)
            {
                var la = a.landmarks[i];
                var lb = b.landmarks[i];
                var lr = interpolatedFrame.landmarks[i];

                lr.name = la.name;
                lr.x = Mathf.Lerp(la.x, lb.x, t);
                lr.y = Mathf.Lerp(la.y, lb.y, t);
                lr.z = Mathf.Lerp(la.z, lb.z, t);
                lr.visibility = Mathf.Lerp(la.visibility, lb.visibility, t);
            }

            return interpolatedFrame;
        }

        public void Play()
        {
            isPlaying = true;
            Debug.Log("[SwingPlayer] Play");
        }

        public void Pause()
        {
            isPlaying = false;
            Debug.Log("[SwingPlayer] Pause");
        }

        public void Stop()
        {
            isPlaying = false;
            playbackTime = 0f;
            currentFrameIndex = 0;
            currentPhase = "";
            if (poseFilter != null) poseFilter.Reset();
            boneMapper.ResetPostProcessState();
            Debug.Log("[SwingPlayer] Stop");
        }

        public void SetFrame(int frameIndex)
        {
            if (frameIndex < 0 || frameIndex >= TotalFrames) return;

            currentFrameIndex = frameIndex;
            playbackTime = frameIndex * frameDuration;
            currentPhase = dataLoader.GetCurrentSwingPhase(currentFrameIndex);

            PoseFrame frame = dataLoader.GetFrame(currentFrameIndex);
            if (frame != null && frame.has_pose)
            {
                boneMapper.ApplyPose(frame, dataLoader, currentPhase);
            }
        }

        private void OnGUI()
        {
            if (!showDebugInfo || !dataLoader.IsLoaded) return;

            GUILayout.BeginArea(new Rect(10, 10, 300, 140));
            GUILayout.Label($"Frame: {currentFrameIndex} / {TotalFrames - 1}");
            GUILayout.Label($"Time: {playbackTime:F2}s / {(TotalFrames - 1) * frameDuration:F2}s");
            GUILayout.Label($"Speed: {playbackSpeed:F1}x | Interp: {(enableInterpolation ? "ON" : "OFF")} | Filter: {(enableFilter ? "ON" : "OFF")}");
            GUILayout.Label($"Phase: {currentPhase}");

            GUILayout.BeginHorizontal();
            if (GUILayout.Button(isPlaying ? "Pause" : "Play"))
            {
                if (isPlaying) Pause(); else Play();
            }
            if (GUILayout.Button("Stop")) Stop();
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }
    }
}
