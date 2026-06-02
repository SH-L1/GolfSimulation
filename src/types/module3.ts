export interface Landmark {
  x:          number;
  y:          number;
  z:          number;
  visibility: number;
}

export interface BodyRatios {
  valid:         boolean;
  vector:        number[];
  feature_order: string[];
  frames_used:   number[];
  source_frame:  string;
  version:       string;
}

export interface PoseFrame {
  frame:     number;     // frame number (was frame_index)
  timestamp: number;     // seconds (was timestamp_ms in ms)
  has_pose:  boolean;
  landmarks: Landmark[];
  phase?:    string;     // derived from events by API layer
}

export interface LandmarkResponse {
  session_id:      string;
  final_json_path: string;
  viewtype:        string;
  events:          Record<string, { frame: number }>;
  body_ratios:     BodyRatios;
  frames:          PoseFrame[];
  fps?:            number;  // computed by API layer
}

export interface ProRecommendNeighbor {
  rank:        number;
  player_id:   string;
  swing_url:   string;
  distance:    number;
  similarity:  number;
  body_ratios: BodyRatios;
  events:      Record<string, { frame: number }>;
}

export interface ProRecommendResponse {
  session_id:       string;
  user_swing_path:  string;
  user_body_ratios: BodyRatios;
  neighbors:        ProRecommendNeighbor[];
}
