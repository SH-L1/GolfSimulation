using System;
using System.Collections;
using GolfSimulation.Correction;
using GolfSimulation.Data;
using GolfSimulation.IK;
using UnityEngine;

namespace GolfSimulation.Core
{
    /// <summary>
    /// UaaL(Unity as a Library) 통합용 퍼블릭 API.
    ///
    /// [역할]
    ///   네이티브 앱(Swift / Kotlin)에서 Unity 씬을 직접 제어할 수 있는
    ///   단일 진입점(Singleton)을 제공한다.
    ///
    /// [UaaL 호출 예시 — Swift]
    ///   UnityFramework.getInstance()
    ///     .sendMessageToGO("SwingController", "Play", "")
    ///   UnityFramework.getInstance()
    ///     .sendMessageToGO("SwingController", "LoadSwingData", "player_001.json")
    ///
    /// [UaaL 호출 예시 — Kotlin]
    ///   UnityPlayer.UnitySendMessage("SwingController", "Play", "")
    ///   UnityPlayer.UnitySendMessage("SwingController", "SetPlaybackSpeed", "0.5")
    ///
    /// [씬 설정]
    ///   씬에 빈 GameObject "SwingController"를 만들고 이 컴포넌트를 추가한다.
    ///   swingPlayer, dataLoader 필드를 Inspector에서 Y Bot의 컴포넌트로 연결한다.
    /// </summary>
    public class SwingSimulationController : MonoBehaviour
    {
        // ──────────────────────────────────────────────────────────────────────
        // Inspector 연결

        [Header("References")]
        [SerializeField] private SwingPlayer swingPlayer;
        [SerializeField] private PoseDataLoader dataLoader;
        [SerializeField] private SwingCameraController cameraController;

        [Header("Comparison Overlay")]
        [SerializeField] private bool createReferenceOverlay = true;
        [SerializeField] private string referencePoseFileName = "613_square_cleanswing.json";
        [SerializeField] private Vector3 referenceOverlayOffset = Vector3.zero;
        [SerializeField] private bool syncReferencePlayback = true;
        [SerializeField] private Color userAvatarTint = new Color(1f, 1f, 1f, 1f);
        [SerializeField] private Color referenceAvatarTint = new Color(0.25f, 0.55f, 1f, 0.42f);

        [Header("Avatar View UI")]
        [SerializeField] private bool showAvatarViewControls = true;
        [SerializeField] private bool userAvatarVisible = true;
        [SerializeField] private bool referenceAvatarVisible = true;
        [SerializeField, Range(0f, 1f)] private float userAvatarOpacity = 1f;
        [SerializeField, Range(0f, 1f)] private float referenceAvatarOpacity = 0.42f;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        // ──────────────────────────────────────────────────────────────────────
        // Singleton

        public static SwingSimulationController Instance { get; private set; }

        // ──────────────────────────────────────────────────────────────────────
        // 이벤트 (Unity → 네이티브 콜백)

        /// <summary>스윙 페이즈가 바뀔 때마다 발행. 예: "address", "impact", "finish"</summary>
        public static event Action<string> OnPhaseChanged;

        /// <summary>스윙 1회 재생이 완료(finish 이후 loop 없이 끝날 때) 발행.</summary>
        public static event Action OnSwingComplete;

        /// <summary>프레임이 바뀔 때마다 발행. (currentFrame, totalFrames)</summary>
        public static event Action<int, int> OnFrameUpdated;

        // ──────────────────────────────────────────────────────────────────────
        // 내부 상태

        private string prevPhase = "";
        private bool wasPlaying = false;
        private GameObject referenceAvatar;
        private SwingPlayer referenceSwingPlayer;
        private PoseDataLoader referenceDataLoader;
        private Rect avatarControlsRect = new Rect(12, 12, 280, 170);
        private Coroutine activeUserLoadRoutine;
        private Coroutine activeReferenceLoadRoutine;

