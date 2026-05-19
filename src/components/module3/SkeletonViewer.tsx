import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PoseFrame } from '../../types/module3';

// 연결할 관절 쌍 (2D 오버레이용)
const CONNECTIONS: [string, string][] = [
  ['left_shoulder',  'right_shoulder'],
  ['left_shoulder',  'left_elbow'],
  ['left_elbow',     'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow',    'right_wrist'],
  ['left_shoulder',  'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip',       'right_hip'],
  ['left_hip',       'left_knee'],
  ['left_knee',      'left_ankle'],
  ['right_hip',      'right_knee'],
  ['right_knee',     'right_ankle'],
];

interface Props {
  frame:       PoseFrame | null;
  width:       number;
  height:      number;
  color?:      string;
}

export const SkeletonViewer: React.FC<Props> = ({ frame, width, height, color = '#006e1c' }) => {
  if (!frame) {
    return (
      <View style={[s.placeholder, { width, height }]}>
        <Text style={s.placeholderText}>스켈레톤 데이터 없음</Text>
      </View>
    );
  }

  const lm = frame.landmarks;

  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* 관절 점 */}
      {Object.entries(lm).map(([name, point]) => {
        if (point.visibility < 0.5) { return null; }
        return (
          <View
            key={name}
            style={[
              s.joint,
              {
                left:  point.x * width  - 4,
                top:   point.y * height - 4,
                backgroundColor: color,
              },
            ]}
          />
        );
      })}

      {/* 연결선 (SVG 없이 간략히 — 실제 구현 시 react-native-svg 사용 권장) */}
      {CONNECTIONS.map(([a, b]) => {
        const pa = lm[a];
        const pb = lm[b];
        if (!pa || !pb || pa.visibility < 0.5 || pb.visibility < 0.5) { return null; }
        const x1 = pa.x * width;
        const y1 = pa.y * height;
        const x2 = pb.x * width;
        const y2 = pb.y * height;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`${a}-${b}`}
            style={[
              s.bone,
              {
                width:  length,
                left:   x1,
                top:    y1 - 1,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 50%',
                backgroundColor: color,
                opacity: 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  joint:           { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  bone:            { position: 'absolute', height: 2, borderRadius: 1 },
  placeholder:     { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2f4f2', borderRadius: 12 },
  placeholderText: { fontSize: 13, color: '#9ca3af' },
});
