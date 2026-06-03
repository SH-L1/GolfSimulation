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
  frame:      number;   // 0-based re-numbered index (재번호화)
  frame_orig: number;   // 원본 영상 프레임 번호 (events[x].frame 기준)
  timestamp:  number;   // seconds
  has_pose:   boolean;
  landmarks:  Landmark[];
  phase?:     string;   // derived from events by API layer
}

export interface SwingEvent {
  frame:       number;    // 원본 영상 프레임 번호
  is_fallback?: boolean;  // SwingNet 미감지 시 true
}

export interface LandmarkResponse {
  session_id:      string;
  final_json_path: string;
  viewtype:        string;
  events:          Record<string, SwingEvent>;
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
