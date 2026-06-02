#if UNITY_EDITOR
using System.IO;
using GolfSimulation.Data;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;

namespace GolfSimulation.Editor
{
    /// <summary>
    /// [Window → Golf Simulation → Rebuild Pose Cache]
    /// JSON 포즈 파일을 ScriptableObject 바이너리 캐시로 변환한다.
    /// JSON 내용이 바뀔 때마다 이 메뉴를 실행하여 캐시를 재생성하세요.
    /// </summary>
    public static class PoseCacheBuilder
    {
        private const string JsonFileName  = "golf_swing_pose.json";
        private const string CacheAssetPath = "Assets/Resources/PoseCache.asset";

        [MenuItem("Window/Golf Simulation/Rebuild Pose Cache")]
        public static void RebuildCache()
        {
            // JSON 경로 (StreamingAssets)
            string jsonPath = Path.Combine(Application.streamingAssetsPath, JsonFileName);
            if (!File.Exists(jsonPath))
            {
                EditorUtility.DisplayDialog("오류",
                    $"JSON 파일을 찾을 수 없습니다:\n{jsonPath}", "확인");
                return;
            }

            // 파싱
            string json = File.ReadAllText(jsonPath);
            PoseSequence seq = JsonConvert.DeserializeObject<PoseSequence>(json);
            if (seq == null)
            {
                EditorUtility.DisplayDialog("오류", "JSON 파싱에 실패했습니다.", "확인");
                return;
            }

            // Resources 폴더 생성
            string resDir = "Assets/Resources";
            if (!AssetDatabase.IsValidFolder(resDir))
                AssetDatabase.CreateFolder("Assets", "Resources");

            // 기존 캐시 삭제
            if (File.Exists(Path.Combine(Application.dataPath, "../" + CacheAssetPath)))
                AssetDatabase.DeleteAsset(CacheAssetPath);

            // 캐시 생성
            PoseDataCache.CreateFromSequence(seq, CacheAssetPath);

            AssetDatabase.Refresh();
            EditorUtility.DisplayDialog("완료",
                $"PoseCache 생성 완료\n경로: {CacheAssetPath}\n프레임: {seq.total_frames}", "확인");
        }

        [MenuItem("Window/Golf Simulation/Rebuild Pose Cache", validate = true)]
        public static bool RebuildCacheValidate() => !EditorApplication.isPlaying;
    }
}
#endif
