/** 스윙 동작 구간 라벨 — 앱 전체 공통 */
export const PHASE_LABEL: Record<string, string> = {
  // 정규화된 키 (언더스코어 제거)
  address:            '어드레스',
  toeup:              '테이크어웨이',
  midbackswing:       '백스윙 중반',
  top:                '백스윙 정점',
  topup:              '백스윙 정점',
  middownswing:       '다운스윙',
  impact:             '임팩트',
  midfollowthrough:   '팔로스루',
  finish:             '피니시',
  // 언더스코어 포함 원본 키 (방어적 처리)
  toe_up:             '테이크어웨이',
  mid_backswing:      '백스윙 중반',
  top_up:             '백스윙 정점',
  mid_downswing:      '다운스윙',
  mid_follow_through: '팔로스루',
  // 기타
  setup:              '셋업',
  takeaway:           '테이크어웨이',
  downswing:          '다운스윙',
  follow:             '팔로스루',
  followthrough:      '팔로스루',
};

/** 촬영 방향 라벨 */
export const VIEW_LABEL: Record<string, string> = {
  faceon:      '정면',
  downtheline: '측면',
};

/** 클럽 종류 라벨 */
export const CLUB_LABEL: Record<string, string> = {
  driver: '드라이버',
  iron:   '아이언',
};
