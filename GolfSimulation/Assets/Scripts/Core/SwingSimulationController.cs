using System;
using GolfSimulation.Data;
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
            Debug.Log("[SwingCtrl] 초기화 완료 — UaaL API 준비됨");
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
            Debug.Log("[SwingCtrl] Play");
        }

        /// <summary>일시정지. UnitySendMessage("SwingController", "Pause", "")</summary>
        public void Pause(string _ = "")
        {
            swingPlayer?.Pause();
            Debug.Log("[SwingCtrl] Pause");
        }

        /// <summary>정지 + 처음으로. UnitySendMessage("SwingController", "Stop", "")</summary>
        public void Stop(string _ = "")
        {
            swingPlayer?.Stop();
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

        /// <summary>
        /// 다른 JSON 파일로 교체 후 재로딩.
        /// UnitySendMessage("SwingController", "LoadSwingData", "player_001.json")
        /// StreamingAssets/ 기준 파일명을 전달한다.
        /// </summary>
        public void LoadSwingData(string fileName)
        {
            if (dataLoader == null || swingPlayer == null) return;
            if (string.IsNullOrEmpty(fileName)) return;

            swingPlayer.Stop();
            dataLoader.LoadFromFile(fileName);

            if (dataLoader.IsLoaded)
            {
                swingPlayer.ReinitializeWithLoader();
                Debug.Log($"[SwingCtrl] LoadSwingData 완료: {fileName}");
            }
            else
            {
                Debug.LogError($"[SwingCtrl] LoadSwingData 실패: {fileName}");
            }
        }

        // ──────────────────────────────────────────────────────────────────────
        // 상태 조회 (네이티브에서 폴링용)

        public string GetCurrentPhase() => swingPlayer?.CurrentPhase ?? "";
        public int GetCurrentFrame()    => swingPlayer?.CurrentFrameIndex ?? 0;
        public int GetTotalFrames()     => swingPlayer?.TotalFrames ?? 0;
        public bool GetIsPlaying()      => swingPlayer?.IsPlaying ?? false;

        private void OnGUI()
        {
            if (!showDebugInfo) return;
            GUILayout.BeginArea(new Rect(Screen.width - 230, 10, 220, 80));
            GUILayout.Label($"[UaaL API] 준비됨");
            GUILayout.Label($"  Frame: {GetCurrentFrame()} / {GetTotalFrames()}");
            GUILayout.Label($"  Phase: {GetCurrentPhase()}");
            GUILayout.Label($"  Playing: {GetIsPlaying()}");
            GUILayout.EndArea();
        }
    }
}
