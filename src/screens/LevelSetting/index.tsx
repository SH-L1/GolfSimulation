import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '../../components/ui/AppHeader';
import { useAuth } from '../../context/AuthContext';
import type { ExperienceLevel } from '../../utils/experienceMapper';

export const STORAGE_KEY_SETUP_DONE = 'handy_setup_done';

const C = {
  bg:      '#f8faf8',
  green:   '#006e1c',
  greenMid:'#4caf50',
  textPri: '#191c1b',
  textSub: '#3f4a3c',
  surface: '#ffffff',
  cardBg:  '#f2f4f2',
};

// ─── 레벨 데이터 ────────────────────────────────────────────────
type Level = {
  key: string;
  label: string;
  icon: string;
  iconBg: string;
  desc: string;
};

const LEVELS: Level[] = [
  {
    key: 'beginner',
    label: '초보',
    icon: '🙂',
    iconBg: '#d1e4ff',
    desc: '이제 막 시작했거나 기본 스윙 메커니즘에 집중하고 싶은 골퍼',
  },
  {
    key: 'intermediate',
    label: '중급',
    icon: '🏌️',
    iconBg: '#94f990',
    desc: '꾸준히 연습하는 골퍼로 기술과 전략을 한 단계 더 높이고 싶음',
  },
  {
    key: 'advanced',
    label: '고급',
    icon: '🏆',
    iconBg: '#ffd9e2',
    desc: '실력 있는 골퍼로 세밀한 분석과 고급 피드백을 원함',
  },
];

// ─── Props ───────────────────────────────────────────────────────
type Props = {
  navigation?: any;
  route?: { params?: { nextScreen?: string } };
};

export const LevelSettingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { updateExperienceLevel } = useAuth();
  const [selected, setSelected]   = useState<string>('intermediate');
  const [saving, setSaving]       = useState(false);

  const handleConfirm = async () => {
    if (saving) { return; }
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SETUP_DONE, 'true');
      await updateExperienceLevel(selected as ExperienceLevel);
      const next = route?.params?.nextScreen;
      if (next) {
        navigation?.replace(next);
      } else if (navigation?.canGoBack()) {
        navigation?.goBack();
      } else {
        navigation?.replace('Main');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader navigation={navigation} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 헤드라인 */}
        <View style={s.headlines}>
          <Text style={s.title}>실력 레벨 선택</Text>
          <Text style={s.subtitle}>
            나에게 맞는 최적의 훈련 경험을 위해 현재 실력을 선택해 주세요.
          </Text>
        </View>

        {/* 레벨 카드 목록 */}
        <View style={s.cardList}>
          {LEVELS.map(level => {
            const isSelected = selected === level.key;
            return (
              <TouchableOpacity
                key={level.key}
                style={[s.levelCard, isSelected && s.levelCardSelected]}
                onPress={() => setSelected(level.key)}
                activeOpacity={0.8}>
                {/* 아이콘 */}
                <View style={[s.iconCircle, { backgroundColor: level.iconBg }]}>
                  <Text style={s.iconEmoji}>{level.icon}</Text>
                </View>

                {/* 텍스트 */}
                <View style={s.levelText}>
                  <Text style={s.levelLabel}>{level.label}</Text>
                  <Text style={s.levelDesc}>{level.desc}</Text>
                </View>

                {/* 선택 체크 */}
                {isSelected && (
                  <View style={s.checkCircle}>
                    <Text style={s.checkIcon}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 캐디 프로 팁 */}
        <View style={s.tipOuter}>
          <View style={s.tipCard}>
            <Text style={s.tipQuote}>
              "완벽보다는 적절한 레벨 설정이 중요합니다. AI 캐디가 실력에 맞는 최적의 팁을 전해드립니다."
            </Text>
            <View style={s.tipFooter}>
              <View style={s.tipDot}>
                <Text style={s.tipDotIcon}>✓</Text>
              </View>
              <Text style={s.tipLabel}>캐디 프로 팁</Text>
            </View>
          </View>
        </View>

        {/* 선택 완료 버튼 */}
        <TouchableOpacity
          style={[s.ctaBtn, saving && { opacity: 0.7 }]}
          onPress={() => { void handleConfirm(); }}
          disabled={saving}
          activeOpacity={0.85}>
          <Text style={s.ctaText}>{saving ? '저장 중...' : '선택 완료'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── 스타일 ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 16 },

  // 헤드라인
  headlines: { paddingTop: 8, paddingBottom: 32, gap: 8 },
  title: {
    fontSize: 30, fontWeight: '700', color: C.textPri, letterSpacing: -0.75, lineHeight: 38,
  },
  subtitle: { fontSize: 16, color: C.textSub, lineHeight: 26 },

  // 레벨 카드 목록
  cardList: { gap: 16, marginBottom: 32 },

  levelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: C.surface,
    borderRadius: 16, padding: 22,
    borderWidth: 2, borderColor: 'transparent',
  },
  levelCardSelected: {
    borderColor: C.green,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
  },

  iconCircle: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconEmoji: { fontSize: 24 },

  levelText: { flex: 1 },
  levelLabel: { fontSize: 18, fontWeight: '700', color: C.textPri, marginBottom: 4 },
  levelDesc:  { fontSize: 14, color: C.textSub, lineHeight: 20 },

  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkIcon: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // 캐디 팁 카드
  tipOuter: { paddingLeft: 52, marginBottom: 40 },
  tipCard: {
    backgroundColor: C.cardBg,
    borderRadius: 16, padding: 20,
    gap: 12,
    borderWidth: 1, borderColor: 'rgba(225,227,225,0.3)',
  },
  tipQuote: { fontSize: 14, color: C.textSub, lineHeight: 20, fontStyle: 'italic' },
  tipFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.greenMid,
    alignItems: 'center', justifyContent: 'center',
  },
  tipDotIcon: { fontSize: 10, color: '#fff', fontWeight: '700' },
  tipLabel: {
    fontSize: 11, fontWeight: '700', color: C.green,
    letterSpacing: 0.55, textTransform: 'uppercase',
  },

  // CTA 버튼
  ctaBtn: {
    backgroundColor: C.green,
    borderRadius: 999, paddingVertical: 18,
    alignItems: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 6,
  },
  ctaText: { fontSize: 18, fontWeight: '700', color: '#fff' },

});
