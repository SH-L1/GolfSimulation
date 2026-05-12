import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { JobStatus } from '../../hooks/usePolling';

const LABEL: Record<JobStatus, string> = {
  idle:       '',
  queued:     '분석 대기 중...',
  processing: '스윙 분석 중...',
  done:       '분석 완료!',
  error:      '분석 실패',
};

interface Props { status: JobStatus }

export const PollingIndicator: React.FC<Props> = ({ status }) => {
  if (status === 'idle') { return null; }
  const isActive = status === 'queued' || status === 'processing';
  return (
    <View style={s.wrap}>
      {isActive && <ActivityIndicator size="small" color="#006e1c" />}
      <Text style={[s.label, status === 'error' && { color: '#ba1a1a' }]}>
        {LABEL[status]}
      </Text>
    </View>
  );
};

const s = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#3f4a3c' },
});
