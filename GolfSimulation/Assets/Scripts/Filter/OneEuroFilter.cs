using UnityEngine;

namespace GolfSimulation.Filter
{
    public class OneEuroFilter
    {
        private float minCutoff;
        private float beta;
        private float dCutoff;

        private float prevValue;
        private float prevDerivative;
        private float prevTimestamp;
        private bool initialized;

        public OneEuroFilter(float minCutoff = 1.0f, float beta = 0.007f, float dCutoff = 1.0f)
        {
            this.minCutoff = minCutoff;
            this.beta = beta;
            this.dCutoff = dCutoff;
            initialized = false;
        }

        private float SmoothingFactor(float cutoff, float dt)
        {
            float r = 2.0f * Mathf.PI * cutoff * dt;
            return r / (r + 1.0f);
        }

        public float Filter(float value, float timestamp)
        {
            if (!initialized)
            {
                prevValue = value;
                prevDerivative = 0f;
                prevTimestamp = timestamp;
                initialized = true;
                return value;
            }

            float dt = timestamp - prevTimestamp;
            if (dt <= 0f) dt = 1f / 60f;
            prevTimestamp = timestamp;

            float dAlpha = SmoothingFactor(dCutoff, dt);
            float derivative = (value - prevValue) / dt;
            float filteredDerivative = dAlpha * derivative + (1f - dAlpha) * prevDerivative;
            prevDerivative = filteredDerivative;

            float cutoff = minCutoff + beta * Mathf.Abs(filteredDerivative);
            float alpha = SmoothingFactor(cutoff, dt);

            float filteredValue = alpha * value + (1f - alpha) * prevValue;
            prevValue = filteredValue;

            return filteredValue;
        }

        public void UpdateParams(float minCutoff, float beta, float dCutoff)
        {
            this.minCutoff = minCutoff;
            this.beta = beta;
            this.dCutoff = dCutoff;
        }

        public void Reset()
        {
            initialized = false;
        }
    }
}
