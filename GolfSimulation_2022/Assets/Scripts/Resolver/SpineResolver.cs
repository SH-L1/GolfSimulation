using UnityEngine;

namespace GolfSimulation.Resolver
{
    /// <summary>
    /// 어깨 벡터와 골반 벡터를 블렌딩하여 Spine 체인의 회전을 계산한다.
    /// 각 본의 "right" 방향 = Slerp(hipRight, shoulderRight, weight)
    /// weight가 낮을수록 힙을, 높을수록 어깨를 따른다.
    /// 첫 프레임 기준 delta만 적용하여 T-Pose 오프셋을 제거한다.
    /// </summary>
    public class SpineResolver : MonoBehaviour
    {
        [Header("Spine Chain References")]
        [SerializeField] private Transform spine;
        [SerializeField] private Transform spine1;
        [SerializeField] private Transform spine2;

        [Header("어깨 추종 비율 (0=힙, 1=어깨)")]
        [SerializeField] [Range(0f, 1f)] private float spineWeight = 0.3f;
        [SerializeField] [Range(0f, 1f)] private float spine1Weight = 0.6f;
        [SerializeField] [Range(0f, 1f)] private float spine2Weight = 0.9f;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        // T-Pose 기준 캐시
        private Quaternion[] boneRestWorldRots;
        // 첫 프레임 데이터 기준 방향
        private Quaternion[] dataRestOrientations;

        private Transform[] bones;
        private float[] weights;

        private bool isInitialized;
        private bool isFirstResolve = true;
        private float lastXFactor;
        private float lastHipYaw;

        public float LastXFactor => lastXFactor;

        public void Initialize(Animator animator)
        {
            spine = animator.GetBoneTransform(HumanBodyBones.Spine);
            spine1 = animator.GetBoneTransform(HumanBodyBones.Chest);
            spine2 = animator.GetBoneTransform(HumanBodyBones.UpperChest);

            if (spine == null || spine1 == null)
            {
                Debug.LogError("[SpineResolver] Spine 또는 Chest 본을 찾을 수 없습니다");
                return;
            }

            if (spine2 == null)
            {
                Debug.LogWarning("[SpineResolver] UpperChest 없음 — Chest까지만 사용");
            }

            // 배열 구성
            int count = spine2 != null ? 3 : 2;
            bones = new Transform[count];
            weights = new float[count];
            boneRestWorldRots = new Quaternion[count];
            dataRestOrientations = new Quaternion[count];

            bones[0] = spine;   weights[0] = spineWeight;
            bones[1] = spine1;  weights[1] = spine1Weight;
            if (spine2 != null) { bones[2] = spine2; weights[2] = spine2Weight; }

            // T-Pose world rotation 캐시
            for (int i = 0; i < count; i++)
                boneRestWorldRots[i] = bones[i].rotation;

            isInitialized = true;
            isFirstResolve = true;
            Debug.Log($"[SpineResolver] 초기화 완료 — Spine: {spine.name}, Chest: {spine1.name}, UpperChest: {(spine2 != null ? spine2.name : "없음")}");
        }

        /// <summary>
        /// 한 프레임의 어깨·골반 좌표로부터 Spine 체인 회전을 적용한다.
        /// 모든 좌표는 DataToAvatarSpace 변환이 완료된 상태여야 한다.
        /// </summary>
        public void Resolve(Vector3 leftShoulder, Vector3 rightShoulder,
                           Vector3 leftHip, Vector3 rightHip)
        {
            if (!isInitialized) return;

            // 기본 벡터 계산
            Vector3 hipRight = (rightHip - leftHip).normalized;
            Vector3 shoulderRight = (rightShoulder - leftShoulder).normalized;

            Vector3 pelvisCenter = (leftHip + rightHip) * 0.5f;
            Vector3 shoulderCenter = (leftShoulder + rightShoulder) * 0.5f;

            // [FIX] trunkUp을 Vector3.up으로 고정.
            // 데이터 기반 trunkUp = (shoulderCenter - pelvisCenter)는 pelvis-centered 데이터에서
            // Z 성분(전방 편향 ~34%)을 포함하여 Cross(boneRight, trunkUp)의 결과 boneForward에
            // -Y(하향) 성분을 생성. 스윙 중 trunk 각도 변화 시 이 -Y 변화가 delta에 포함되어
            // 허리가 뒤로 꺾이는 현상 발생. Vector3.up 사용 시 yaw(좌우 회전)만 캡처하고
            // pitch(전후 기울기)는 T-Pose 상태를 유지.
            Vector3 trunkUp = Vector3.up;

            // X-Factor 디버그용 (표시만)
            Vector2 shoulderFlat = new Vector2(shoulderRight.x, shoulderRight.z);
            Vector2 hipFlat = new Vector2(hipRight.x, hipRight.z);
            lastXFactor = Vector2.SignedAngle(hipFlat, shoulderFlat);
            lastHipYaw = Mathf.Atan2(hipRight.z, hipRight.x) * Mathf.Rad2Deg;

            // 각 본에 대해 블렌딩 회전 적용
            for (int i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;

                // hip→shoulder 사이에서 weight로 right 방향 보간
                Vector3 boneRight = Vector3.Slerp(hipRight, shoulderRight, weights[i]).normalized;

                // 3축 좌표계 구성: right × trunkUp → forward
                Vector3 boneForward = Vector3.Cross(boneRight, trunkUp).normalized;
                if (boneForward.sqrMagnitude < 0.001f) continue;

                // 직교 보정: forward × right → up
                Vector3 boneUp = Vector3.Cross(boneForward, boneRight).normalized;

                Quaternion dataOrientation = Quaternion.LookRotation(boneForward, boneUp);

                // 첫 프레임: 기준 캐시
                if (isFirstResolve)
                {
                    dataRestOrientations[i] = dataOrientation;
                }

                // delta 적용: 첫 프레임 대비 변화량 × T-Pose 기본 회전
                Quaternion delta = dataOrientation * Quaternion.Inverse(dataRestOrientations[i]);
                bones[i].rotation = delta * boneRestWorldRots[i];
            }

            if (isFirstResolve)
            {
                isFirstResolve = false;
                Debug.Log($"[SpineResolver] 첫 프레임 기준 캐시 — hipYaw: {lastHipYaw:F1}°, X-Factor: {lastXFactor:F1}°");
            }
        }

        private void OnGUI()
        {
            if (!showDebugInfo || !isInitialized) return;

            GUILayout.BeginArea(new Rect(10, 140, 300, 60));
            GUILayout.Label($"X-Factor: {lastXFactor:F1}°  Hip Yaw: {lastHipYaw:F1}°");
            GUILayout.Label($"Spine 추종: {spineWeight:F1} / {spine1Weight:F1} / {spine2Weight:F1}");
            GUILayout.EndArea();
        }
    }
}
