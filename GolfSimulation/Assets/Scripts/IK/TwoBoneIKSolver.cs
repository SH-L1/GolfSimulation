using UnityEngine;

namespace GolfSimulation.IK
{
    /// <summary>
    /// Two-Bone IK 솔버.
    /// root(어깨/힙) → mid(팔꿈치/무릎) → tip(손목/발목) 체인에 대해
    /// target 위치와 hint(벤드 방향)를 기반으로 관절 회전을 계산한다.
    /// animator.enabled = false 환경에서 독립 동작한다.
    /// </summary>
    public static class TwoBoneIKSolver
    {
        /// <summary>
        /// Two-Bone IK를 풀고 root, mid 본의 rotation을 직접 설정한다.
        /// </summary>
        /// <param name="root">상위 본 (UpperArm / UpperLeg)</param>
        /// <param name="mid">중간 본 (LowerArm / LowerLeg)</param>
        /// <param name="tip">말단 본 (Hand / Foot)</param>
        /// <param name="targetPos">말단이 도달할 목표 위치</param>
        /// <param name="hintPos">중간 관절의 벤드 방향 힌트</param>
        public static void Solve(Transform root, Transform mid, Transform tip,
                                  Vector3 targetPos, Vector3 hintPos)
        {
            if (root == null || mid == null || tip == null) return;

            // 체인 길이 (본 길이는 고정, 위치에서 계산)
            float upperLen = Vector3.Distance(root.position, mid.position);
            float lowerLen = Vector3.Distance(mid.position, tip.position);

            // root → target 방향 및 거리
            Vector3 rootToTarget = targetPos - root.position;
            float targetDist = rootToTarget.magnitude;

            // 도달 불가 시 클램프 (완전 펴짐 / 완전 접힘 방지)
            float maxReach = upperLen + lowerLen - 0.001f;
            float minReach = Mathf.Abs(upperLen - lowerLen) + 0.001f;
            targetDist = Mathf.Clamp(targetDist, minReach, maxReach);

            // root → target 방향 (클램프 후)
            Vector3 targetDir = rootToTarget.normalized;

            // === 1단계: root 각도 계산 (Law of Cosines) ===
            // root에서의 각도: upper 변과 target 변 사이
            float cosRoot = (upperLen * upperLen + targetDist * targetDist - lowerLen * lowerLen)
                            / (2f * upperLen * targetDist);
            cosRoot = Mathf.Clamp(cosRoot, -1f, 1f);
            float rootAngleRad = Mathf.Acos(cosRoot);

            // === 2단계: 벤드 평면 결정 (hint 기반) ===
            // hint 방향을 target 축에 대해 직교 분해하여 벤드 방향 추출
            Vector3 rootToHint = hintPos - root.position;
            Vector3 hintOnTarget = Vector3.Project(rootToHint, targetDir);
            Vector3 bendNormal = (rootToHint - hintOnTarget).normalized;

            // 벤드 방향이 불충분한 경우 (hint가 축 위에 있음) 폴백
            if (bendNormal.sqrMagnitude < 0.001f)
            {
                // 현재 mid 위치 기반 폴백
                Vector3 currentBend = mid.position - root.position;
                Vector3 currentBendProj = currentBend - Vector3.Project(currentBend, targetDir);
                bendNormal = currentBendProj.normalized;

                if (bendNormal.sqrMagnitude < 0.001f)
                    bendNormal = Vector3.Cross(targetDir, Vector3.up).normalized;
            }

            // === 3단계: root 본 회전 ===
            // target 방향에서 벤드 방향으로 rootAngle만큼 회전 → mid가 위치할 방향
            Vector3 bendAxis = Vector3.Cross(targetDir, bendNormal).normalized;
            Vector3 upperDir = Quaternion.AngleAxis(rootAngleRad * Mathf.Rad2Deg, bendAxis) * targetDir;

            // root의 현재 upper 방향 (root→mid)에서 계산된 방향으로 회전
            Vector3 currentUpperDir = (mid.position - root.position).normalized;
            Quaternion rootDelta = Quaternion.FromToRotation(currentUpperDir, upperDir);
            root.rotation = rootDelta * root.rotation;

            // === 4단계: mid 본 회전 ===
            // root 회전 후 tip 위치가 변경되었으므로, mid→tip이 target을 향하도록 회전
            Vector3 currentLowerDir = (tip.position - mid.position).normalized;
            Vector3 desiredLowerDir = (targetPos - mid.position).normalized;
            Quaternion midDelta = Quaternion.FromToRotation(currentLowerDir, desiredLowerDir);
            mid.rotation = midDelta * mid.rotation;
        }
    }
}
