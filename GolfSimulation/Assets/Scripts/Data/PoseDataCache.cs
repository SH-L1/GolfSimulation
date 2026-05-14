using System.IO;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace GolfSimulation.Data
{
    /// <summary>
    /// JSON 포즈 데이터를 Unity ScriptableObject 바이너리로 변환·캐시한다.
    ///
    /// [사용 이유]
    ///   - JSON 파싱(Newtonsoft): 초기 로딩 시 ~30~80ms 소요 (모바일에서 더 큼)
    ///   - ScriptableObject 바이너리: ~2~5ms (에셋 번들 / addressable 경유)
    ///
    /// [사용 흐름]
    ///   Editor: PoseDataCache.CreateFromJson() → Assets/Resources/PoseCache.asset 생성
    ///   Runtime: PoseDataLoader에서 캐시 우선 로딩, 없으면 JSON 파싱 후 메모리 캐시 저장
    ///
    /// [주의]
    ///   JSON이 변경될 때마다 에디터에서 캐시를 재생성해야 합니다.
    ///   Window → Golf Simulation → Rebuild Pose Cache 메뉴 사용.
    /// </summary>
    [CreateAssetMenu(fileName = "PoseCache", menuName = "GolfSimulation/Pose Data Cache")]
    public class PoseDataCache : ScriptableObject
    {
        // Unity SerializeField로 직렬화: 에디터 직렬화 → 바이너리 에셋으로 저장
        [SerializeField] private string videoName;
        [SerializeField] private string viewType;
        [SerializeField] private float fps;
        [SerializeField] private int totalFrames;
        [SerializeField] private string[] keypointNames;

        // SwingEvents — 8개 프레임 인덱스만 저장 (경량)
        [SerializeField] private int[] eventFrames;   // 8개 순서: address~finish
        [SerializeField] private float[] eventTimes;  // 대응 타임스탬프

        // 프레임 데이터 — SoA(Structure of Arrays) 방식으로 저장
        // 각 배열 크기 = totalFrames × keypointCount
        [SerializeField] private bool[] haspose;     // [frame]
        [SerializeField] private float[] xs;          // [frame * kpCount + kpIdx]
        [SerializeField] private float[] ys;
        [SerializeField] private float[] zs;
        [SerializeField] private float[] viss;        // visibility

        [SerializeField] private int addressFrameIndex;

        public bool IsValid => keypointNames != null && keypointNames.Length > 0
                               && xs != null && xs.Length > 0;

        // ──────────────────────────────────────────────────────────────────────
        // 런타임 읽기 API

        public PoseSequence ToSequence()
        {
            if (!IsValid) return null;

            int kpCount = keypointNames.Length;
            var seq = new PoseSequence
            {
                video        = videoName,
                view_type    = viewType,
                fps          = fps,
                total_frames = totalFrames,
                keypoint_names = new System.Collections.Generic.List<string>(keypointNames),
                keypoint_count = kpCount,
                events       = BuildEvents(),
                frames       = new System.Collections.Generic.List<PoseFrame>(totalFrames)
            };

            for (int f = 0; f < totalFrames; f++)
            {
                var frame = new PoseFrame
                {
                    frame     = f,
                    timestamp = f / fps,
                    has_pose  = haspose[f],
                    landmarks = new System.Collections.Generic.List<Landmark>(kpCount)
                };

                int baseIdx = f * kpCount;
                for (int k = 0; k < kpCount; k++)
                {
                    frame.landmarks.Add(new Landmark
                    {
                        name       = keypointNames[k],
                        x          = xs[baseIdx + k],
                        y          = ys[baseIdx + k],
                        z          = zs[baseIdx + k],
                        visibility = viss[baseIdx + k],
                    });
                }
                seq.frames.Add(frame);
            }

            return seq;
        }

        private SwingEvents BuildEvents()
        {
            if (eventFrames == null || eventFrames.Length < 8) return null;
            string[] names = { "address","toe_up","mid_backswing","top",
                               "mid_downswing","impact","mid_follow_through","finish" };
            var ev = new SwingEvents();
            for (int i = 0; i < 8; i++)
            {
                var se = new SwingEvent { frame = eventFrames[i], timestamp = eventTimes[i] };
                switch (names[i])
                {
                    case "address":            ev.address            = se; break;
                    case "toe_up":             ev.toe_up             = se; break;
                    case "mid_backswing":      ev.mid_backswing      = se; break;
                    case "top":                ev.top                = se; break;
                    case "mid_downswing":      ev.mid_downswing      = se; break;
                    case "impact":             ev.impact             = se; break;
                    case "mid_follow_through": ev.mid_follow_through = se; break;
                    case "finish":             ev.finish             = se; break;
                }
            }
            return ev;
        }

        public int AddressFrameIndex => addressFrameIndex;

        // ──────────────────────────────────────────────────────────────────────
        // 빌드 API (에디터 전용)

#if UNITY_EDITOR
        /// <summary>
        /// PoseSequence → PoseDataCache 변환 후 에셋 저장.
        /// </summary>
        public static PoseDataCache CreateFromSequence(PoseSequence seq, string assetPath)
        {
            if (seq == null || seq.frames == null) return null;
            seq.Normalize();

            var cache = CreateInstance<PoseDataCache>();
            cache.videoName  = seq.video ?? "";
            cache.viewType   = seq.view_type ?? "";
            cache.fps        = seq.fps;
            cache.totalFrames = seq.total_frames;

            int kpCount = seq.keypoint_count;
            cache.keypointNames = seq.keypoint_names?.ToArray()
                                  ?? new string[kpCount];

            // 이벤트
            string[] evNames = { "address","toe_up","mid_backswing","top",
                                  "mid_downswing","impact","mid_follow_through","finish" };
            cache.eventFrames = new int[8];
            cache.eventTimes  = new float[8];
            if (seq.events != null)
            {
                for (int i = 0; i < 8; i++)
                {
                    var e = seq.events.GetEvent(evNames[i]);
                    cache.eventFrames[i] = e?.frame     ?? -1;
                    cache.eventTimes[i]  = e?.timestamp ?? 0f;
                }
            }

            // address frame
            cache.addressFrameIndex = seq.events?.address?.frame ?? 0;

            // 프레임 SoA
            int total = seq.total_frames;
            cache.haspose = new bool [total];
            cache.xs   = new float[total * kpCount];
            cache.ys   = new float[total * kpCount];
            cache.zs   = new float[total * kpCount];
            cache.viss = new float[total * kpCount];

            for (int f = 0; f < total && f < seq.frames.Count; f++)
            {
                var frame = seq.frames[f];
                cache.haspose[f] = frame.has_pose;
                if (frame.landmarks == null) continue;

                int baseIdx = f * kpCount;
                for (int k = 0; k < kpCount && k < frame.landmarks.Count; k++)
                {
                    cache.xs[baseIdx + k]   = frame.landmarks[k].x;
                    cache.ys[baseIdx + k]   = frame.landmarks[k].y;
                    cache.zs[baseIdx + k]   = frame.landmarks[k].z;
                    cache.viss[baseIdx + k] = frame.landmarks[k].visibility;
                }
            }

            AssetDatabase.CreateAsset(cache, assetPath);
            AssetDatabase.SaveAssets();
            Debug.Log($"[PoseDataCache] 캐시 생성 완료: {assetPath}  ({total} frames, {kpCount} keypoints)");
            return cache;
        }
#endif
    }
}
