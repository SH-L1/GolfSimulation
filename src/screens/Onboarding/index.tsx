import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');

// Figma 에셋 (7일 유효 — 추후 로컬 에셋으로 교체)
const imgHero = 'https://www.figma.com/api/mcp/asset/b525add0-f709-45be-8eda-777c5c4235af';

const C = {
  bg:          '#f8faf8',
  green:       '#006e1c',
  greenMid:    '#4caf50',
  textPri:     '#191c1b',
  textSub:     '#3f4a3c',
  textMuted:   '#9ca3af',
  dotInactive: '#becab9',
  cardBg:      '#f2f4f2',
};

// ─── 온보딩 페이지 데이터 ────────────────────────────────────────
type FeatureCard = { icon: string; iconBg: string; title: string; desc: string };
type OnboardPage = {
  titlePre: string;
  titleAccent: string;
  subtitle: string;
  cards: [FeatureCard, FeatureCard];
};

const PAGES: OnboardPage[] = [
  {
    titlePre: 'AI 기반 ',
    titleAccent: '스윙 코칭',
    subtitle:
      '전문적인 AI 분석으로 당신의 경기를 변화시키세요. 개인 코치가 언제든 대기 중입니다.',
    cards: [
      {
        icon: '📡', iconBg: '#33a0fd',
        title: '실시간 분석',
        desc: '스윙 영상을 업로드하면 AI가 즉시 분석하여 핵심 개선 포인트를 알려드립니다.',
      },
      {
        icon: '🎯', iconBg: '#78dc77',
        title: '맞춤형 드릴',
        desc: '분석 결과에 맞는 맞춤형 연습 드릴을 추천해 빠른 실력 향상을 돕습니다.',
      },
    ],
  },
  {
    titlePre: '정확한 ',
    titleAccent: '스윙 분석',
    subtitle:
      '3D 모델링과 X-Factor 측정으로 프로 선수 수준의 정밀 분석을 경험해보세요.',
    cards: [
      {
        icon: '🧊', iconBg: '#a78bfa',
        title: '3D 모델링',
        desc: '스윙의 모든 각도를 3D로 시각화하여 자세의 문제점을 직관적으로 파악합니다.',
      },
      {
        icon: '📐', iconBg: '#fb923c',
        title: 'X-Factor 측정',
        desc: '어깨와 힙의 회전 차이를 정밀하게 측정해 파워 향상의 핵심을 잡아드립니다.',
      },
    ],
  },
  {
    titlePre: 'AI 코치와 ',
    titleAccent: '대화하기',
    subtitle:
      '언제 어디서든 골프 고민을 AI 코치에게 물어보세요. 24시간 전문 코칭이 시작됩니다.',
    cards: [
      {
        icon: '💬', iconBg: '#34d399',
        title: '24/7 AI 코칭',
        desc: '시간과 장소에 구애받지 않고 전문 코치와 대화하며 실력을 향상시키세요.',
      },
      {
        icon: '🏆', iconBg: '#fbbf24',
        title: '성과 추적',
        desc: '모든 세션의 기록을 타임라인으로 확인하고 성장 과정을 한눈에 파악하세요.',
      },
    ],
  },
];

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
type Props = { navigation?: any };

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const listRef = useRef<FlatList>(null);

  const goTo = (idx: number) => {
    listRef.current?.scrollToIndex({ index: idx, animated: true });
    setCurrentPage(idx);
  };

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      goTo(currentPage + 1);
    } else {
      navigation?.navigate('Login');
    }
  };

  const handleSkip  = () => navigation?.navigate('Login');
  const handleLogin = () => navigation?.navigate('Login');

  // ─── 각 페이지 렌더링 ────────────────────────────────────────
  const renderPage = ({ item }: { item: OnboardPage }) => (
    <View style={s.page}>
      {/* 히어로 이미지 */}
      <View style={s.hero}>
        <Image source={{ uri: imgHero }} style={s.heroImg} resizeMode="cover" />
        {/* 하단 그라디언트 */}
        <View style={s.heroGradient} pointerEvents="none" />
        {/* Skip 버튼 */}
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.8}>
          <Text style={s.skipText}>SKIP</Text>
        </TouchableOpacity>
      </View>

      {/* 콘텐츠 카드 — 히어로 위로 64px 올라옴 */}
      <View style={s.contentCard}>
        {/* 페이지네이션 도트 */}
        <View style={s.dotsRow}>
          {PAGES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View style={[s.dot, i === currentPage ? s.dotActive : s.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* 헤드라인 */}
        <View style={s.headlines}>
          <Text style={s.title}>
            {item.titlePre}
            <Text style={s.titleAccent}>{item.titleAccent}</Text>
          </Text>
          <Text style={s.subtitle}>{item.subtitle}</Text>
        </View>

        {/* 피처 카드 2개 */}
        <View style={s.featureGrid}>
          {item.cards.map((card, i) => (
            <View key={i} style={s.featureCard}>
              <View style={[s.iconCircle, { backgroundColor: card.iconBg }]}>
                <Text style={s.iconEmoji}>{card.icon}</Text>
              </View>
              <View style={s.featureTextWrap}>
                <Text style={s.featureTitle}>{card.title}</Text>
                <Text style={s.featureDesc}>{card.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 푸터 액션 */}
        <View style={s.footer}>
          <TouchableOpacity style={s.ctaBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={s.ctaText}>
              {currentPage < PAGES.length - 1 ? '다음' : '시작하기'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
            <Text style={s.loginText}>
              이미 계정이 있으신가요?{' '}
              <Text style={s.loginLink}>로그인</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* 고정 헤더 (로고) */}
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.logoCircle}>
              <Text style={s.logoEmoji}>⛳</Text>
            </View>
            <Text style={s.logoText}>Handy</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* 수평 스와이프 페이저 */}
      <FlatList
        ref={listRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
          setCurrentPage(idx);
        }}
        getItemLayout={(_, index) => ({
          length: SW, offset: SW * index, index,
        })}
      />
    </View>
  );
};

// ─── 스타일 ────────────────────────────────────────────────────
const HERO_H    = 300;
const OVERLAP   = 64;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // 고정 헤더
  headerSafe: { backgroundColor: 'transparent', zIndex: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#e1e3e1',
    borderWidth: 1, borderColor: 'rgba(190,202,185,0.3)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoEmoji: { fontSize: 14 },
  logoText: {
    fontSize: 20, fontWeight: '700', color: C.green, letterSpacing: -0.5,
  },

  // 페이지
  page: { width: SW, backgroundColor: C.bg },

  // 히어로
  hero: { height: HERO_H, overflow: 'hidden', backgroundColor: '#f2f4f2' },
  heroImg: { width: '100%', height: '100%' },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
    // LinearGradient 미사용 — 단순 흰 페이드
    backgroundColor: 'transparent',
  },
  skipBtn: {
    position: 'absolute', top: 16, right: 24,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6,
    shadowColor: '#191c1b', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
  },
  skipText: {
    fontSize: 12, fontWeight: '700', color: C.textSub,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  // 콘텐츠 카드
  contentCard: {
    marginTop: -OVERLAP,
    backgroundColor: C.bg,
    borderTopLeftRadius: 48, borderTopRightRadius: 48,
    padding: 32, paddingBottom: 48,
    gap: 24,
  },

  // 도트
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { height: 6, borderRadius: 999 },
  dotActive:   { width: 32, backgroundColor: C.green },
  dotInactive: { width: 8,  backgroundColor: C.dotInactive },

  // 헤드라인
  headlines: { gap: 12 },
  title: {
    fontSize: 30, fontWeight: '700', color: C.textPri, letterSpacing: -0.75, lineHeight: 38,
  },
  titleAccent: { color: C.green },
  subtitle: { fontSize: 16, color: C.textSub, lineHeight: 26 },

  // 피처 카드 그리드
  featureGrid: { gap: 16 },
  featureCard: {
    flexDirection: 'row', gap: 16, alignItems: 'flex-start',
    backgroundColor: C.cardBg, borderRadius: 32, padding: 20,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },
  featureTextWrap: { flex: 1, gap: 4 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: C.textPri },
  featureDesc:  { fontSize: 12, color: C.textSub, lineHeight: 18 },

  // 푸터
  footer: { gap: 24, paddingTop: 8 },
  ctaBtn: {
    backgroundColor: C.green,
    borderRadius: 999, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#191c1b', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  loginText: {
    fontSize: 14, color: C.textSub, textAlign: 'center',
  },
  loginLink: { color: C.green, fontWeight: '700' },
});
