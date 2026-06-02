import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PoseFrame } from '../../types/module3';


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
      {lm.map((point, idx) => {
        if (point.visibility < 0.5) { return null; }
        return (
          <View
            key={idx}
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

      {/* 연결선 — 배열 기반으로 변경 필요, 현재 비활성 */}
      {([] as [string, string][]).map(([a, b]) => {
        const pa = lm[Number(a)];
        const pb = lm[Number(b)];
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
