using UnityEngine;

namespace GolfSimulation.Grip
{
    [DefaultExecutionOrder(200)]
    public class GripController : MonoBehaviour
    {
        [SerializeField] private Animator animator;
        [SerializeField] private bool enableGrip = true;

        [Header("Curl Axis (Finger Local Space)")]
        [SerializeField] private Vector3 fingerCurlAxis = new Vector3(0f, 0f, -1f);
        [SerializeField] private Vector3 thumbCurlAxis = new Vector3(0f, 0f, -1f);

        [Header("Left Hand — Curl (degrees)")]
        [SerializeField][Range(0f, 90f)] private float leftThumbCurl = 25f;
        [SerializeField][Range(0f, 90f)] private float leftIndexCurl = 65f;
        [SerializeField][Range(0f, 90f)] private float leftMiddleCurl = 75f;
        [SerializeField][Range(0f, 90f)] private float leftRingCurl = 80f;
        [SerializeField][Range(0f, 90f)] private float leftLittleCurl = 85f;

        [Header("Right Hand — Curl (degrees)")]
        [SerializeField][Range(0f, 90f)] private float rightThumbCurl = 30f;
        [SerializeField][Range(0f, 90f)] private float rightIndexCurl = 55f;
        [SerializeField][Range(0f, 90f)] private float rightMiddleCurl = 70f;
        [SerializeField][Range(0f, 90f)] private float rightRingCurl = 75f;
        [SerializeField][Range(0f, 90f)] private float rightLittleCurl = 85f;

        [Header("Spread (degrees, Proximal only)")]
        [SerializeField][Range(-15f, 15f)] private float spreadPerFinger = 3f;

        [Header("Joint Weight Distribution")]
        [SerializeField][Range(0f, 1f)] private float proximalWeight = 0.7f;
        [SerializeField][Range(0f, 1f)] private float intermediateWeight = 0.9f;
        [SerializeField][Range(0f, 1f)] private float distalWeight = 0.5f;

        private struct FingerChain
        {
            public Transform proximal;
            public Transform intermediate;
            public Transform distal;
            public Quaternion proximalRest;
            public Quaternion intermediateRest;
            public Quaternion distalRest;
        }

        private FingerChain[] leftFingers;
        private FingerChain[] rightFingers;
        private bool isInitialized;

        private static readonly HumanBodyBones[,] LeftFingerBones =
        {
            { HumanBodyBones.LeftThumbProximal, HumanBodyBones.LeftThumbIntermediate, HumanBodyBones.LeftThumbDistal },
            { HumanBodyBones.LeftIndexProximal, HumanBodyBones.LeftIndexIntermediate, HumanBodyBones.LeftIndexDistal },
            { HumanBodyBones.LeftMiddleProximal, HumanBodyBones.LeftMiddleIntermediate, HumanBodyBones.LeftMiddleDistal },
            { HumanBodyBones.LeftRingProximal, HumanBodyBones.LeftRingIntermediate, HumanBodyBones.LeftRingDistal },
            { HumanBodyBones.LeftLittleProximal, HumanBodyBones.LeftLittleIntermediate, HumanBodyBones.LeftLittleDistal },
        };

        private static readonly HumanBodyBones[,] RightFingerBones =
        {
            { HumanBodyBones.RightThumbProximal, HumanBodyBones.RightThumbIntermediate, HumanBodyBones.RightThumbDistal },
            { HumanBodyBones.RightIndexProximal, HumanBodyBones.RightIndexIntermediate, HumanBodyBones.RightIndexDistal },
            { HumanBodyBones.RightMiddleProximal, HumanBodyBones.RightMiddleIntermediate, HumanBodyBones.RightMiddleDistal },
            { HumanBodyBones.RightRingProximal, HumanBodyBones.RightRingIntermediate, HumanBodyBones.RightRingDistal },
            { HumanBodyBones.RightLittleProximal, HumanBodyBones.RightLittleIntermediate, HumanBodyBones.RightLittleDistal },
        };

        private void Start()
        {
            if (animator == null)
                animator = GetComponentInChildren<Animator>();

            if (animator == null)
            {
                Debug.LogError("[GripController] Animator를 찾을 수 없습니다.");
                return;
            }

            leftFingers = BuildChains(LeftFingerBones);
            rightFingers = BuildChains(RightFingerBones);

            isInitialized = true;
            Debug.Log($"[GripController] 초기화 완료 — 좌 {CountValid(leftFingers)}개, 우 {CountValid(rightFingers)}개 손가락 체인");
        }

        private FingerChain[] BuildChains(HumanBodyBones[,] bones)
        {
            var chains = new FingerChain[5];
            for (int i = 0; i < 5; i++)
            {
                chains[i].proximal = animator.GetBoneTransform(bones[i, 0]);
                chains[i].intermediate = animator.GetBoneTransform(bones[i, 1]);
                chains[i].distal = animator.GetBoneTransform(bones[i, 2]);

                if (chains[i].proximal != null) chains[i].proximalRest = chains[i].proximal.localRotation;
                if (chains[i].intermediate != null) chains[i].intermediateRest = chains[i].intermediate.localRotation;
                if (chains[i].distal != null) chains[i].distalRest = chains[i].distal.localRotation;
            }
            return chains;
        }

        private int CountValid(FingerChain[] chains)
        {
            int c = 0;
            foreach (var ch in chains)
                if (ch.proximal != null) c++;
            return c;
        }

        private void LateUpdate()
        {
            if (!isInitialized || !enableGrip) return;

            float[] leftCurls = { leftThumbCurl, leftIndexCurl, leftMiddleCurl, leftRingCurl, leftLittleCurl };
            float[] rightCurls = { rightThumbCurl, rightIndexCurl, rightMiddleCurl, rightRingCurl, rightLittleCurl };

            for (int i = 0; i < 5; i++)
            {
                ApplyFinger(leftFingers[i], leftCurls[i], i == 0, (i - 2) * spreadPerFinger);
                ApplyFinger(rightFingers[i], rightCurls[i], i == 0, (i - 2) * -spreadPerFinger);
            }
        }

        private void ApplyFinger(FingerChain chain, float curlDeg, bool isThumb, float spreadDeg)
        {
            Vector3 axis = isThumb ? thumbCurlAxis.normalized : fingerCurlAxis.normalized;

            if (chain.proximal != null)
            {
                Quaternion curl = Quaternion.AngleAxis(curlDeg * proximalWeight, axis);
                Quaternion spread = Quaternion.AngleAxis(spreadDeg, Vector3.up);
                chain.proximal.localRotation = chain.proximalRest * spread * curl;
            }
            if (chain.intermediate != null)
            {
                Quaternion curl = Quaternion.AngleAxis(curlDeg * intermediateWeight, axis);
                chain.intermediate.localRotation = chain.intermediateRest * curl;
            }
            if (chain.distal != null)
            {
                Quaternion curl = Quaternion.AngleAxis(curlDeg * distalWeight, axis);
                chain.distal.localRotation = chain.distalRest * curl;
            }
        }
    }
}