        // ──────────────────────────────────────────────────────────────────────
        // 초기화

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (swingPlayer == null)
                swingPlayer = FindFirstObjectByType<SwingPlayer>();
            if (dataLoader == null)
                dataLoader = FindFirstObjectByType<PoseDataLoader>();
            if (cameraController == null)
                cameraController = FindFirstObjectByType<SwingCameraController>();
        }

        private void Start()
        {
            if (createReferenceOverlay)
                StartCoroutine(CreateReferenceOverlayAfterStartup());

            ApplyUserAvatarView();
            Debug.Log("[SwingCtrl] 초기화 완료 — UaaL API 준비됨");
        }

        private IEnumerator CreateReferenceOverlayAfterStartup()
        {
            yield return null;

            if (swingPlayer == null || swingPlayer.TargetAnimator == null || referenceAvatar != null)
                yield break;

            GameObject sourceAvatar = swingPlayer.TargetAnimator.gameObject;
            referenceAvatar = Instantiate(
                sourceAvatar,
                sourceAvatar.transform.position + referenceOverlayOffset,
                sourceAvatar.transform.rotation,
                sourceAvatar.transform.parent);
            referenceAvatar.name = "Reference Swing Avatar";

            DisableCopiedGolfSimulationComponents(referenceAvatar);
            ApplyReferenceAvatarView();

            Animator referenceAnimator = referenceAvatar.GetComponentInChildren<Animator>();
            if (referenceAnimator == null)
            {
                Debug.LogError("[SwingCtrl] Failed to create reference overlay: Animator not found on clone.");
                Destroy(referenceAvatar);
                referenceAvatar = null;
                yield break;
            }

            referenceDataLoader = referenceAvatar.AddComponent<PoseDataLoader>();
            referenceDataLoader.LoadFromFile(referencePoseFileName);

            referenceAvatar.AddComponent<PoseCorrector>();
            referenceAvatar.AddComponent<IKController>();
            BoneMapper referenceBoneMapper = referenceAvatar.AddComponent<BoneMapper>();
            referenceSwingPlayer = referenceAvatar.AddComponent<SwingPlayer>();
            referenceSwingPlayer.Configure(referenceDataLoader, referenceBoneMapper, referenceAnimator, swingPlayer == null || swingPlayer.IsPlaying, true);
            referenceSwingPlayer.PlaybackSpeedValue = swingPlayer != null ? swingPlayer.PlaybackSpeedValue : 1f;

            yield return null;
            if (syncReferencePlayback)
                SyncReferenceToUserFrame();

            Debug.Log($"[SwingCtrl] Reference overlay ready: {referencePoseFileName}");
        }

        private static void DisableCopiedGolfSimulationComponents(GameObject root)
        {
            if (root == null) return;

            MonoBehaviour[] behaviours = root.GetComponentsInChildren<MonoBehaviour>(true);
            foreach (MonoBehaviour behaviour in behaviours)
            {
                Type type = behaviour.GetType();
                if (type.Namespace != null && type.Namespace.StartsWith("GolfSimulation", StringComparison.Ordinal))
                    behaviour.enabled = false;
            }
        }

        private static void ApplyAvatarTint(GameObject root, Color tint)
        {
            if (root == null) return;

            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            foreach (Renderer renderer in renderers)
            {
                Material[] materials = renderer.materials;
                foreach (Material material in materials)
                    ApplyMaterialTint(material, tint);
            }
        }

        private static void ApplyMaterialTint(Material material, Color tint)
        {
            if (material == null) return;

            if (material.HasProperty("_BaseColor"))
                material.SetColor("_BaseColor", tint);
            else if (material.HasProperty("_Color"))
                material.SetColor("_Color", tint);

            if (tint.a >= 0.99f) return;

            material.SetFloat("_Surface", 1f);
            material.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            material.SetFloat("_ZWrite", 0f);
            material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            material.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
        }

