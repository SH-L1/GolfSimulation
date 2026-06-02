using System;
using System.IO;
using GolfSimulation.Correction;
using GolfSimulation.Core;
using GolfSimulation.Data;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace GolfSimulation.EditorValidation
{
    public static class PoseSystemValidation
    {
        private const string PlayModeValidationFlag = "GolfSimulation.PoseSystemValidation.PlayMode.Active";
        private const string PlayModeValidationStart = "GolfSimulation.PoseSystemValidation.PlayMode.Start";
        private static double playModeStartTime;
        private static bool playModeValidationCompleted;

        [InitializeOnLoadMethod]
        private static void ResumePlayModeValidationAfterReload()
        {
            if (!EditorPrefs.GetBool(PlayModeValidationFlag, false))
                return;

            playModeStartTime = EditorPrefs.GetFloat(PlayModeValidationStart, (float)EditorApplication.timeSinceStartup);
            playModeValidationCompleted = false;
            EditorApplication.update -= PollPlayModeComparisonRuntime;
            EditorApplication.update += PollPlayModeComparisonRuntime;
        }

        public static void ValidatePreprocessedRuntimeSetup()
        {
            try
            {
                string scenePath = "Assets/Scenes/SampleScene.unity";
                EditorSceneManager.OpenScene(scenePath);

                string preprocessedDir = Path.Combine(Application.streamingAssetsPath, "preprocessed", "face_on");
                string[] jsonFiles = Directory.Exists(preprocessedDir)
                    ? Directory.GetFiles(preprocessedDir, "*.json")
                    : Array.Empty<string>();
                if (jsonFiles.Length != 45)
                    throw new InvalidOperationException($"Expected 45 preprocessed JSON files, found {jsonFiles.Length}");

                foreach (string file in jsonFiles)
                {
                    if (!File.Exists(file + ".meta"))
                        throw new InvalidOperationException($"Missing Unity meta file: {file}.meta");
                }

                SwingSimulationController controller = UnityEngine.Object.FindFirstObjectByType<SwingSimulationController>();
                if (controller == null)
                    throw new InvalidOperationException("SwingSimulationController not found in SampleScene.");

                SwingPlayer swingPlayer = UnityEngine.Object.FindFirstObjectByType<SwingPlayer>();
                if (swingPlayer == null)
                    throw new InvalidOperationException("SwingPlayer not found in SampleScene.");

                PoseCorrector corrector = UnityEngine.Object.FindFirstObjectByType<PoseCorrector>();
                if (corrector == null)
                    throw new InvalidOperationException("PoseCorrector not found in SampleScene.");

                BoneMapper boneMapper = UnityEngine.Object.FindFirstObjectByType<BoneMapper>();
                if (boneMapper == null)
                    throw new InvalidOperationException("BoneMapper not found in SampleScene.");

                Animator animator = swingPlayer.TargetAnimator != null
                    ? swingPlayer.TargetAnimator
                    : UnityEngine.Object.FindFirstObjectByType<Animator>();
                if (animator == null)
                    throw new InvalidOperationException("Humanoid Animator not found for SwingPlayer.");
                if (!animator.isHuman)
                    throw new InvalidOperationException("SwingPlayer Animator is not configured as Humanoid.");

                HumanBodyBones[] requiredBones =
                {
                    HumanBodyBones.Hips,
                    HumanBodyBones.Spine,
                    HumanBodyBones.Head,
                    HumanBodyBones.LeftUpperArm,
                    HumanBodyBones.LeftLowerArm,
                    HumanBodyBones.LeftHand,
                    HumanBodyBones.RightUpperArm,
                    HumanBodyBones.RightLowerArm,
                    HumanBodyBones.RightHand,
                    HumanBodyBones.LeftUpperLeg,
                    HumanBodyBones.LeftLowerLeg,
                    HumanBodyBones.LeftFoot,
                    HumanBodyBones.RightUpperLeg,
                    HumanBodyBones.RightLowerLeg,
                    HumanBodyBones.RightFoot
                };
                foreach (HumanBodyBones bone in requiredBones)
                {
                    if (animator.GetBoneTransform(bone) == null)
                        throw new InvalidOperationException($"Required humanoid bone missing: {bone}");
                }

                GameObject temp = new GameObject("PoseDataLoader validation temp");
                PoseDataLoader loader = temp.AddComponent<PoseDataLoader>();
                var available = loader.GetAvailablePreprocessedFiles();
                if (available.Count != 45)
                    throw new InvalidOperationException($"PoseDataLoader listed {available.Count} files, expected 45.");

                if (!loader.LoadPreprocessedByIndex(0) || !loader.IsLoaded || loader.Sequence == null || loader.Sequence.frames.Count == 0)
                    throw new InvalidOperationException("PoseDataLoader failed to load first preprocessed file by index.");

                if (!loader.LoadPreprocessedByIndex(available.Count - 1) || !loader.IsLoaded || loader.Sequence == null || loader.Sequence.frames.Count == 0)
                    throw new InvalidOperationException("PoseDataLoader failed to load last preprocessed file by index.");

                UnityEngine.Object.DestroyImmediate(temp);
                Debug.Log("[PoseSystemValidation] Preprocessed runtime setup validation passed.");
                EditorApplication.Exit(0);
            }
            catch (Exception ex)
            {
                Debug.LogError("[PoseSystemValidation] Validation failed: " + ex);
                EditorApplication.Exit(1);
            }
        }

        public static void ValidatePlayModeComparisonRuntime()
        {
            try
            {
                string scenePath = "Assets/Scenes/SampleScene.unity";
                EditorSceneManager.OpenScene(scenePath);
                playModeStartTime = EditorApplication.timeSinceStartup;
                playModeValidationCompleted = false;
                EditorPrefs.SetBool(PlayModeValidationFlag, true);
                EditorPrefs.SetFloat(PlayModeValidationStart, (float)playModeStartTime);
                EditorApplication.update -= PollPlayModeComparisonRuntime;
                EditorApplication.update += PollPlayModeComparisonRuntime;
                EditorApplication.EnterPlaymode();
            }
            catch (Exception ex)
            {
                Debug.LogError("[PoseSystemValidation] Play Mode validation setup failed: " + ex);
                EditorApplication.Exit(1);
            }
        }

        private static void PollPlayModeComparisonRuntime()
        {
            if (playModeValidationCompleted)
                return;

            try
            {
                if (!EditorApplication.isPlaying)
                {
                    if (EditorApplication.timeSinceStartup - playModeStartTime > 60.0)
                        throw new TimeoutException("Timed out entering Play Mode.");
                    return;
                }

                if (EditorApplication.timeSinceStartup - playModeStartTime < 4.0)
                    return;

                SwingSimulationController controller = UnityEngine.Object.FindFirstObjectByType<SwingSimulationController>();
                if (controller == null)
                    throw new InvalidOperationException("SwingSimulationController missing in Play Mode.");

                GameObject referenceAvatar = GameObject.Find("Reference Swing Avatar");
                if (referenceAvatar == null)
                    throw new InvalidOperationException("Reference Swing Avatar was not created in Play Mode.");

                SwingPlayer[] allPlayers = UnityEngine.Object.FindObjectsByType<SwingPlayer>(FindObjectsSortMode.None);
                System.Collections.Generic.List<SwingPlayer> players = new System.Collections.Generic.List<SwingPlayer>();
                foreach (SwingPlayer player in allPlayers)
                {
                    if (player != null && player.enabled && player.gameObject.activeInHierarchy)
                        players.Add(player);
                }

                if (players.Count < 2)
                    throw new InvalidOperationException($"Expected at least 2 active SwingPlayer instances in Play Mode, found {players.Count}.");

                foreach (SwingPlayer player in players)
                {
                    if (player.TargetAnimator == null)
                        throw new InvalidOperationException("A SwingPlayer is missing its target Animator.");
                    if (player.DataLoader == null || !player.DataLoader.IsLoaded)
                        throw new InvalidOperationException("A SwingPlayer is missing loaded pose data.");
                    if (player.BoneMapper == null || !player.BoneMapper.IsInitialized)
                        throw new InvalidOperationException("A SwingPlayer BoneMapper is not initialized.");
                    if (player.TotalFrames <= 0)
                        throw new InvalidOperationException("A SwingPlayer has no frames.");
                }

                controller.SetComparisonSyncEnabled("false");
                controller.LoadSwingDataByIndex("0");
                controller.LoadReferenceSwingDataByIndex("44");
                controller.PlayUser();
                controller.PlayReference();
                controller.SeekFrame("10");
                controller.SeekReferenceFrame("20");
                controller.PauseUser();
                controller.PauseReference();
                controller.SetComparisonSyncEnabled("true");
                controller.SeekFrame("30");

                Debug.Log("[PoseSystemValidation] Play Mode comparison runtime validation passed.");
                FinishPlayModeValidation(0);
            }
            catch (Exception ex)
            {
                Debug.LogError("[PoseSystemValidation] Play Mode validation failed: " + ex);
                FinishPlayModeValidation(1);
            }
        }

        private static void FinishPlayModeValidation(int exitCode)
        {
            playModeValidationCompleted = true;
            EditorPrefs.DeleteKey(PlayModeValidationFlag);
            EditorPrefs.DeleteKey(PlayModeValidationStart);
            EditorApplication.update -= PollPlayModeComparisonRuntime;
            if (EditorApplication.isPlaying)
                EditorApplication.ExitPlaymode();
            EditorApplication.Exit(exitCode);
        }
    }
}
