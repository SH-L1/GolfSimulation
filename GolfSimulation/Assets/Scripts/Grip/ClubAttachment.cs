using UnityEngine;

namespace GolfSimulation.Grip
{
    [DefaultExecutionOrder(210)]
    public class ClubAttachment : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Animator animator;
        [SerializeField] private GameObject clubModel;
        [SerializeField] private HumanBodyBones attachBone = HumanBodyBones.LeftHand;

        [Header("Offset (Hand Local Space)")]
        [SerializeField] private Vector3 positionOffset = new Vector3(0.02f, 0.08f, 0.02f);
        [SerializeField] private Vector3 rotationOffset = new Vector3(0f, 0f, 90f);

        [Header("Procedural Club (used if Club Model is empty)")]
        [SerializeField] private bool createProcedural = true;
        [SerializeField] private float shaftLength = 1.1f;
        [SerializeField] private float shaftDiameter = 0.012f;
        [SerializeField] private float gripLength = 0.28f;
        [SerializeField] private float gripDiameter = 0.022f;
        [SerializeField] private Vector3 headSize = new Vector3(0.09f, 0.02f, 0.065f);
        [SerializeField] private float headAngle = 12f;
        [SerializeField] private float headOffsetX = 0.035f;

        private Transform attachTransform;
        private GameObject clubInstance;

        private void Start()
        {
            if (animator == null)
                animator = GetComponentInChildren<Animator>();

            if (animator == null)
            {
                Debug.LogError("[ClubAttachment] Animator를 찾을 수 없습니다.");
                return;
            }

            attachTransform = animator.GetBoneTransform(attachBone);
            if (attachTransform == null)
            {
                Debug.LogError($"[ClubAttachment] {attachBone} 본을 찾을 수 없습니다.");
                return;
            }

            if (clubModel != null)
            {
                clubInstance = Instantiate(clubModel);
            }
            else if (createProcedural)
            {
                clubInstance = BuildProceduralClub();
            }

            if (clubInstance != null)
            {
                clubInstance.transform.SetParent(attachTransform, false);
                clubInstance.transform.localPosition = positionOffset;
                clubInstance.transform.localRotation = Quaternion.Euler(rotationOffset);
                Debug.Log($"[ClubAttachment] 클럽 부착 완료 — bone: {attachBone}, procedural: {clubModel == null}");
            }
        }

        private GameObject BuildProceduralClub()
        {
            var root = new GameObject("GolfClub_Procedural");

            Material shaftMat = CreateURPMaterial(new Color(0.75f, 0.75f, 0.78f));
            Material gripMat = CreateURPMaterial(new Color(0.15f, 0.15f, 0.15f));
            Material headMat = CreateURPMaterial(new Color(0.35f, 0.35f, 0.38f));

            var shaft = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            shaft.name = "Shaft";
            shaft.transform.SetParent(root.transform, false);
            shaft.transform.localPosition = new Vector3(0f, -shaftLength * 0.5f, 0f);
            shaft.transform.localScale = new Vector3(shaftDiameter, shaftLength * 0.5f, shaftDiameter);
            shaft.GetComponent<Renderer>().sharedMaterial = shaftMat;
            Object.Destroy(shaft.GetComponent<Collider>());

            var grip = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            grip.name = "Grip";
            grip.transform.SetParent(root.transform, false);
            grip.transform.localPosition = new Vector3(0f, -gripLength * 0.5f, 0f);
            grip.transform.localScale = new Vector3(gripDiameter, gripLength * 0.5f, gripDiameter);
            grip.GetComponent<Renderer>().sharedMaterial = gripMat;
            Object.Destroy(grip.GetComponent<Collider>());

            var head = GameObject.CreatePrimitive(PrimitiveType.Cube);
            head.name = "ClubHead";
            head.transform.SetParent(root.transform, false);
            head.transform.localPosition = new Vector3(headOffsetX, -shaftLength, 0f);
            head.transform.localScale = headSize;
            head.transform.localRotation = Quaternion.Euler(0f, 0f, headAngle);
            head.GetComponent<Renderer>().sharedMaterial = headMat;
            Object.Destroy(head.GetComponent<Collider>());

            return root;
        }

        private Material CreateURPMaterial(Color color)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
                shader = Shader.Find("Standard");

            var mat = new Material(shader);
            mat.color = color;

            if (mat.HasProperty("_Metallic"))
                mat.SetFloat("_Metallic", 0.6f);
            if (mat.HasProperty("_Smoothness"))
                mat.SetFloat("_Smoothness", 0.7f);

            return mat;
        }

        public void SetOffset(Vector3 position, Vector3 eulerRotation)
        {
            positionOffset = position;
            rotationOffset = eulerRotation;

            if (clubInstance != null)
            {
                clubInstance.transform.localPosition = positionOffset;
                clubInstance.transform.localRotation = Quaternion.Euler(rotationOffset);
            }
        }

        private void OnDestroy()
        {
            if (clubInstance != null)
                Destroy(clubInstance);
        }
    }
}
