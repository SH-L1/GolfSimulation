# golf_swing_pose.json Frame Analysis

Source: C:/Users/user/Documents/GitHub/GolfSimulation/GolfSimulation/Assets/StreamingAssets/golf_swing_pose.json
Video: 19_square, fps: 29.97, frames: 132

## Event Frames

| event | frame | confidence |
|---|---:|---:|
| address | 0 | 0.9978 |
| toe_up | 36 | 0.9506 |
| mid_backswing | 42 | 0.6661 |
| top | 49 | 0.2882 |
| mid_downswing | 55 | 0.8544 |
| impact | 62 | 0.9924 |
| mid_followthrough | 65 | 0.9788 |
| finish | 128 | 0.2208 |

## Tag Meaning

- `grip_wide`: wrist distance is high relative to shoulder width.
- `joint_jump:*`: the biggest frame-to-frame jump is above the sequence outlier threshold.
- `bone_len:*`: one limb segment deviates strongly from its sequence median length.
- `trunk_back_z`: shoulder center is shifted backward in z relative to hips by the configured proxy threshold.
- `head_hand_opposite`: head direction proxy and hand lateral side have opposite signs.
- `many_pred_corr`: frame is heavily postprocessed; omitted from the per-frame issue column because it applies to every frame.

## Frame Table

