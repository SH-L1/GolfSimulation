using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace GolfSimulation.EditorBuild
{
    public static class Unity2022SetupUtility
    {
        [MenuItem("GolfSimulation/2022/Apply Android Viewer Settings")]
        public static void ApplyAndroidViewerSettings()
        {
            AndroidLibraryBuild2022.ConfigureAndroidForReactNative();
            QualitySettings.SetQualityLevel(0, true);
            Debug.Log("[Unity2022SetupUtility] Android viewer settings applied.");
        }

        [MenuItem("GolfSimulation/2022/Recreate Minimal URP Assets")]
        public static void RecreateMinimalUrpAssets()
        {
            string settingsDir = "Assets/Settings";
            Directory.CreateDirectory(settingsDir);

            string rendererPath = $"{settingsDir}/Unity2022_Mobile_Renderer.asset";
            string pipelinePath = $"{settingsDir}/Unity2022_Mobile_RPAsset.asset";

            if (!File.Exists(rendererPath))
            {
                ScriptableRendererData renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, rendererPath);
            }

            if (!File.Exists(pipelinePath))
            {
                ScriptableRendererData renderer = AssetDatabase.LoadAssetAtPath<ScriptableRendererData>(rendererPath);
                UniversalRenderPipelineAsset pipeline = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(pipeline, pipelinePath);
            }

            RenderPipelineAsset pipelineAsset = AssetDatabase.LoadAssetAtPath<RenderPipelineAsset>(pipelinePath);
            GraphicsSettings.defaultRenderPipeline = pipelineAsset;

            int mobileQualityIndex = 0;
            if (QualitySettings.names.Length > 0)
                QualitySettings.SetQualityLevel(mobileQualityIndex, true);
            QualitySettings.renderPipeline = pipelineAsset;

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[Unity2022SetupUtility] Minimal URP assets ready: {pipelinePath}");
        }
    }
}
