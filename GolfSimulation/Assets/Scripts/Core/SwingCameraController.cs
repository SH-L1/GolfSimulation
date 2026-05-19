using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace GolfSimulation.Core
{
    public class SwingCameraController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Animator targetAnimator;
        [SerializeField] private Transform target;

        [Header("View")]
        [SerializeField] private Vector3 pivotOffset = new Vector3(0f, 1.05f, 0f);
        [SerializeField][Min(0.5f)] private float distance = 3f;
        [SerializeField] private float verticalOffset = 0f;
        [SerializeField][Range(1f, 30f)] private float followSharpness = 14f;

        [Header("Input")]
        [SerializeField] private bool cycleOnTap = true;
        [SerializeField][Min(1f)] private float tapMoveTolerance = 18f;

        [Header("Preset Angles")]
        [SerializeField] private float[] yawOffsets =
        {
            0f, 45f, 90f, 135f, 180f, -135f, -90f, -45f
        };

        private int viewIndex;
        private bool pointerDown;
        private Vector2 pointerDownPosition;

        private void Awake()
        {
            ResolveTarget();
            viewIndex = 0;
            ApplyCamera(true);
        }

        private void LateUpdate()
        {
            ResolveTarget();
            HandleTapInput();
            ApplyCamera(false);
        }

        public void NextCameraView(string _ = "")
        {
            SetViewIndex(viewIndex + 1);
        }

        public void ResetToRearView(string _ = "")
        {
            SetViewIndex(0);
        }

        public void SetCameraView(string view)
        {
            if (string.IsNullOrWhiteSpace(view))
            {
                return;
            }

            string normalized = view.Trim().ToLowerInvariant();
            if (int.TryParse(normalized, out int parsedIndex))
            {
                SetViewIndex(parsedIndex);
                return;
            }

            switch (normalized)
            {
                case "rear":
                case "back":
                case "behind":
                case "default":
                    SetViewIndex(0);
                    break;
                case "right":
                    SetViewIndex(2);
                    break;
                case "front":
                    SetViewIndex(4);
                    break;
                case "left":
                    SetViewIndex(6);
                    break;
            }
        }

        private void SetViewIndex(int nextIndex)
        {
            if (yawOffsets == null || yawOffsets.Length == 0)
            {
                viewIndex = 0;
                return;
            }

            viewIndex = ((nextIndex % yawOffsets.Length) + yawOffsets.Length) % yawOffsets.Length;
        }

        private void ResolveTarget()
        {
            if (target != null)
            {
                return;
            }

            if (targetAnimator == null)
            {
                targetAnimator = FindFirstObjectByType<Animator>();
            }

            if (targetAnimator != null)
            {
                target = targetAnimator.transform;
            }
        }

        private void HandleTapInput()
        {
            if (!cycleOnTap)
            {
                return;
            }

#if ENABLE_INPUT_SYSTEM
            HandleInputSystemTap();
#elif ENABLE_LEGACY_INPUT_MANAGER
            HandleLegacyTap();
#endif
        }

#if ENABLE_INPUT_SYSTEM
        private void HandleInputSystemTap()
        {
            if (TryGetTouchInput(out Vector2 touchPosition, out bool touchPressed, out bool touchReleased))
            {
                UpdateTapState(touchPosition, touchPressed, touchReleased);
                return;
            }

            if (Mouse.current != null)
            {
                Vector2 mousePosition = Mouse.current.position.ReadValue();
                UpdateTapState(
                    mousePosition,
                    Mouse.current.leftButton.wasPressedThisFrame,
                    Mouse.current.leftButton.wasReleasedThisFrame);
            }
        }

        private static bool TryGetTouchInput(out Vector2 position, out bool pressed, out bool released)
        {
            position = Vector2.zero;
            pressed = false;
            released = false;

            if (Touchscreen.current == null)
            {
                return false;
            }

            var touch = Touchscreen.current.primaryTouch;
            pressed = touch.press.wasPressedThisFrame;
            released = touch.press.wasReleasedThisFrame;

            if (!pressed && !released && !touch.press.isPressed)
            {
                return false;
            }

            position = touch.position.ReadValue();
            return true;
        }
#endif

#if ENABLE_LEGACY_INPUT_MANAGER
        private void HandleLegacyTap()
        {
            if (Input.touchCount > 0)
            {
                Touch touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Began)
                {
                    UpdateTapState(touch.position, true, false);
                }
                else if (touch.phase == TouchPhase.Ended)
                {
                    UpdateTapState(touch.position, false, true);
                }
                else if (touch.phase == TouchPhase.Canceled)
                {
                    pointerDown = false;
                }

                return;
            }

            UpdateTapState(Input.mousePosition, Input.GetMouseButtonDown(0), Input.GetMouseButtonUp(0));
        }
#endif

        private void UpdateTapState(Vector2 position, bool pressed, bool released)
        {
            if (pressed)
            {
                pointerDown = true;
                pointerDownPosition = position;
            }
            else if (pointerDown && released)
            {
                pointerDown = false;
                if ((position - pointerDownPosition).magnitude <= tapMoveTolerance)
                {
                    NextCameraView();
                }
            }
        }

        private void ApplyCamera(bool snap)
        {
            if (target == null)
            {
                return;
            }

            Vector3 pivot = target.position + pivotOffset;
            Vector3 flatForward = Vector3.ProjectOnPlane(target.forward, Vector3.up);
            if (flatForward.sqrMagnitude < 0.0001f)
            {
                flatForward = Vector3.forward;
            }

            float yaw = yawOffsets != null && yawOffsets.Length > 0 ? yawOffsets[viewIndex] : 0f;
            Vector3 rearDirection = -flatForward.normalized;
            Vector3 cameraDirection = Quaternion.AngleAxis(yaw, Vector3.up) * rearDirection;
            Vector3 desiredPosition = pivot + cameraDirection.normalized * distance + Vector3.up * verticalOffset;
            Quaternion desiredRotation = Quaternion.LookRotation((pivot - desiredPosition).normalized, Vector3.up);

            if (snap)
            {
                transform.SetPositionAndRotation(desiredPosition, desiredRotation);
                return;
            }

            float t = 1f - Mathf.Exp(-followSharpness * Time.deltaTime);
            transform.position = Vector3.Lerp(transform.position, desiredPosition, t);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, t);
        }
    }
}
