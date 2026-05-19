import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_SETUP_DONE } from '../LevelSetting';
import { loginEmail } from '../../api/auth';
import { ApiError } from '../../api/client';

const C = {
  bg:       '#f8faf8',
  green:    '#006e1c',
  greenMid: '#4caf50',
  textPri:  '#191c1b',
  textSub:  '#3f4a3c',
  textMuted:'#9ca3af',
  surface:  '#ffffff',
  inputBg:  '#e1e3e1',
  border:   'rgba(190,202,185,0.4)',
  kakao:    '#FEE500',
  kakaoText:'#191919',
  google:   '#ffffff',
};

// ─── 소셜 로그인 버튼 ────────────────────────────────────────────
const SocialBtn: React.FC<{
  icon: string;
  label: string;
  bg: string;
  color: string;
  borderColor?: string;
  onPress: () => void;
}> = ({ icon, label, bg, color, borderColor, onPress }) => (
  <TouchableOpacity
    style={[
      s.socialBtn,
      { backgroundColor: bg },
      borderColor ? { borderWidth: 1.5, borderColor } : null,
    ]}
    activeOpacity={0.85}
    onPress={onPress}>
    <Text style={s.socialIcon}>{icon}</Text>
    <Text style={[s.socialLabel, { color }]}>{label}</Text>
    {/* 우측 공간 맞춤 (아이콘 너비 보정) */}
    <View style={{ width: 24 }} />
  </TouchableOpacity>
);

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
type Props = { navigation?: any };

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [mode, setMode]         = useState<'login' | 'email'>('login');
  const [authLoading, setAuthLoading] = useState(false);

  const goAfterLogin = async () => {
    const done = await AsyncStorage.getItem(STORAGE_KEY_SETUP_DONE);
    if (done === 'true') {
      navigation?.replace('Main');
    } else {
      navigation?.replace('LevelSetting', { nextScreen: 'Main' });
    }
  };

  const handleLogin = async () => {
    if (!email || !password) { return; }
    setAuthLoading(true);
    try {
      await loginEmail(email, password);
      await goAfterLogin();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '로그인 중 오류가 발생했습니다.';
      Alert.alert('로그인 실패', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // 소셜 로그인: OAuth SDK 토큰 수령 후 실제 연동 예정
  const handleKakao  = () => { void goAfterLogin(); };
  const handleGoogle = () => { void goAfterLogin(); };
  const handleSignUp = () => navigation?.navigate('SignUp');

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── 히어로 ─────────────────────────────────────────── */}
      <View style={s.hero}>
        <SafeAreaView edges={['top']}>
          {/* 뒤로가기 (온보딩에서 진입 시 숨김) */}
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* 로고 */}
        <View style={s.heroContent}>
          <View style={s.logoBadge}>
            <Text style={s.logoBadgeEmoji}>⛳</Text>
          </View>
          <Text style={s.heroTitle}>Handy</Text>
          <Text style={s.heroSub}>내 손 안의 AI 골프 코치</Text>
        </View>

        {/* 장식 원 */}
        <View style={s.decCircle1} pointerEvents="none" />
        <View style={s.decCircle2} pointerEvents="none" />
      </View>

      {/* ── 콘텐츠 카드 ────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.card}
          contentContainerStyle={s.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {mode === 'login' ? (
            <>
              <Text style={s.cardTitle}>다시 만나요 👋</Text>
              <Text style={s.cardSub}>계속하려면 로그인해 주세요.</Text>

              {/* 카카오 */}
              <SocialBtn
                icon="💬"
                label="카카오로 로그인"
                bg={C.kakao}
                color={C.kakaoText}
                onPress={handleKakao}
              />

              {/* 구글 */}
              <SocialBtn
                icon="🌐"
                label="Google로 로그인"
                bg={C.google}
                color={C.textPri}
                borderColor={C.border}
                onPress={handleGoogle}
              />

              {/* 구분선 */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>또는</Text>
                <View style={s.dividerLine} />
              </View>

              {/* 이메일로 계속 */}
              <TouchableOpacity
                style={s.emailBtn}
                onPress={() => setMode('email')}
                activeOpacity={0.8}>
                <Text style={s.emailBtnText}>이메일로 로그인</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* 뒤로 (이메일 폼 → 소셜 선택) */}
              <TouchableOpacity
                style={s.formBack}
                onPress={() => setMode('login')}>
                <Text style={s.formBackIcon}>‹</Text>
                <Text style={s.formBackText}>다른 방법으로 로그인</Text>
              </TouchableOpacity>

              <Text style={s.cardTitle}>이메일 로그인</Text>

              {/* 이메일 */}
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>이메일</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@email.com"
                  placeholderTextColor={C.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* 비밀번호 */}
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>비밀번호</Text>
                <View style={s.pwRow}>
                  <TextInput
                    style={[s.input, s.pwInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={C.textMuted}
                    secureTextEntry={!showPw}
                  />
                  <TouchableOpacity
                    style={s.pwToggle}
                    onPress={() => setShowPw(v => !v)}>
                    <Text style={s.pwToggleText}>{showPw ? '숨김' : '표시'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 비밀번호 찾기 */}
              <TouchableOpacity style={s.forgotWrap}>
                <Text style={s.forgotText}>비밀번호를 잊으셨나요?</Text>
              </TouchableOpacity>

              {/* 로그인 버튼 */}
              <TouchableOpacity
                style={[s.loginBtn, (!(email && password) || authLoading) && s.loginBtnDisabled]}
                onPress={() => { void handleLogin(); }}
                activeOpacity={0.85}
                disabled={!email || !password || authLoading}>
                {authLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.loginBtnText}>로그인</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* 회원가입 링크 */}
          <View style={s.signupRow}>
            <Text style={s.signupText}>계정이 없으신가요? </Text>
            <TouchableOpacity onPress={handleSignUp}>
              <Text style={s.signupLink}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── 스타일 ───────────────────────────────────────────────────────
const HERO_H  = 260;
const OVERLAP = 48;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.green },

  // 히어로
  hero: {
    height: HERO_H,
    backgroundColor: C.green,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute', top: 12, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 24, color: '#fff', lineHeight: 28 },
  heroContent: { alignItems: 'center', paddingBottom: OVERLAP + 24 },
  logoBadge: {
    width: 56, height: 56, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoBadgeEmoji: { fontSize: 26 },
  heroTitle: {
    fontSize: 34, fontWeight: '700', color: '#fff',
    letterSpacing: -0.8,
  },
  heroSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)',
    marginTop: 4, letterSpacing: 0.2,
  },
  // 장식 원
  decCircle1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40, right: -40,
  },
  decCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 20, left: -30,
  },

  // 카드
  kav:  { flex: 1, marginTop: -OVERLAP },
  card: { flex: 1 },
  cardContent: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48,
    gap: 0,
    flexGrow: 1,
  },
  cardTitle: {
    fontSize: 26, fontWeight: '700', color: C.textPri,
    letterSpacing: -0.6, marginBottom: 6,
  },
  cardSub: {
    fontSize: 14, color: C.textSub,
    marginBottom: 28,
  },

  // 소셜 버튼
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20,
    marginBottom: 12, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  socialIcon:  { fontSize: 20 },
  socialLabel: { fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },

  // 구분선
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(190,202,185,0.4)' },
  dividerText: { fontSize: 13, color: C.textMuted },

  // 이메일 버튼
  emailBtn: {
    borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', backgroundColor: C.surface,
  },
  emailBtnText: { fontSize: 15, fontWeight: '700', color: C.textPri },

  // 이메일 폼
  formBack: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 20,
  },
  formBackIcon: { fontSize: 22, color: C.green, lineHeight: 26 },
  formBackText: { fontSize: 14, color: C.green, fontWeight: '700' },

  inputWrap: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13, fontWeight: '700', color: C.textSub,
    marginBottom: 6, letterSpacing: 0.2,
  },
  input: {
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.textPri,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  pwInput: { flex: 1 },
  pwToggle: { position: 'absolute', right: 14 },
  pwToggleText: { fontSize: 13, color: C.green, fontWeight: '700' },

  forgotWrap: { alignItems: 'flex-end', marginBottom: 24, marginTop: -4 },
  forgotText: { fontSize: 13, color: C.green },

  loginBtn: {
    backgroundColor: C.green, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 4,
  },
  loginBtnDisabled: { backgroundColor: C.textMuted, shadowOpacity: 0 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // 회원가입
  signupRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 24,
  },
  signupText: { fontSize: 14, color: C.textSub },
  signupLink: { fontSize: 14, fontWeight: '700', color: C.green },
});
