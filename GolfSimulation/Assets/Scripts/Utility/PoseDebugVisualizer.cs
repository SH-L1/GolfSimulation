using GolfSimulation.Core;
using GolfSimulation.Data;
using UnityEngine;

namespace GolfSimulation.Utility
{
    /// <summary>
    /// 현재 재생 중인 프레임의 17개 키포인트를 Gizmo로 시각화한다.
    /// Scene 뷰에서 확인 가능.
    /// </summary>
    public class PoseDebugVisualizer : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private PoseDataLoader dataLoader;
        [SerializeField] private SwingPlayer swingPlayer;

        [Header("Gizmo Settings")]
        [SerializeField] private float sphereRadius = 0.01f;
        [SerializeField] private float positionScale = 1f;
        [SerializeField] private Vector3 offset = Vector3.zero;
        [SerializeField] private bool showLabels = true;
        [SerializeField] private bool showConnections = true;

        // 키포인트 간 연결선 정의 (본 체인)
        private static readonly (string, string)[] connections = new[]
        {
            // 얼굴
            ("nose", "left_eye"), ("nose", "right_eye"),
            ("left_eye", "left_ear"), ("right_eye", "right_ear"),
            // 상체
            ("left_shoulder", "right_shoulder"),
            ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
            ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
            // 몸통
            ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
            ("left_hip", "right_hip"),
            // 하체
            ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
            ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
        };

        private void OnDrawGizmos()
        {
            if (dataLoader == null || !dataLoader.IsLoaded || swingPlayer == null) return;

            PoseFrame frame = dataLoader.GetFrame(swingPlayer.CurrentFrameIndex);
            if (frame == null || !frame.has_pose) return;

            // 키포인트 점 그리기
            foreach (var lm in frame.landmarks)
            {
                Vector3 pos = new Vector3(lm.x, lm.y, lm.z) * positionScale + offset;

                // visibility에 따른 색상 (높을수록 녹색, 낮을수록 빨간색)
                Gizmos.color = Color.Lerp(Color.red, Color.green, lm.visibility);
                Gizmos.DrawSphere(pos, sphereRadius);

#if UNITY_EDITOR
                if (showLabels)
                {
                    UnityEditor.Handles.Label(pos + Vector3.up * 0.015f,
                        $"{lm.name}\n{lm.visibility:F2}");
                }
#endif
            }

            // 연결선 그리기
            if (showConnections)
            {
                Gizmos.color = Color.cyan;
                foreach (var (from, to) in connections)
                {
                    Vector3 fromPos = dataLoader.GetLandmarkPosition(frame, from) * positionScale + offset;
                    Vector3 toPos = dataLoader.GetLandmarkPosition(frame, to) * positionScale + offset;
                    Gizmos.DrawLine(fromPos, toPos);
                }
            }
        }
    }
}
