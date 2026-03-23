using UnityEngine;

namespace GolfSimulation.Resolver
{
    /// <summary>
    /// 어깨 중점, nose, ear 좌표로부터 Neck과 Head 회전을 계산한다.
    /// Neck: 첫 프레임 기준 earCenter-shoulderCenter 방향의 변화량(delta)만 적용
    /// Head: nose-earCenter 방향 + ear 기반 up 벡터로 LookRotation
    /// </summary>
    public class HeadResolver : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform neck;
        [SerializeField] private Transform head;

        // T-Pose 기준 캐시
        private Quaternion neckRestRot;
        private Quaternion headRestRot;

        // 첫 프레임 데이터 기준 방향 (delta 계산용)
        private Vector3 dataRestNeckDir;
        private Vector3 dataRestHeadFwd;
        private Vector3 dataRestHeadUp;

        private bool isInitialized;
        private bool isFirstFrame = true;

        public void Initialize(Animator animator)
        {
            neck = animator.GetBoneTransform(HumanBodyBones.Neck);
            head = animator.GetBoneTransform(HumanBodyBones.Head);

            if (neck == null)
            {
                Debug.LogError("[HeadResolver] Neck 본을 찾을 수 없습니다");
                return;
            }
            if (head == null)
            {
                Debug.LogError("[HeadResolver] Head 본을 찾을 수 없습니다");
                return;
            }

            neckRestRot = neck.rotation;
            headRestRot = head.rotation;

            isInitialized = true;
            isFirstFrame = true;
            Debug.Log($"[HeadResolver] 초기화 완료 — Neck: {neck.name}, Head: {head.name}");
        }

        /// <summary>
        /// Neck과 Head 회전을 적용한다.
        /// 모든 좌표는 DataToAvatarSpace 변환이 완료된 상태여야 한다.
        /// </summary>
        public void Resolve(Vector3 leftShoulder, Vector3 rightShoulder,
                           Vector3 nose, Vector3 leftEar, Vector3 rightEar)
        {
            if (!isInitialized) return;

            Vector3 shoulderCenter = (leftShoulder + rightShoulder) * 0.5f;
            Vector3 earCenter = (leftEar + rightEar) * 0.5f;

            // earCenter를 목 방향 프록시로 사용 (nose는 얼굴 앞쪽이라 과도한 전방 편향 발생)
            Vector3 neckDir = (earCenter - shoulderCenter).normalized;

            // Head forward/up 계산
            Vector3 headForward = (nose - earCenter).normalized;
            // [FIX] Cross(headForward, earVector)로 순서 수정 — 올바른 상향 벡터 생성
            Vector3 earVector = (rightEar - leftEar).normalized;
            Vector3 headUp = Vector3.Cross(headForward, earVector).normalized;

            if (neckDir.sqrMagnitude < 0.001f) return;

            // 첫 프레임: 기준 방향 캐시 (이후 delta 계산용)
            if (isFirstFrame)
            {
                dataRestNeckDir = neckDir;
                dataRestHeadFwd = headForward;
                dataRestHeadUp = headUp;
                isFirstFrame = false;
                Debug.Log($"[HeadResolver] 첫 프레임 기준 캐시 — neckDir: {neckDir}, headFwd: {headForward}");
            }

            // 1. Neck 회전: 첫 프레임 대비 변화량만 적용
            Quaternion neckDelta = Quaternion.FromToRotation(dataRestNeckDir, neckDir);
            neck.rotation = neckDelta * neckRestRot;

            // 2. Head 회전: LookRotation delta 적용
            if (headForward.sqrMagnitude > 0.001f && headUp.sqrMagnitude > 0.001f)
            {
                Quaternion currentHeadRot = Quaternion.LookRotation(headForward, headUp);
                Quaternion restHeadDataRot = Quaternion.LookRotation(dataRestHeadFwd, dataRestHeadUp);
                // 데이터 공간에서의 회전 변화량
                Quaternion headDelta = currentHeadRot * Quaternion.Inverse(restHeadDataRot);
                head.rotation = headDelta * headRestRot;
            }
        }
    }
}
