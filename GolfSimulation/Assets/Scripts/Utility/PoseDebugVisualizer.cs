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
        [SerializeField] private BoneMapper boneMapper;

        [Header("Gizmo Settings")]
        [SerializeField] private float sphereRadius = 0.01f;
        [SerializeField] private float positionScale = 1f;
        [SerializeField] private Vector3 offset = Vector3.zero;
        [SerializeField] private bool showLabels = true;
        [SerializeField] private bool showConnections = true;
        [SerializeField] private bool showBodyFrame = true;
        [SerializeField] private bool showHeadLookLine = true;
        [SerializeField] private float axisLength = 0.25f;

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
            ("left_heel", "left_foot_index"), ("right_heel", "right_foot_index"),
            ("left_ankle", "left_heel"), ("right_ankle", "right_heel"),
        };

        private void OnDrawGizmos()
        {
            if (dataLoader == null || !dataLoader.IsLoaded || swingPlayer == null) return;
            if (boneMapper == null)
                boneMapper = GetComponent<BoneMapper>();

            PoseFrame frame = dataLoader.GetFrame(swingPlayer.CurrentFrameIndex);
            if (frame == null || !frame.has_pose) return;

            // 키포인트 점 그리기
            foreach (var lm in frame.landmarks)
            {
                Vector3 pos = ResolveDebugPosition(new Vector3(lm.x, lm.y, lm.z));

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
                    Vector3 fromPos = ResolveDebugPosition(dataLoader.GetLandmarkPosition(frame, from));
                    Vector3 toPos = ResolveDebugPosition(dataLoader.GetLandmarkPosition(frame, to));
                    Gizmos.DrawLine(fromPos, toPos);
                }
            }

            if (showBodyFrame && boneMapper != null && boneMapper.IsInitialized)
            {
                DrawAxisFrame(
                    boneMapper.BodyFrameOrigin,
                    boneMapper.BodyFrameRight,
                    boneMapper.BodyFrameUp,
                    boneMapper.BodyFrameForward,
                    axisLength);
            }

            if (showHeadLookLine)
            {
                Vector3 earCenter = (ResolveDebugPosition(dataLoader.GetLandmarkPosition(frame, "left_ear"))
                                  + ResolveDebugPosition(dataLoader.GetLandmarkPosition(frame, "right_ear"))) * 0.5f;
                Vector3 handCenter = (ResolveDebugPosition(dataLoader.GetLandmarkPosition(frame, "left_wrist"))
                                   + ResolveDebugPosition(dataLoader.GetLandmarkPosition(frame, "right_wrist"))) * 0.5f;
                Gizmos.color = Color.magenta;
                Gizmos.DrawLine(earCenter, handCenter);
            }
        }

        private Vector3 ResolveDebugPosition(Vector3 dataPoint)
        {
            if (boneMapper != null && boneMapper.IsInitialized)
                return boneMapper.DataPointToAvatarWorld(dataPoint) + offset;

            return dataPoint * positionScale + offset;
        }

        private void DrawAxisFrame(Vector3 origin, Vector3 right, Vector3 up, Vector3 forward, float length)
        {
            Gizmos.color = Color.red;
            Gizmos.DrawLine(origin, origin + right.normalized * length);
            Gizmos.color = Color.green;
            Gizmos.DrawLine(origin, origin + up.normalized * length);
            Gizmos.color = Color.blue;
            Gizmos.DrawLine(origin, origin + forward.normalized * length);
        }
    }
}