| frame | orig | phase | issue | grip | handDepthZ | LwZ | RwZ | trunkPitchZ | headYawProxy | jump | jumpJoint | boneDev | bone | pred | corr |
|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---:|
| 0 | 18 | address | ok | 0.654 | -0.035 | -0.009 | -0.061 | 8.7 | -177.9 | 0 |  | 0.075 | right_shoulder-right_elbow | 4 | 4 |
| 1 | 19 | takeaway | ok | 0.654 | -0.035 | -0.009 | -0.06 | 8.8 | -177.9 | 0.0007 | left_elbow | 0.075 | right_shoulder-right_elbow | 4 | 4 |
| 2 | 20 | takeaway | ok | 0.655 | -0.034 | -0.009 | -0.06 | 8.9 | -178 | 0.0008 | left_elbow | 0.075 | right_shoulder-right_elbow | 4 | 4 |
| 3 | 21 | takeaway | ok | 0.655 | -0.034 | -0.008 | -0.059 | 8.9 | -178.1 | 0.0009 | left_shoulder | 0.075 | right_shoulder-right_elbow | 4 | 4 |
| 4 | 22 | takeaway | ok | 0.655 | -0.033 | -0.008 | -0.059 | 8.8 | -178.2 | 0.0009 | left_shoulder | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 5 | 23 | takeaway | ok | 0.655 | -0.033 | -0.007 | -0.058 | 8.7 | -178.3 | 0.0009 | left_shoulder | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 6 | 24 | takeaway | ok | 0.656 | -0.032 | -0.007 | -0.058 | 8.6 | -178.4 | 0.0009 | left_shoulder | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 7 | 25 | takeaway | ok | 0.657 | -0.032 | -0.007 | -0.057 | 8.5 | -178.5 | 0.0009 | left_shoulder | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 8 | 26 | takeaway | ok | 0.657 | -0.031 | -0.007 | -0.056 | 8.3 | -178.5 | 0.0009 | right_hip | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 9 | 27 | takeaway | ok | 0.658 | -0.031 | -0.006 | -0.055 | 8.2 | -178.6 | 0.0009 | right_hip | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 10 | 28 | takeaway | ok | 0.66 | -0.03 | -0.006 | -0.055 | 8.1 | -178.6 | 0.0009 | right_hip | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 11 | 29 | takeaway | ok | 0.661 | -0.03 | -0.005 | -0.054 | 8 | -178.6 | 0.0009 | right_hip | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 12 | 30 | takeaway | ok | 0.662 | -0.029 | -0.004 | -0.054 | 7.9 | -178.6 | 0.0008 | right_hip | 0.077 | right_shoulder-right_elbow | 4 | 4 |
| 13 | 31 | takeaway | ok | 0.663 | -0.028 | -0.004 | -0.053 | 7.8 | -178.5 | 0.0009 | right_hip | 0.077 | right_shoulder-right_elbow | 4 | 4 |
| 14 | 32 | takeaway | ok | 0.664 | -0.028 | -0.003 | -0.053 | 7.6 | -178.5 | 0.0009 | right_hip | 0.077 | right_shoulder-right_elbow | 4 | 4 |
| 15 | 33 | takeaway | head_hand_opposite | 0.665 | -0.027 | -0.002 | -0.053 | 7.5 | -178.4 | 0.001 | left_elbow | 0.077 | right_shoulder-right_elbow | 4 | 4 |
| 16 | 34 | takeaway | head_hand_opposite | 0.667 | -0.027 | -0.001 | -0.052 | 7.3 | -178.3 | 0.0011 | left_elbow | 0.076 | right_shoulder-right_elbow | 4 | 4 |
| 17 | 35 | takeaway | head_hand_opposite | 0.669 | -0.026 | 0 | -0.052 | 7.1 | -178.3 | 0.0013 | left_elbow | 0.075 | right_shoulder-right_elbow | 4 | 4 |
| 18 | 36 | takeaway | head_hand_opposite | 0.672 | -0.025 | 0.001 | -0.051 | 7 | -178.2 | 0.0014 | left_elbow | 0.074 | right_shoulder-right_elbow | 4 | 4 |
| 19 | 37 | takeaway | head_hand_opposite | 0.674 | -0.024 | 0.002 | -0.05 | 6.9 | -178.1 | 0.0015 | left_elbow | 0.073 | right_shoulder-right_elbow | 4 | 4 |
| 20 | 38 | takeaway | head_hand_opposite | 0.677 | -0.023 | 0.004 | -0.049 | 6.9 | -178.1 | 0.0017 | left_wrist | 0.071 | right_shoulder-right_elbow | 4 | 4 |
| 21 | 39 | takeaway | head_hand_opposite | 0.679 | -0.021 | 0.005 | -0.048 | 6.9 | -178.1 | 0.002 | left_wrist | 0.069 | right_shoulder-right_elbow | 4 | 4 |
| 22 | 40 | takeaway | ok | 0.681 | -0.02 | 0.007 | -0.047 | 7 | -178.1 | 0.0022 | left_wrist | 0.068 | right_shoulder-right_elbow | 4 | 4 |
| 23 | 41 | takeaway | ok | 0.682 | -0.018 | 0.009 | -0.045 | 7.1 | -178.1 | 0.0024 | left_wrist | 0.071 | left_elbow-left_wrist | 4 | 4 |
| 24 | 42 | takeaway | ok | 0.684 | -0.016 | 0.012 | -0.044 | 7.2 | -178.1 | 0.0025 | left_wrist | 0.074 | left_elbow-left_wrist | 4 | 4 |
| 25 | 43 | takeaway | ok | 0.685 | -0.014 | 0.014 | -0.043 | 7.2 | -178.1 | 0.0026 | left_wrist | 0.077 | left_elbow-left_wrist | 4 | 4 |
| 26 | 44 | takeaway | ok | 0.686 | -0.013 | 0.016 | -0.041 | 7.2 | -178.2 | 0.0029 | left_wrist | 0.08 | left_elbow-left_wrist | 4 | 4 |
| 27 | 45 | takeaway | ok | 0.688 | -0.011 | 0.018 | -0.04 | 7 | -178.2 | 0.0037 | left_wrist | 0.084 | left_elbow-left_wrist | 4 | 4 |
| 28 | 46 | takeaway | ok | 0.69 | -0.009 | 0.021 | -0.038 | 6.8 | -178.1 | 0.0049 | left_wrist | 0.087 | left_elbow-left_wrist | 4 | 4 |
| 29 | 47 | takeaway | ok | 0.692 | -0.006 | 0.023 | -0.036 | 6.5 | -178.1 | 0.0063 | left_wrist | 0.09 | left_elbow-left_wrist | 4 | 4 |
| 30 | 48 | takeaway | ok | 0.695 | -0.003 | 0.027 | -0.033 | 6.2 | -178 | 0.0074 | left_wrist | 0.091 | left_elbow-left_wrist | 4 | 4 |
| 31 | 49 | takeaway | ok | 0.699 | 0.001 | 0.03 | -0.029 | 5.8 | -177.8 | 0.0081 | left_wrist | 0.09 | left_elbow-left_wrist | 4 | 6 |
| 32 | 50 | takeaway | ok | 0.703 | 0.005 | 0.034 | -0.025 | 5.5 | -177.6 | 0.0083 | left_wrist | 0.088 | left_elbow-left_wrist | 4 | 4 |
| 33 | 51 | takeaway | ok | 0.707 | 0.009 | 0.038 | -0.021 | 5.3 | -177.3 | 0.0086 | left_wrist | 0.085 | left_elbow-left_wrist | 4 | 4 |
| 34 | 52 | takeaway | ok | 0.711 | 0.013 | 0.042 | -0.017 | 5.1 | -176.9 | 0.0092 | left_wrist | 0.082 | left_elbow-left_wrist | 4 | 4 |
| 35 | 53 | takeaway | ok | 0.716 | 0.016 | 0.045 | -0.013 | 5.1 | -176.4 | 0.0101 | left_wrist | 0.078 | left_elbow-left_wrist | 4 | 4 |
| 36 | 54 | takeaway | ok | 0.724 | 0.019 | 0.048 | -0.01 | 5.1 | -175.8 | 0.0113 | left_wrist | 0.073 | left_elbow-left_wrist | 4 | 4 |
| 37 | 55 | mid_back | ok | 0.737 | 0.022 | 0.051 | -0.008 | 5.2 | -175.1 | 0.0126 | left_wrist | 0.067 | left_elbow-left_wrist | 4 | 4 |
| 38 | 56 | mid_back | ok | 0.757 | 0.024 | 0.053 | -0.006 | 5.3 | -174.2 | 0.0139 | left_wrist | 0.085 | right_elbow-right_wrist | 4 | 4 |
| 39 | 57 | mid_back | ok | 0.785 | 0.025 | 0.055 | -0.005 | 5.4 | -173.2 | 0.0148 | left_wrist | 0.119 | right_elbow-right_wrist | 4 | 6 |
| 40 | 58 | mid_back | ok | 0.822 | 0.027 | 0.057 | -0.004 | 5.5 | -172 | 0.0153 | left_wrist | 0.158 | right_elbow-right_wrist | 4 | 6 |
| 41 | 59 | mid_back | ok | 0.862 | 0.028 | 0.059 | -0.003 | 5.4 | -170.5 | 0.0149 | left_wrist | 0.197 | right_elbow-right_wrist | 4 | 6 |
| 42 | 60 | mid_back | bone_len:right_elbow-right_wrist | 0.896 | 0.029 | 0.061 | -0.004 | 5.2 | -168.8 | 0.0138 | left_wrist | 0.229 | right_elbow-right_wrist | 4 | 8 |
| 43 | 61 | top | bone_len:right_elbow-right_wrist | 0.916 | 0.028 | 0.061 | -0.005 | 4.9 | -166.6 | 0.0125 | left_wrist | 0.25 | right_elbow-right_wrist | 4 | 10 |
| 44 | 62 | top | bone_len:right_elbow-right_wrist | 0.926 | 0.027 | 0.061 | -0.007 | 4.5 | -163.8 | 0.0114 | left_wrist | 0.262 | right_elbow-right_wrist | 4 | 10 |
| 45 | 63 | top | bone_len:right_elbow-right_wrist | 0.93 | 0.025 | 0.06 | -0.009 | 4 | -160.4 | 0.0106 | left_wrist | 0.27 | right_elbow-right_wrist | 4 | 10 |
| 46 | 64 | top | bone_len:right_elbow-right_wrist | 0.935 | 0.024 | 0.059 | -0.011 | 3.4 | -156 | 0.01 | left_wrist | 0.279 | right_elbow-right_wrist | 4 | 10 |
| 47 | 65 | top | bone_len:right_elbow-right_wrist | 0.94 | 0.024 | 0.058 | -0.011 | 2.9 | -150.4 | 0.0093 | left_wrist | 0.29 | right_elbow-right_wrist | 4 | 10 |
| 48 | 66 | top | bone_len:right_elbow-right_wrist | 0.942 | 0.025 | 0.058 | -0.008 | 2.4 | -143.5 | 0.0089 | left_wrist | 0.302 | right_elbow-right_wrist | 4 | 10 |
| 49 | 67 | top | bone_len:right_elbow-right_wrist | 0.92 | 0.025 | 0.056 | -0.005 | 1.9 | -135.5 | 0.0127 | right_wrist | 0.3 | right_elbow-right_wrist | 4 | 8 |
| 50 | 68 | transition | bone_len:right_elbow-right_wrist | 0.879 | 0.023 | 0.052 | -0.005 | 1.5 | -127.2 | 0.0149 | left_wrist | 0.272 | right_elbow-right_wrist | 4 | 8 |
| 51 | 69 | transition | bone_len:right_elbow-right_wrist | 0.866 | 0.023 | 0.05 | -0.005 | 1.2 | -119.9 | 0.0124 | left_wrist | 0.239 | right_elbow-right_wrist | 4 | 10 |
| 52 | 70 | transition | ok | 0.872 | 0.023 | 0.05 | -0.004 | 1.1 | -115.3 | 0.011 | left_elbow | 0.216 | right_elbow-right_wrist | 4 | 10 |
| 53 | 71 | transition | ok | 0.88 | 0.023 | 0.05 | -0.003 | 1.1 | -114.4 | 0.0101 | left_elbow | 0.197 | right_elbow-right_wrist | 4 | 10 |
| 54 | 72 | transition | ok | 0.879 | 0.023 | 0.049 | -0.003 | 1.3 | -117.4 | 0.0073 | left_elbow | 0.174 | right_elbow-right_wrist | 4 | 10 |
| 55 | 73 | transition | ok | 0.864 | 0.023 | 0.048 | -0.002 | 1.7 | -123.8 | 0.0078 | right_elbow | 0.148 | right_elbow-right_wrist | 4 | 10 |
| 56 | 74 | downswing | ok | 0.841 | 0.023 | 0.047 | -0.001 | 2.2 | -132.3 | 0.0079 | right_elbow | 0.125 | right_elbow-right_wrist | 4 | 10 |
| 57 | 75 | downswing | ok | 0.816 | 0.024 | 0.047 | 0.001 | 2.9 | -140.9 | 0.0064 | right_elbow | 0.112 | right_elbow-right_wrist | 4 | 6 |
| 58 | 76 | downswing | ok | 0.799 | 0.026 | 0.049 | 0.003 | 3.8 | -148.5 | 0.0098 | left_wrist | 0.115 | right_elbow-right_wrist | 4 | 6 |
| 59 | 77 | downswing | ok | 0.802 | 0.03 | 0.054 | 0.006 | 4.7 | -154.7 | 0.013 | left_wrist | 0.13 | right_elbow-right_wrist | 4 | 6 |
| 60 | 78 | downswing | ok | 0.812 | 0.034 | 0.06 | 0.008 | 5.6 | -159.4 | 0.0148 | left_wrist | 0.136 | right_elbow-right_wrist | 4 | 6 |
| 61 | 79 | downswing | ok | 0.813 | 0.037 | 0.063 | 0.01 | 6.4 | -163.2 | 0.0217 | left_wrist | 0.132 | right_elbow-right_wrist | 4 | 6 |
| 62 | 80 | downswing | ok | 0.811 | 0.039 | 0.065 | 0.012 | 7.1 | -166.1 | 0.0297 | left_wrist | 0.13 | right_elbow-right_wrist | 4 | 16 |
| 63 | 81 | early_follow | joint_jump:left_wrist | 0.813 | 0.04 | 0.066 | 0.014 | 7.6 | -168.6 | 0.0355 | left_wrist | 0.129 | right_elbow-right_wrist | 4 | 10 |
| 64 | 82 | early_follow | joint_jump:left_wrist | 0.823 | 0.04 | 0.065 | 0.016 | 8.1 | -171 | 0.04 | left_wrist | 0.12 | right_elbow-right_wrist | 4 | 18 |
| 65 | 83 | early_follow | joint_jump:left_wrist|head_hand_opposite | 0.845 | 0.04 | 0.063 | 0.017 | 8.6 | -173.5 | 0.0454 | left_wrist | 0.143 | left_elbow-left_wrist | 4 | 20 |
| 66 | 84 | follow_finish | joint_jump:left_wrist|head_hand_opposite | 0.852 | 0.037 | 0.058 | 0.016 | 9.2 | -176.6 | 0.0517 | left_wrist | 0.154 | left_elbow-left_wrist | 4 | 11 |
| 67 | 85 | follow_finish | joint_jump:left_wrist | 0.809 | 0.031 | 0.049 | 0.013 | 10 | 178.6 | 0.0507 | left_wrist | 0.142 | left_elbow-left_wrist | 4 | 15 |
| 68 | 86 | follow_finish | ok | 0.769 | 0.028 | 0.043 | 0.014 | 11 | 168.3 | 0.0288 | left_wrist | 0.122 | left_elbow-left_wrist | 4 | 15 |
| 69 | 87 | follow_finish | ok | 0.789 | 0.027 | 0.036 | 0.018 | 12.1 | 130.1 | 0.0177 | right_wrist | 0.101 | left_elbow-left_wrist | 4 | 13 |
| 70 | 88 | follow_finish | grip_wide | 1.044 | 0.023 | 0.027 | 0.019 | 13.2 | 51.3 | 0.0179 | right_shoulder | 0.108 | left_elbow-left_wrist | 4 | 17 |
| 71 | 89 | follow_finish | ok | 0.875 | 0.017 | 0.023 | 0.01 | 14.3 | 29.3 | 0.027 | left_wrist | 0.204 | right_elbow-right_wrist | 4 | 16 |
| 72 | 90 | follow_finish | bone_len:right_elbow-right_wrist | 0.815 | 0.014 | 0.024 | 0.004 | 15.1 | 21.7 | 0.0229 | left_wrist | 0.287 | right_elbow-right_wrist | 4 | 15 |
| 73 | 91 | follow_finish | bone_len:right_elbow-right_wrist|head_hand_opposite | 0.901 | 0.015 | 0.027 | 0.003 | 15.7 | 17.5 | 0.0208 | left_wrist | 0.348 | right_elbow-right_wrist | 4 | 14 |
| 74 | 92 | follow_finish | grip_wide|bone_len:right_elbow-right_wrist|head_hand_opposite | 1.161 | 0.015 | 0.031 | 0 | 16 | 14.6 | 0.0205 | left_wrist | 0.406 | right_elbow-right_wrist | 4 | 15 |
| 75 | 93 | follow_finish | grip_wide|bone_len:right_elbow-right_wrist|head_hand_opposite | 1.223 | 0.016 | 0.036 | -0.003 | 16 | 12.2 | 0.0205 | left_wrist | 0.389 | right_elbow-right_wrist | 4 | 15 |
| 76 | 94 | follow_finish | grip_wide|bone_len:right_elbow-right_wrist|head_hand_opposite | 0.998 | 0.017 | 0.042 | -0.008 | 15.8 | 10.1 | 0.0188 | right_elbow | 0.279 | right_elbow-right_wrist | 4 | 14 |
| 77 | 95 | follow_finish | head_hand_opposite | 0.846 | 0.017 | 0.046 | -0.011 | 15.5 | 8.3 | 0.0193 | left_wrist | 0.18 | right_elbow-right_wrist | 4 | 13 |
| 78 | 96 | follow_finish | head_hand_opposite | 0.786 | 0.016 | 0.046 | -0.013 | 15.2 | 6.9 | 0.0195 | left_wrist | 0.13 | right_elbow-right_wrist | 4 | 10 |
| 79 | 97 | follow_finish | head_hand_opposite | 0.764 | 0.015 | 0.043 | -0.014 | 14.9 | 6 | 0.0185 | left_wrist | 0.104 | right_elbow-right_wrist | 4 | 10 |
| 80 | 98 | follow_finish | head_hand_opposite | 0.753 | 0.013 | 0.039 | -0.013 | 14.5 | 5.5 | 0.0151 | left_wrist | 0.082 | right_elbow-right_wrist | 4 | 11 |
| 81 | 99 | follow_finish | head_hand_opposite | 0.75 | 0.011 | 0.034 | -0.012 | 14.1 | 5.6 | 0.0103 | left_wrist | 0.067 | right_elbow-right_wrist | 4 | 10 |
| 82 | 100 | follow_finish | head_hand_opposite | 0.754 | 0.01 | 0.029 | -0.009 | 13.8 | 5.9 | 0.0102 | left_ankle | 0.059 | right_elbow-right_wrist | 4 | 14 |
| 83 | 101 | follow_finish | head_hand_opposite | 0.754 | 0.009 | 0.024 | -0.007 | 13.5 | 6.4 | 0.0093 | left_ankle | 0.051 | right_elbow-right_wrist | 4 | 12 |
| 84 | 102 | follow_finish | head_hand_opposite | 0.724 | 0.008 | 0.022 | -0.006 | 13.2 | 6.9 | 0.0072 | left_wrist | 0.04 | right_shoulder-right_elbow | 4 | 14 |
| 85 | 103 | follow_finish | head_hand_opposite | 0.66 | 0.008 | 0.02 | -0.005 | 13 | 7.3 | 0.01 | left_wrist | 0.039 | right_shoulder-right_elbow | 4 | 12 |
| 86 | 104 | follow_finish | head_hand_opposite | 0.621 | 0.009 | 0.022 | -0.003 | 12.8 | 7.4 | 0.0114 | left_elbow | 0.04 | right_shoulder-right_elbow | 4 | 12 |
| 87 | 105 | follow_finish | head_hand_opposite | 0.665 | 0.014 | 0.027 | 0.001 | 12.8 | 7.4 | 0.0127 | right_ankle | 0.044 | right_shoulder-right_elbow | 4 | 13 |
| 88 | 106 | follow_finish | head_hand_opposite | 0.718 | 0.02 | 0.035 | 0.005 | 12.8 | 7.1 | 0.0141 | left_ankle | 0.049 | right_shoulder-right_elbow | 4 | 14 |
| 89 | 107 | follow_finish | head_hand_opposite | 0.728 | 0.023 | 0.04 | 0.006 | 12.8 | 6.6 | 0.0114 | left_ankle | 0.053 | right_shoulder-right_elbow | 4 | 13 |
| 90 | 108 | follow_finish | head_hand_opposite | 0.714 | 0.024 | 0.043 | 0.005 | 13 | 6 | 0.0077 | left_elbow | 0.055 | right_shoulder-right_elbow | 4 | 14 |
| 91 | 109 | follow_finish | head_hand_opposite | 0.697 | 0.024 | 0.045 | 0.004 | 13.2 | 5.3 | 0.0059 | left_wrist | 0.056 | right_shoulder-right_elbow | 4 | 13 |
| 92 | 110 | follow_finish | head_hand_opposite | 0.679 | 0.023 | 0.044 | 0.002 | 13.5 | 4.7 | 0.008 | right_ankle | 0.054 | right_shoulder-right_elbow | 4 | 13 |
| 93 | 111 | follow_finish | head_hand_opposite | 0.666 | 0.02 | 0.04 | 0.001 | 13.8 | 4.1 | 0.0093 | right_ankle | 0.051 | right_shoulder-right_elbow | 4 | 13 |
| 94 | 112 | follow_finish | head_hand_opposite | 0.669 | 0.016 | 0.033 | -0.001 | 14.1 | 3.6 | 0.0078 | left_wrist | 0.049 | left_shoulder-left_elbow | 4 | 13 |
| 95 | 113 | follow_finish | head_hand_opposite | 0.694 | 0.011 | 0.026 | -0.003 | 14.5 | 3.2 | 0.0093 | left_wrist | 0.065 | left_shoulder-left_elbow | 4 | 13 |
| 96 | 114 | follow_finish | head_hand_opposite | 0.732 | 0.008 | 0.021 | -0.005 | 14.9 | 2.8 | 0.0084 | left_ankle | 0.093 | left_elbow-left_wrist | 4 | 12 |
| 97 | 115 | follow_finish | head_hand_opposite | 0.763 | 0.006 | 0.019 | -0.008 | 15.5 | 2.6 | 0.0108 | right_ankle | 0.114 | left_elbow-left_wrist | 4 | 12 |
| 98 | 116 | follow_finish | head_hand_opposite | 0.745 | 0.003 | 0.016 | -0.01 | 16.3 | 2.5 | 0.0092 | left_elbow | 0.102 | left_shoulder-left_elbow | 4 | 12 |
| 99 | 117 | follow_finish | head_hand_opposite | 0.641 | -0.003 | 0.009 | -0.015 | 17.2 | 2.5 | 0.0313 | left_elbow | 0.095 | left_shoulder-left_elbow | 4 | 13 |
| 100 | 118 | follow_finish | joint_jump:left_elbow|trunk_back_z|head_hand_opposite | 0.695 | -0.008 | 0.005 | -0.021 | 18.2 | 2.6 | 0.0406 | left_elbow | 0.087 | left_elbow-left_wrist | 4 | 13 |
| 101 | 119 | follow_finish | trunk_back_z|head_hand_opposite | 0.788 | -0.012 | 0.003 | -0.026 | 19 | 2.8 | 0.0195 | left_elbow | 0.114 | left_elbow-left_wrist | 4 | 13 |
| 102 | 120 | follow_finish | trunk_back_z|head_hand_opposite | 0.815 | -0.017 | -0.005 | -0.028 | 19.6 | 3.1 | 0.02 | right_ankle | 0.124 | left_elbow-left_wrist | 4 | 14 |
| 103 | 121 | follow_finish | trunk_back_z|head_hand_opposite | 0.792 | -0.021 | -0.012 | -0.031 | 20 | 3.4 | 0.0189 | right_ankle | 0.12 | left_elbow-left_wrist | 4 | 14 |
| 104 | 122 | follow_finish | trunk_back_z|head_hand_opposite | 0.752 | -0.025 | -0.017 | -0.034 | 20.3 | 3.9 | 0.0145 | right_ankle | 0.107 | left_elbow-left_wrist | 4 | 14 |
| 105 | 123 | follow_finish | trunk_back_z|head_hand_opposite | 0.703 | -0.029 | -0.021 | -0.036 | 20.5 | 4.4 | 0.0092 | right_ankle | 0.115 | right_elbow-right_wrist | 4 | 14 |
| 106 | 124 | follow_finish | trunk_back_z|head_hand_opposite | 0.501 | -0.036 | -0.029 | -0.042 | 20.6 | 4.9 | 0.0187 | left_elbow | 0.099 | right_shoulder-right_elbow | 4 | 16 |
| 107 | 125 | follow_finish | trunk_back_z|head_hand_opposite | 0.446 | -0.037 | -0.035 | -0.039 | 20.8 | 5.4 | 0.0159 | left_wrist | 0.101 | right_shoulder-right_elbow | 4 | 14 |
| 108 | 126 | follow_finish | trunk_back_z | 0.872 | -0.033 | -0.04 | -0.027 | 21 | 5.9 | 0.0269 | left_wrist | 0.136 | right_elbow-right_wrist | 4 | 14 |
| 109 | 127 | follow_finish | grip_wide|joint_jump:left_wrist|trunk_back_z | 0.979 | -0.037 | -0.046 | -0.027 | 21.3 | 6.4 | 0.0397 | left_wrist | 0.169 | right_elbow-right_wrist | 4 | 14 |
| 110 | 128 | follow_finish | joint_jump:left_wrist|trunk_back_z | 0.928 | -0.049 | -0.059 | -0.038 | 21.5 | 6.8 | 0.0386 | left_wrist | 0.161 | right_elbow-right_wrist | 4 | 14 |
| 111 | 129 | follow_finish | trunk_back_z | 0.827 | -0.061 | -0.074 | -0.048 | 21.8 | 7.2 | 0.0217 | left_wrist | 0.14 | right_elbow-right_wrist | 4 | 16 |
| 112 | 130 | follow_finish | trunk_back_z | 0.77 | -0.072 | -0.089 | -0.055 | 22.1 | 7.6 | 0.0158 | left_wrist | 0.133 | right_elbow-right_wrist | 4 | 17 |
| 113 | 131 | follow_finish | trunk_back_z | 0.754 | -0.086 | -0.107 | -0.064 | 22.4 | 8.1 | 0.0201 | left_wrist | 0.138 | right_elbow-right_wrist | 4 | 14 |
| 114 | 132 | follow_finish | trunk_back_z | 0.753 | -0.103 | -0.124 | -0.082 | 22.9 | 8.6 | 0.0272 | left_wrist | 0.135 | right_elbow-right_wrist | 4 | 17 |
| 115 | 133 | follow_finish | joint_jump:right_wrist|trunk_back_z | 0.66 | -0.126 | -0.137 | -0.114 | 23.5 | 9.3 | 0.0885 | right_wrist | 0.112 | right_shoulder-right_elbow | 4 | 16 |
| 116 | 134 | follow_finish | trunk_back_z | 0.664 | -0.123 | -0.133 | -0.114 | 24 | 10 | 0.0235 | left_wrist | 0.131 | right_elbow-right_wrist | 4 | 17 |
| 117 | 135 | follow_finish | trunk_back_z | 0.679 | -0.124 | -0.13 | -0.117 | 24.3 | 11 | 0.0147 | right_shoulder | 0.101 | right_elbow-right_wrist | 4 | 16 |
| 118 | 136 | follow_finish | trunk_back_z | 0.721 | -0.126 | -0.135 | -0.117 | 24.3 | 12.1 | 0.0146 | right_shoulder | 0.083 | left_elbow-left_wrist | 4 | 16 |
| 119 | 137 | follow_finish | trunk_back_z | 0.751 | -0.129 | -0.142 | -0.117 | 24 | 13.4 | 0.0093 | right_shoulder | 0.085 | left_elbow-left_wrist | 4 | 16 |
| 120 | 138 | follow_finish | trunk_back_z | 0.847 | -0.131 | -0.145 | -0.118 | 23.4 | 14.8 | 0.0096 | left_shoulder | 0.096 | left_elbow-left_wrist | 4 | 15 |
| 121 | 139 | follow_finish | grip_wide|trunk_back_z | 0.976 | -0.133 | -0.146 | -0.119 | 22.8 | 16.5 | 0.0152 | left_shoulder | 0.099 | left_elbow-left_wrist | 4 | 15 |
| 122 | 140 | follow_finish | trunk_back_z | 0.847 | -0.133 | -0.149 | -0.117 | 22.2 | 18.3 | 0.0164 | left_shoulder | 0.081 | right_shoulder-right_elbow | 4 | 15 |
| 123 | 141 | follow_finish | trunk_back_z | 0.73 | -0.132 | -0.152 | -0.112 | 21.7 | 20.1 | 0.0135 | left_shoulder | 0.077 | right_shoulder-right_elbow | 4 | 11 |
| 124 | 142 | follow_finish | trunk_back_z | 0.676 | -0.132 | -0.155 | -0.108 | 21.3 | 21.9 | 0.0087 | left_shoulder | 0.075 | right_shoulder-right_elbow | 4 | 14 |
| 125 | 143 | follow_finish | trunk_back_z | 0.65 | -0.13 | -0.154 | -0.105 | 21 | 23.6 | 0.012 | right_elbow | 0.115 | right_shoulder-right_elbow | 4 | 11 |
| 126 | 144 | follow_finish | trunk_back_z | 0.668 | -0.131 | -0.157 | -0.104 | 20.7 | 25.1 | 0.0106 | left_elbow | 0.079 | right_shoulder-right_elbow | 4 | 8 |
| 127 | 145 | follow_finish | trunk_back_z | 0.681 | -0.13 | -0.158 | -0.103 | 20.4 | 26.3 | 0.0041 | right_shoulder | 0.081 | right_shoulder-right_elbow | 4 | 10 |
| 128 | 146 | follow_finish | trunk_back_z | 0.695 | -0.13 | -0.158 | -0.103 | 20.2 | 27.2 | 0.0035 | right_shoulder | 0.083 | right_shoulder-right_elbow | 4 | 10 |
| 129 | 147 | after_finish | trunk_back_z | 0.708 | -0.13 | -0.157 | -0.103 | 20 | 27.8 | 0.0028 | left_wrist | 0.084 | right_shoulder-right_elbow | 4 | 10 |
| 130 | 148 | after_finish | trunk_back_z | 0.717 | -0.13 | -0.156 | -0.103 | 19.8 | 28.2 | 0.0032 | left_wrist | 0.085 | right_shoulder-right_elbow | 4 | 10 |
| 131 | 149 | after_finish | trunk_back_z | 0.725 | -0.129 | -0.155 | -0.104 | 19.6 | 28.4 | 0.0034 | left_wrist | 0.085 | right_shoulder-right_elbow | 4 | 10 |