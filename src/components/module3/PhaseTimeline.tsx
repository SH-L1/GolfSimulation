import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { PoseFrame } from '../../types/module3';
import { PHASE_LABEL } from '../../constants/swing';

const PHASE_COLOR: Record<string, string> = {
  address:  '#0061a4',
  top:      '#006e1c',
  impact:   '#ba1a1a',
  finish:   '#C8922A',
};

interface Props {
  frames:        PoseFrame[];
  currentIndex:  number;
  onSeek:        (index: number) => void;
}

export const PhaseTimeline: React.FC<Props> = ({ frames, currentIndex, onSeek }) => {
  const total = frames.length;
  if (total === 0) { return null; }

  // 페이즈 구간 계산
  const phases = frames.reduce<{ phase: string; start: number; end: number }[]>((acc, f) => {
    const phase = f.phase ?? 'unknown';
    const last = acc[acc.length - 1];
    if (last && last.phase === phase) { last.end = f.frame; }
    else { acc.push({ phase, start: f.frame, end: f.frame }); }
    return acc;
  }, []);

  return (
    <View style={s.wrap}>
      {/* 세그먼트 바 */}
      <View style={s.bar}>
        {phases.map(p => (
          <TouchableOpacity
            key={p.phase}
            style={[
              s.segment,
              { flex: p.end - p.start + 1, backgroundColor: PHASE_COLOR[p.phase] ?? '#9ca3af' },
            ]}
            onPress={() => onSeek(p.start)}
          />
        ))}
        {/* 재생 헤드 */}
        <View style={[s.playhead, { left: `${(currentIndex / Math.max(total - 1, 1)) * 100}%` as `${number}%` }]} />
      </View>

      {/* 레이블 */}
      <View style={s.labels}>
        {phases.map(p => (
          <Text
            key={p.phase}
            numberOfLines={1}
            style={[s.label, { flex: p.end - p.start + 1, color: PHASE_COLOR[p.phase] ?? '#9ca3af' }]}>
            {PHASE_LABEL[p.phase] ?? p.phase}
          </Text>
        ))}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap:     { gap: 6 },
  bar:      { height: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', position: 'relative' },
  segment:  { height: '100%' },
  playhead: { position: 'absolute', top: -3, width: 3, height: 18, backgroundColor: '#fff', borderRadius: 2, marginLeft: -1.5 },
  labels:   { flexDirection: 'row', height: 14, overflow: 'hidden' },
  label:    { fontSize: 9, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', lineHeight: 14 },
});
