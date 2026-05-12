import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SkeletonViewer } from './SkeletonViewer';
import type { PoseFrame } from '../../types/module3';

interface Props {
  userFrame: PoseFrame | null;
  proFrame:  PoseFrame | null;
  width:     number;
  height:    number;
}

export const ProOverlay: React.FC<Props> = ({ userFrame, proFrame, width, height }) => (
  <View style={{ width, height }}>
    {/* 프로 (빨간색 반투명) */}
    {proFrame && (
      <View style={StyleSheet.absoluteFill}>
        <SkeletonViewer frame={proFrame} width={width} height={height} color="#ba1a1a" />
      </View>
    )}
    {/* 유저 (초록색) */}
    <SkeletonViewer frame={userFrame} width={width} height={height} color="#006e1c" />

    {/* 범례 */}
    <View style={s.legend}>
      <View style={s.legendItem}><View style={[s.dot, { backgroundColor: '#006e1c' }]} /><Text style={s.legendText}>나</Text></View>
      <View style={s.legendItem}><View style={[s.dot, { backgroundColor: '#ba1a1a' }]} /><Text style={s.legendText}>프로</Text></View>
    </View>
  </View>
);

const s = StyleSheet.create({
  legend:     { position: 'absolute', top: 10, right: 10, gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '700', color: '#191c1b' },
});