        private static void SetAvatarRenderersVisible(GameObject root, bool isVisible)
        {
            if (root == null) return;

            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            foreach (Renderer renderer in renderers)
                renderer.enabled = isVisible;
        }

        private void ApplyUserAvatarView()
        {
            GameObject userAvatar = swingPlayer?.TargetAnimator?.gameObject;
            Color tint = userAvatarTint;
            tint.a = Mathf.Clamp01(userAvatarOpacity);
            ApplyAvatarTint(userAvatar, tint);
            SetAvatarRenderersVisible(userAvatar, userAvatarVisible);
        }

        private void ApplyReferenceAvatarView()
        {
            Color tint = referenceAvatarTint;
            tint.a = Mathf.Clamp01(referenceAvatarOpacity);
            ApplyAvatarTint(referenceAvatar, tint);
            SetAvatarRenderersVisible(referenceAvatar, referenceAvatarVisible);
        }

        private static bool ParseEnabled(string value, bool fallback)
        {
            if (string.IsNullOrEmpty(value))
                return true;

            if (value == "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase))
                return true;
            if (value == "0" || value.Equals("false", StringComparison.OrdinalIgnoreCase))
                return false;

            return fallback;
        }

        private static float ParseOpacity(string value, float fallback)
        {
            return float.TryParse(value, out float opacity)
                ? Mathf.Clamp01(opacity)
                : fallback;
        }

        private void Update()
        {
            if (swingPlayer == null) return;

            // 페이즈 변경 감지 → 콜백
            string phase = swingPlayer.CurrentPhase;
            if (phase != prevPhase)
            {
                prevPhase = phase;
                OnPhaseChanged?.Invoke(phase);
                if (showDebugInfo)
                    Debug.Log($"[SwingCtrl] Phase: {phase}");
            }

            // 프레임 업데이트 콜백
            OnFrameUpdated?.Invoke(swingPlayer.CurrentFrameIndex, swingPlayer.TotalFrames);

            // 재생 완료 감지
            if (wasPlaying && !swingPlayer.IsPlaying)
            {
                OnSwingComplete?.Invoke();
                if (showDebugInfo)
                    Debug.Log("[SwingCtrl] 재생 완료");
            }
            wasPlaying = swingPlayer.IsPlaying;
        }

        // ──────────────────────────────────────────────────────────────────────
        // 네이티브 → Unity 제어 메서드
        // UnitySendMessage / sendMessageToGO 로 호출 가능

        /// <summary>재생 시작. UnitySendMessage("SwingController", "Play", "")</summary>
        public void Play(string _ = "")
        {
            swingPlayer?.Play();
            if (syncReferencePlayback)
                referenceSwingPlayer?.Play();
            Debug.Log("[SwingCtrl] Play");
        }

        /// <summary>일시정지. UnitySendMessage("SwingController", "Pause", "")</summary>
        public void Pause(string _ = "")
        {
            swingPlayer?.Pause();
            if (syncReferencePlayback)
                referenceSwingPlayer?.Pause();
            Debug.Log("[SwingCtrl] Pause");
        }

        /// <summary>정지 + 처음으로. UnitySendMessage("SwingController", "Stop", "")</summary>
        public void Stop(string _ = "")
        {
            swingPlayer?.Stop();
            if (syncReferencePlayback)
                referenceSwingPlayer?.Stop();
            Debug.Log("[SwingCtrl] Stop");
        }

        /// <summary>
        /// 재생 속도 변경.
        /// UnitySendMessage("SwingController", "SetPlaybackSpeed", "0.5")
        /// </summary>
        public void SetPlaybackSpeed(string speedStr)
        {
            if (float.TryParse(speedStr, out float speed) && swingPlayer != null)
            {
                swingPlayer.PlaybackSpeedValue = speed;
                if (syncReferencePlayback && referenceSwingPlayer != null)
                    referenceSwingPlayer.PlaybackSpeedValue = speed;
                Debug.Log($"[SwingCtrl] PlaybackSpeed = {speed}");
            }
        }

        /// <summary>
        /// 특정 프레임으로 이동.
        /// UnitySendMessage("SwingController", "SeekFrame", "45")
        /// </summary>
        public void SeekFrame(string frameStr)
        {
            if (int.TryParse(frameStr, out int frame) && swingPlayer != null)
            {
                swingPlayer.SetFrame(frame);
                if (syncReferencePlayback)
                    SyncReferenceToUserFrame();
                Debug.Log($"[SwingCtrl] SeekFrame = {frame}");
            }
        }

        public void SetCameraView(string view)
        {
            cameraController?.SetCameraView(view);
            Debug.Log($"[SwingCtrl] SetCameraView = {view}");
        }

        public void NextCameraView(string _ = "")
        {
            cameraController?.NextCameraView();
            Debug.Log("[SwingCtrl] NextCameraView");
        }

        public void ResetCameraView(string _ = "")
        {
            cameraController?.ResetToRearView();
            Debug.Log("[SwingCtrl] ResetCameraView");
        }

        public void SetComparisonOverlayEnabled(string enabled)
        {
            referenceAvatarVisible = ParseEnabled(enabled, referenceAvatarVisible);
            ApplyReferenceAvatarView();

            Debug.Log($"[SwingCtrl] Comparison overlay = {referenceAvatarVisible}");
        }

        public void SetUserAvatarVisible(string enabled)
        {
            userAvatarVisible = ParseEnabled(enabled, userAvatarVisible);
            ApplyUserAvatarView();
            Debug.Log($"[SwingCtrl] User avatar visible = {userAvatarVisible}");
        }

        public void SetReferenceAvatarVisible(string enabled)
        {
            referenceAvatarVisible = ParseEnabled(enabled, referenceAvatarVisible);
            ApplyReferenceAvatarView();
            Debug.Log($"[SwingCtrl] Reference avatar visible = {referenceAvatarVisible}");
        }

        public void SetUserAvatarOpacity(string opacity)
        {
            userAvatarOpacity = ParseOpacity(opacity, userAvatarOpacity);
            ApplyUserAvatarView();
            Debug.Log($"[SwingCtrl] User avatar opacity = {userAvatarOpacity:F2}");
        }

        public void SetReferenceAvatarOpacity(string opacity)
        {
            referenceAvatarOpacity = ParseOpacity(opacity, referenceAvatarOpacity);
            ApplyReferenceAvatarView();
            Debug.Log($"[SwingCtrl] Reference avatar opacity = {referenceAvatarOpacity:F2}");
        }

        public void SetComparisonSyncEnabled(string enabled)
        {
            syncReferencePlayback = string.IsNullOrEmpty(enabled) ||
                enabled == "1" ||
                enabled.Equals("true", StringComparison.OrdinalIgnoreCase);

            if (syncReferencePlayback)
                SyncReferenceToUserFrame();

            Debug.Log($"[SwingCtrl] Comparison sync = {syncReferencePlayback}");
        }

        public void PlayUser(string _ = "") => swingPlayer?.Play();
        public void PauseUser(string _ = "") => swingPlayer?.Pause();
        public void StopUser(string _ = "") => swingPlayer?.Stop();
        public void PlayReference(string _ = "") => referenceSwingPlayer?.Play();
        public void PauseReference(string _ = "") => referenceSwingPlayer?.Pause();
        public void StopReference(string _ = "") => referenceSwingPlayer?.Stop();

        public void SeekReferenceFrame(string frameStr)
        {
            if (int.TryParse(frameStr, out int frame))
                referenceSwingPlayer?.SetFrame(frame);
        }

        public void LoadSwingDataByIndex(string indexStr)
        {
            if (!int.TryParse(indexStr, out int index) || dataLoader == null || swingPlayer == null)
                return;

            swingPlayer.Stop();
            if (dataLoader.LoadPreprocessedByIndex(index))
            {
                swingPlayer.ReinitializeWithLoader();
                if (syncReferencePlayback)
                    SyncReferenceToUserFrame();
                Debug.Log($"[SwingCtrl] LoadSwingDataByIndex complete: {index} ({dataLoader.CurrentFileName})");
            }
        }

        public void LoadReferenceSwingDataByIndex(string indexStr)
        {
            if (!int.TryParse(indexStr, out int index) || referenceDataLoader == null || referenceSwingPlayer == null)
                return;

            referenceSwingPlayer.Stop();
            if (referenceDataLoader.LoadPreprocessedByIndex(index))
            {
                referenceSwingPlayer.ReinitializeWithLoader();
                if (syncReferencePlayback)
                    SyncReferenceToUserFrame();
                referencePoseFileName = referenceDataLoader.CurrentFileName;
                Debug.Log($"[SwingCtrl] LoadReferenceSwingDataByIndex complete: {index} ({referencePoseFileName})");
            }
        }

        public string GetAvailablePreprocessedFilesJson()
        {
            return dataLoader != null ? dataLoader.GetAvailablePreprocessedFilesJson() : "[]";
        }

        public void LoadReferenceSwingData(string fileName)
        {
            if (string.IsNullOrEmpty(fileName) || referenceDataLoader == null || referenceSwingPlayer == null)
                return;

            if (activeReferenceLoadRoutine != null)
                StopCoroutine(activeReferenceLoadRoutine);

            activeReferenceLoadRoutine = StartCoroutine(LoadReferenceSwingDataRoutine(fileName));
        }

        /// <summary>
        /// 다른 JSON 파일로 교체 후 재로딩.
        /// UnitySendMessage("SwingController", "LoadSwingData", "player_001.json")
        /// StreamingAssets/ 기준 파일명을 전달한다.
        /// </summary>
        public void LoadSwingData(string fileName)
        {
            if (dataLoader == null || swingPlayer == null) return;
            if (string.IsNullOrEmpty(fileName)) return;

            if (activeUserLoadRoutine != null)
                StopCoroutine(activeUserLoadRoutine);

            activeUserLoadRoutine = StartCoroutine(LoadSwingDataRoutine(fileName));
        }

        // ──────────────────────────────────────────────────────────────────────
        // 상태 조회 (네이티브에서 폴링용)

        private IEnumerator LoadSwingDataRoutine(string source)
        {
            swingPlayer.Stop();

            bool loaded = false;
            if (ShouldLoadWithUnityWebRequest(source))
            {
                yield return dataLoader.LoadFromUri(source, success => loaded = success);
            }
            else
            {
                dataLoader.LoadFromFile(source);
                loaded = dataLoader.IsLoaded;
            }

            if (loaded)
            {
                swingPlayer.ReinitializeWithLoader();
                if (syncReferencePlayback)
                    SyncReferenceToUserFrame();
                Debug.Log($"[SwingCtrl] LoadSwingData complete: {source}");
            }
            else
            {
                Debug.LogError($"[SwingCtrl] LoadSwingData failed: {source}");
            }

            activeUserLoadRoutine = null;
        }

        private IEnumerator LoadReferenceSwingDataRoutine(string source)
        {
            referenceSwingPlayer.Stop();

            bool loaded = false;
            if (ShouldLoadWithUnityWebRequest(source))
            {
                yield return referenceDataLoader.LoadFromUri(source, success => loaded = success);
            }
            else
            {
                referenceDataLoader.LoadFromFile(source);
                loaded = referenceDataLoader.IsLoaded;
            }

            if (loaded)
            {
                referenceSwingPlayer.ReinitializeWithLoader();
                if (syncReferencePlayback)
                    SyncReferenceToUserFrame();
                referencePoseFileName = source;
                Debug.Log($"[SwingCtrl] LoadReferenceSwingData complete: {source}");
            }
            else
            {
                Debug.LogError($"[SwingCtrl] LoadReferenceSwingData failed: {source}");
            }

            activeReferenceLoadRoutine = null;
        }

        private static bool ShouldLoadWithUnityWebRequest(string source)
        {
            if (!Uri.TryCreate(source, UriKind.Absolute, out Uri uri))
                return false;

            return uri.Scheme == Uri.UriSchemeHttp
                || uri.Scheme == Uri.UriSchemeHttps
                || uri.Scheme == Uri.UriSchemeFile
                || uri.Scheme == "content";
        }

        private void SyncReferenceToUserFrame()
        {
            if (swingPlayer == null || referenceSwingPlayer == null)
                return;

            int userTotal = Mathf.Max(1, swingPlayer.TotalFrames);
            int referenceTotal = Mathf.Max(1, referenceSwingPlayer.TotalFrames);
            float normalized = userTotal > 1
                ? (float)swingPlayer.CurrentFrameIndex / (userTotal - 1)
                : 0f;
            int referenceFrame = Mathf.Clamp(
                Mathf.RoundToInt(normalized * (referenceTotal - 1)),
                0,
                referenceTotal - 1);

            referenceSwingPlayer.SetFrame(referenceFrame);
            referenceSwingPlayer.PlaybackSpeedValue = swingPlayer.PlaybackSpeedValue;

            if (swingPlayer.IsPlaying)
                referenceSwingPlayer.Play();
            else
                referenceSwingPlayer.Pause();
        }

        public string GetCurrentPhase() => swingPlayer?.CurrentPhase ?? "";
        public int GetCurrentFrame()    => swingPlayer?.CurrentFrameIndex ?? 0;
        public int GetTotalFrames()     => swingPlayer?.TotalFrames ?? 0;
        public bool GetIsPlaying()      => swingPlayer?.IsPlaying ?? false;

        private void OnGUI()
        {
            if (showAvatarViewControls)
                avatarControlsRect = GUI.Window(9102, avatarControlsRect, DrawAvatarControls, "Avatar View");

            if (!showDebugInfo) return;
            GUILayout.BeginArea(new Rect(Screen.width - 230, 10, 220, 80));
            GUILayout.Label($"[UaaL API] 준비됨");
            GUILayout.Label($"  Frame: {GetCurrentFrame()} / {GetTotalFrames()}");
            GUILayout.Label($"  Phase: {GetCurrentPhase()}");
            GUILayout.Label($"  Playing: {GetIsPlaying()}");
            GUILayout.EndArea();
        }

        private void DrawAvatarControls(int id)
        {
            GUILayout.Space(4);

            bool nextUserVisible = GUILayout.Toggle(userAvatarVisible, " User avatar");
            if (nextUserVisible != userAvatarVisible)
            {
                userAvatarVisible = nextUserVisible;
                ApplyUserAvatarView();
            }

            GUILayout.Label($"User opacity: {userAvatarOpacity:F2}");
            float nextUserOpacity = GUILayout.HorizontalSlider(userAvatarOpacity, 0f, 1f);
            if (!Mathf.Approximately(nextUserOpacity, userAvatarOpacity))
            {
                userAvatarOpacity = nextUserOpacity;
                ApplyUserAvatarView();
            }

            GUILayout.Space(8);

            bool nextReferenceVisible = GUILayout.Toggle(referenceAvatarVisible, " Pro avatar");
            if (nextReferenceVisible != referenceAvatarVisible)
            {
                referenceAvatarVisible = nextReferenceVisible;
                ApplyReferenceAvatarView();
            }

            GUILayout.Label($"Pro opacity: {referenceAvatarOpacity:F2}");
            float nextReferenceOpacity = GUILayout.HorizontalSlider(referenceAvatarOpacity, 0f, 1f);
            if (!Mathf.Approximately(nextReferenceOpacity, referenceAvatarOpacity))
            {
                referenceAvatarOpacity = nextReferenceOpacity;
                ApplyReferenceAvatarView();
            }

            GUI.DragWindow();
        }
    }
}
