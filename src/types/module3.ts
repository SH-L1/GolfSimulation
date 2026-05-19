export interface Landmark {
  x:          number;
  y:          number;
  z:          number;
  visibility: number;
}

export interface PoseFrame {
  frame_index:  number;
  timestamp_ms: number;
  phase:        string;
  landmarks:    Record<string, Landmark>;
}

export interface LandmarkResponse {
  session_id:   string;
  fps:          number;
  total_frames: number;
  frames:       PoseFrame[];
}
