using GolfSimulation.Core;
using UnityEngine;

namespace GolfSimulation.Filter
{
    public class FilterTunerUI : MonoBehaviour
    {
        [SerializeField] private SwingPlayer swingPlayer;

        private bool showPanel = true;
        private Rect windowRect = new Rect(Screen.width - 330, 10, 320, 280);

        private void Start()
        {
            if (swingPlayer == null)
                swingPlayer = FindFirstObjectByType<SwingPlayer>();
        }

        private void OnGUI()
        {
            if (swingPlayer == null) return;

            if (GUI.Button(new Rect(Screen.width - 160, Screen.height - 40, 150, 30), showPanel ? "Hide Filter UI" : "Show Filter UI"))
                showPanel = !showPanel;

            if (showPanel)
                windowRect = GUI.Window(9001, windowRect, DrawWindow, "Filter Tuner");
        }

        private void DrawWindow(int id)
        {
            GUILayout.Space(5);

            bool interp = GUILayout.Toggle(swingPlayer.EnableInterpolation, " Interpolation (29.97fps → 60fps+)");
            swingPlayer.EnableInterpolation = interp;

            GUILayout.Space(5);

            bool filter = GUILayout.Toggle(swingPlayer.EnableFilter, " One Euro Filter");
            swingPlayer.EnableFilter = filter;

            GUILayout.Space(10);

            GUI.enabled = filter;

            GUILayout.Label($"Min Cutoff: {swingPlayer.FilterMinCutoff:F2}");
            GUILayout.Label("  Low = smooth, High = responsive");
            swingPlayer.FilterMinCutoff = GUILayout.HorizontalSlider(swingPlayer.FilterMinCutoff, 0.01f, 10f);

            GUILayout.Space(5);

            GUILayout.Label($"Beta (Speed Coeff): {swingPlayer.FilterBeta:F4}");
            GUILayout.Label("  Low = always smooth, High = fast-motion responsive");
            swingPlayer.FilterBeta = GUILayout.HorizontalSlider(swingPlayer.FilterBeta, 0f, 1f);

            GUILayout.Space(5);

            GUILayout.Label($"D Cutoff: {swingPlayer.FilterDCutoff:F2}");
            swingPlayer.FilterDCutoff = GUILayout.HorizontalSlider(swingPlayer.FilterDCutoff, 0.1f, 5f);

            GUI.enabled = true;

            GUILayout.Space(10);

            if (GUILayout.Button("Reset to Defaults"))
            {
                swingPlayer.FilterMinCutoff = 1.0f;
                swingPlayer.FilterBeta = 0.007f;
                swingPlayer.FilterDCutoff = 1.0f;
            }

            GUI.DragWindow();
        }
    }
}
