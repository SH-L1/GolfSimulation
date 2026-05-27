using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace GolfSimulation.EditorBuild
{
    public static class AndroidLibraryBuild2022
    {
        private const string OutputPath = "Builds/Android";

        public static void ConfigureAndroidForReactNative()
        {
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            EditorUserBuildSettings.androidBuildSystem = AndroidBuildSystem.Gradle;
            EditorUserBuildSettings.exportAsGoogleAndroidProject = true;

            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.golfsimulation.unity");
            PlayerSettings.bundleVersion = "0.1.0";
            PlayerSettings.Android.bundleVersionCode = 1;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel25;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARMv7 | AndroidArchitecture.ARM64;
            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);

            Debug.Log("[AndroidLibraryBuild2022] Android settings configured for React Native UnityView integration.");
        }

        [MenuItem("GolfSimulation/2022/Export Android Library")]
        public static void ExportAndroidLibrary()
        {
            ConfigureAndroidForReactNative();

            string absoluteOutput = Path.GetFullPath(Path.Combine(Application.dataPath, "..", OutputPath));
            Directory.CreateDirectory(absoluteOutput);

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/SampleScene.unity" },
                locationPathName = absoluteOutput,
                target = BuildTarget.Android,
                targetGroup = BuildTargetGroup.Android,
                options = BuildOptions.None
            };

            BuildReport report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException($"Android Library export failed: {report.summary.result}");

            string unityLibrary = Path.Combine(absoluteOutput, "unityLibrary");
            if (!Directory.Exists(unityLibrary))
                throw new DirectoryNotFoundException($"Export finished but unityLibrary was not found: {unityLibrary}");

            Debug.Log($"[AndroidLibraryBuild2022] Android Library exported: {unityLibrary}");
        }
    }
}
