import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { AnalysisResult, SwingPhase } from '../../types/module1';
import { ScoreCard } from '../common/ScoreCard';
import { MetricRow } from '../common/MetricRow';
import { RecommendationCard } from './RecommendationCard';

const PHASE_LABEL: Record<SwingPhase, string> = {
  address: '어드레스',
  top:     '백스윙',
  impact:  '임팩트',
  finish:  '피니시',
};

const METRIC_LABEL: Record<string, string> = {
  STANCE_RATIO:  'Stance Ratio',
  SHOULDER_ROT:  'Shoulder Rotation',
  X_FACTOR:      'X-Factor',
  BACKSWING_MAX: 'Backswing Max',
  HIP_ROTATION:  'Hip Rotation',
  WRIST_ANGLE:   'Wrist Angle',
  SPINE_TILT:    'Spine Tilt',
};

interface Props { result: AnalysisResult }

export const SwingFeedbackPanel: React.FC<Props> = ({ result }) => (
  <ScrollView showsVerticalScrollIndicator={false}>
    {/* 종합 점수 */}
    <View style={s.scoreSection}>
      <ScoreCard label="종합 점수" score={result.overallScore} size="lg" />
    </View>

    {/* 페이즈별 점수 */}
    <View style={s.section}>
      <Text style={s.sectionTitle}>페이즈별 점수</Text>
      <View style={s.phaseGrid}>
        {(Object.entries(result.phaseScores) as [SwingPhase, number][]).map(([phase, score]) => (
          <ScoreCard key={phase} label={PHASE_LABEL[phase]} score={score} size="sm" />
        ))}
      </View>
    </View>

    {/* 지표 */}
    <View style={s.section}>
      <Text style={s.sectionTitle}>상세 지표</Text>
      {Object.entries(result.metrics).map(([id, metric]) => (
        <MetricRow key={id} label={METRIC_LABEL[id] ?? id} metric={metric} />
      ))}
    </View>

    {/* 추천 드릴 */}
    {result.recommendations.length > 0 && (
      <View style={s.section}>
        <Text style={s.sectionTitle}>개선 포인트</Text>
        {result.recommendations.map(r => (
          <RecommendationCard key={r.metricId} recommendation={r} />
        ))}
      </View>
    )}
  </ScrollView>
);

const s = StyleSheet.create({
  scoreSection: { alignItems: 'center', paddingVertical: 24 },
  section:      { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#191c1b', marginBottom: 4 },
  phaseGrid:    { flexDirection: 'row', justifyContent: 'space-around' },
});
