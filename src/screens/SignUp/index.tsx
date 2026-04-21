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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg:       '#f8faf8',
  green:    '#006e1c',
  greenMid: '#4caf50',
  textPri:  '#191c1b',
  textSub:  '#3f4a3c',
  textMuted:'#9ca3af',
  surface:  '#ffffff',
  inputBg:  '#e1e3e1',
  error:    '#ba1a1a',
};

type Props = { navigation?: any };

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);

  const pwMismatch  = confirm.length > 0 && password !== confirm;
  const canSubmit   = name.trim() && email.trim() && password.length >= 6 && password === confirm;

  // 백엔드 미개발 — 완료 시 LevelSetting으로 이동
  const handleSignUp = () => {
    if (!canSubmit) return;
    navigation?.navigate('LevelSetting', { nextScreen: 'Main' });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── 히어로 ─────────────────────────────────────────── */}
      <View style={s.hero}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation?.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
        </SafeAreaView>

        <View style={s.heroContent}>
          <View style={s.logoBadge}>
            <Text style={s.logoBadgeEmoji}>⛳</Text>
          </View>
          <Text style={s.heroTitle}>Handy</Text>
          <Text style={s.heroSub}>함께 시작해요</Text>
        </View>

        <View style={s.decCircle1} pointerEvents="none" />
        <View style={s.decCircle2} pointerEvents="none" />
      </View>

      {/* ── 카드 ───────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.card}
          contentContainerStyle={s.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={s.cardTitle}>계정 만들기</Text>
          <Text style={s.cardSub}>간단한 정보만 입력하면 바로 시작할 수 있어요.</Text>

          {/* 이름 */}
          <Field label="이름">
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="홍길동"
              placeholderTextColor={C.textMuted}
              autoCorrect={false}
            />
          </Field>

          {/* 이메일 */}
          <Field label="이메일">
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
          </Field>

          {/* 비밀번호 */}
          <Field label="비밀번호" hint="6자 이상">
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
          </Field>

          {/* 비밀번호 확인 */}
          <Field
            label="비밀번호 확인"
            error={pwMismatch ? '비밀번호가 일치하지 않습니다.' : undefined}>
            <View style={s.pwRow}>
              <TextInput
                style={[
                  s.input, s.pwInput,
                  pwMismatch && s.inputError,
                ]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showCf}
              />
              <TouchableOpacity
                style={s.pwToggle}
                onPress={() => setShowCf(v => !v)}>
                <Text style={s.pwToggleText}>{showCf ? '숨김' : '표시'}</Text>
              </TouchableOpacity>
            </View>
          </Field>

          {/* 회원가입 버튼 */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSignUp}
            activeOpacity={0.85}
            disabled={!canSubmit}>
            <Text style={s.submitText}>회원가입</Text>
          </TouchableOpacity>

          {/* 로그인 링크 */}
          <View style={s.loginRow}>
            <Text style={s.loginText}>이미 계정이 있으신가요? </Text>
            <TouchableOpacity onPress={() => navigation?.goBack()}>
              <Text style={s.loginLink}>로그인</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── 필드 래퍼 컴포넌트 ──────────────────────────────────────────
const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, hint, error, children }) => (
  <View style={f.wrap}>
    <View style={f.labelRow}>
      <Text style={f.label}>{label}</Text>
      {hint && <Text style={f.hint}>{hint}</Text>}
    </View>
    {children}
    {error && <Text style={f.error}>{error}</Text>}
  </View>
);

const f = StyleSheet.create({
  wrap:     { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label:    { fontSize: 13, fontWeight: '700', color: '#3f4a3c', letterSpacing: 0.2 },
  hint:     { fontSize: 11, color: '#9ca3af' },
  error:    { fontSize: 12, color: '#ba1a1a', marginTop: 4 },
});

// ─── 스타일 ───────────────────────────────────────────────────────
const HERO_H  = 220;
const OVERLAP = 48;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#006e1c' },

  // 히어로
  hero: { height: HERO_H, backgroundColor: '#006e1c', justifyContent: 'flex-end', overflow: 'hidden' },
  backBtn: {
    margin: 12, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 24, color: '#fff', lineHeight: 28 },
  heroContent: { alignItems: 'center', paddingBottom: OVERLAP + 20 },
  logoBadge: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  logoBadgeEmoji: { fontSize: 22 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.6 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  decCircle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -30, right: -30,
  },
  decCircle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 10, left: -20,
  },

  // 카드
  kav:  { flex: 1, marginTop: -OVERLAP },
  card: { flex: 1 },
  cardContent: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48,
    flexGrow: 1,
  },
  cardTitle: { fontSize: 24, fontWeight: '700', color: C.textPri, letterSpacing: -0.5, marginBottom: 6 },
  cardSub:   { fontSize: 14, color: C.textSub, marginBottom: 28 },

  // 입력
  input: {
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.textPri,
  },
  inputError: { borderWidth: 1.5, borderColor: C.error },
  pwRow:      { flexDirection: 'row', alignItems: 'center' },
  pwInput:    { flex: 1 },
  pwToggle:   { position: 'absolute', right: 14 },
  pwToggleText: { fontSize: 13, color: C.green, fontWeight: '700' },

  // 버튼
  submitBtn: {
    backgroundColor: C.green, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 8,
    shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: C.textMuted, shadowOpacity: 0 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // 로그인 링크
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  loginText: { fontSize: 14, color: C.textSub },
  loginLink: { fontSize: 14, fontWeight: '700', color: C.green },
});
