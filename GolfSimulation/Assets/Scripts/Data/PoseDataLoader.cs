using System.IO;
using Newtonsoft.Json;
using UnityEngine;

namespace GolfSimulation.Data
{
    public class PoseDataLoader : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private string fileName = "golf_swing_pose.json";

        public PoseSequence Sequence { get; private set; }
        public bool IsLoaded { get; private set; }
        public int AddressFrameIndex { get; private set; } = -1;

        private void Awake()
        {
            LoadData();
        }

        public void LoadData()
        {
            string path = Path.Combine(Application.streamingAssetsPath, fileName);

            if (!File.Exists(path))
            {
                Debug.LogError($"[PoseDataLoader] 파일을 찾을 수 없습니다: {path}");
                return;
            }

            string json = File.ReadAllText(path);
            Sequence = JsonConvert.DeserializeObject<PoseSequence>(json);

            if (Sequence == null || Sequence.frames == null)
            {
                Debug.LogError("[PoseDataLoader] JSON 파싱 실패");
                return;
            }

            ResolveAddressFrame();

            IsLoaded = true;
            Debug.Log($"[PoseDataLoader] ========== 데이터 로드 완료 ==========");
            Debug.Log($"[PoseDataLoader] 파일 경로: {path}");
            Debug.Log($"[PoseDataLoader] 영상: {Sequence.video} | {Sequence.total_frames}프레임 | {Sequence.fps}fps | 키포인트 {Sequence.keypoint_count}개");
            Debug.Log($"[PoseDataLoader] Address frame: {AddressFrameIndex} | Events: {(Sequence.events != null ? "있음" : "없음")}");

            if (Sequence.frames.Count > 0)
            {
                var f0 = Sequence.frames[0];
                if (f0.landmarks != null && f0.landmarks.Count > 0)
                {
                    var nose = f0.landmarks[0];
                    Debug.Log($"[PoseDataLoader] Frame0 검증 — {nose.name}: ({nose.x:F4}, {nose.y:F4}, {nose.z:F4}) vis={nose.visibility:F3}");
                }
            }

            if (Sequence.fixes_applied != null)
                Debug.Log($"[PoseDataLoader] Fixes: threshold={Sequence.fixes_applied.visibility_threshold}, 교체={Sequence.fixes_applied.total_keypoints_replaced}");
        }

        private void ResolveAddressFrame()
        {
            if (Sequence.events != null && Sequence.events.address != null)
            {
                AddressFrameIndex = Sequence.events.address.frame;
                Debug.Log($"[PoseDataLoader] Events에서 address frame 확인: {AddressFrameIndex}");
                return;
            }

            if (Sequence.fixes_applied != null && Sequence.fixes_applied.anchor_frame > 0)
            {
                AddressFrameIndex = Sequence.fixes_applied.anchor_frame;
                Debug.Log($"[PoseDataLoader] fixes_applied에서 anchor frame 확인: {AddressFrameIndex}");
                return;
            }

            AddressFrameIndex = 0;
            Debug.LogWarning("[PoseDataLoader] Address frame 정보를 찾을 수 없어 0번 프레임을 사용합니다");
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
            if (frame == null) return Vector3.zero;

            foreach (var lm in frame.landmarks)
            {
                if (lm.name == keypointName)
                    return new Vector3(lm.x, lm.y, lm.z);
            }

            Debug.LogWarning($"[PoseDataLoader] 키포인트를 찾을 수 없습니다: {keypointName}");
            return Vector3.zero;
        }

        public float GetLandmarkVisibility(PoseFrame frame, string keypointName)
        {
            if (frame == null) return 0f;

            foreach (var lm in frame.landmarks)
            {
                if (lm.name == keypointName)
                    return lm.visibility;
            }
            return 0f;
        }

        public string GetCurrentSwingPhase(int frameIndex)
        {
            if (Sequence.events == null) return "unknown";

            string[] phases = { "finish", "mid_follow_through", "impact", "mid_downswing", "top", "mid_backswing", "toe_up", "address" };

            foreach (var phase in phases)
            {
                int phaseFrame = Sequence.events.GetFrameIndex(phase);
                if (phaseFrame >= 0 && frameIndex >= phaseFrame)
                    return phase;
            }

            return "setup";
        }
    }
}
