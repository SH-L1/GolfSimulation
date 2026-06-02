import type { LandmarkResponse } from '../../types/module3';

const JOINTS = [
  'LEFT_SHOULDER', 'RIGHT_SHOULDER',
  'LEFT_HIP', 'RIGHT_HIP',
  'LEFT_KNEE', 'RIGHT_KNEE',
  'LEFT_ANKLE', 'RIGHT_ANKLE',
  'LEFT_WRIST', 'RIGHT_WRIST',
  'LEFT_ELBOW', 'RIGHT_ELBOW',
  'NOSE',
];

function makeLandmarks() {
  return JOINTS.map(() => ({
    x: Math.random(), y: Math.random(), z: Math.random() * 0.1, visibility: 0.95,
  }));
}

export const MOCK_LANDMARKS: LandmarkResponse = {
  session_id:      'mock-session-001',
  final_json_path: '',
  viewtype:        'face_on',
  events: {
    address: { frame: 0 },
    top:     { frame: 20 },
    impact:  { frame: 45 },
    finish:  { frame: 70 },
  },
  body_ratios: {
    valid: true,
    vector: [1.64, 1.19, 1.98, 1.07, 0.98, 0.99, 0.95],
    feature_order: ['shoulder_to_hip', 'arm_to_torso', 'leg_to_torso',
                    'upper_arm_to_lower_arm', 'upper_leg_to_lower_leg',
                    'left_right_arm_symmetry', 'left_right_leg_symmetry'],
    frames_used:  [0, 1, 2],
    source_frame: 'address',
    version:      'v1',
  },
  fps: 30,
  frames: Array.from({ length: 90 }, (_, i) => ({
    frame:     i,
    timestamp: i / 30,
    has_pose:  true,
    landmarks: makeLandmarks(),
    phase:     i < 20 ? 'address' : i < 45 ? 'top' : i < 70 ? 'impact' : 'finish',
  })),
};
