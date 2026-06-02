import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFabBottom } from '../../hooks/useFabBottom';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSpacer } from '../../components/ui/BottomSpacer';
import { AppHeader } from '../../components/ui/AppHeader';
import type { ClubType, ViewType } from '../../hooks/useSwingAnalysis';
import { usePolling } from '../../hooks/usePolling';
import { useSwingAnalysis } from '../../hooks/useSwingAnalysis';
import { VideoTrimEditor } from '../../components/VideoTrimEditor';

const C = {
  bg:          '#f8faf8',
  surface:     '#ffffff',
  green:       '#006e1c',
  greenMid:    '#4caf50',
  textPrimary: '#191c1b',
  textSub:     '#3f4a3c',
  textMuted:   '#78716c',
  blue:        '#0061a4',
  bluePill:    '#d1e4ff',
  blueDeep:    '#00355c',
  blueLight:   'rgba(51,160,253,0.05)',
  blueBorder:  'rgba(51,160,253,0.2)',
  chipInactive:'#e6e9e7',
};

const CLUBS: string[]        = ['드라이버', '아이언'];
const CLUB_TYPES: ClubType[] = ['driver', 'iron'];

const VIEWS: string[]        = ['정면', '측면'];
const VIEW_TYPES: ViewType[] = ['faceon', 'downtheline'];

type Props = { navigation?: any; route?: any };

const POLL_STATUS_LABEL: Record<string, string> = {
  queued:     '분석 대기 중...',
  processing: '분석 중...',
  done:       '완료!',
  error:      '오류 발생',
};

type Step = 'select' | 'trimming' | 'ready';

export const SwingUploadScreen: React.FC<Props> = ({ navigation, route }) => {
  const fabBottom = useFabBottom(true);
  const [selectedClub, setSelectedClub] = useState(0);
  const [selectedView, setSelectedView] = useState(0);
  const [rawVideoUri, setRawVideoUri]   = useState<string | null>(null);
  const [trimStart,   setTrimStart]     = useState<number | undefined>(undefined);
  const [trimEnd,     setTrimEnd]       = useState<number | undefined>(undefined);
  const [step, setStep]                 = useState<Step>('select');
  const [jobId, setJobId]               = useState<string | null>(null);

  const { uploading, uploadError, analyze } = useSwingAnalysis();
  const { status: pollStatus, sessionId: pollSessionId, error: pollError } = usePolling(jobId);
  const isAnalyzing = uploading || (jobId !== null && pollStatus !== 'done' && pollStatus !== 'error');

  // 홈에서 '스윙 기록하기' 눌러 진입 시 상태 초기화
  useEffect(() => {
    if (route?.params?.newSession) {
      setRawVideoUri(null);
      setTrimStart(undefined);
      setTrimEnd(undefined);
      setStep('select');
      setJobId(null);
    }
  }, [route?.params?.newSession]);

  // 카메라 화면에서 돌아올 때 촬영된 영상 수신 → 트림 페이지로
  useEffect(() => {
    const uri = route?.params?.recordedVideoUri;
    if (uri && uri !== rawVideoUri) {
      setRawVideoUri(uri.startsWith('file://') ? uri : `file://${uri}`);
      setStep('trimming');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.recordedVideoUri]);

  // 폴링 완료 시 결과 화면으로 이동
  useEffect(() => {
    if (pollStatus === 'done' && pollSessionId) {
      setJobId(null);
      navigation?.navigate('SwingFeedback', { sessionId: pollSessionId });
    }
    if (pollStatus === 'error') {
      setJobId(null);
      Alert.alert('오류', pollError ?? '분석 중 문제가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [pollStatus, pollSessionId, pollError, navigation]);

  useEffect(() => {
    if (uploadError) {
      const msg = uploadError.includes('ApiError') || uploadError.includes('UNAUTHORIZED')
        ? '로그인이 필요합니다.'
        : uploadError;
      Alert.alert('업로드 오류', msg);
    }
  }, [uploadError]);

  const handlePickFile = () => {
    launchImageLibrary({ mediaType: 'video', selectionLimit: 1 }, res => {
      if (res.didCancel) { return; }
      if (res.errorCode) {
        Alert.alert('오류', res.errorMessage ?? '파일을 불러올 수 없습니다.');
        return;
      }
      const asset = res.assets?.[0];
      if (asset?.uri) {
        const uri = asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`;
        setRawVideoUri(uri);
        setStep('trimming');
      }
    });
  };

  const handleAnalyze = async () => {
    if (!rawVideoUri) {
      Alert.alert('영상 필요', '영상을 선택해주세요.');
      return;
    }
    const uploadUri = rawVideoUri.startsWith('file://') ? rawVideoUri : `file://${rawVideoUri}`;
    const id = await analyze({
      videoUri: uploadUri,
      viewType: VIEW_TYPES[selectedView],
      clubType: CLUB_TYPES[selectedClub],
      trimStart,
      trimEnd,
    });
    if (id) { setJobId(id); }
  };

  const handleReset = () => {
    setRawVideoUri(null);
    setTrimStart(undefined);
    setTrimEnd(undefined);
    setStep('select');
  };

  // 트림 편집 화면 (ScrollView 없이 전체 화면 차지)
  if (step === 'trimming' && rawVideoUri) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <AppHeader navigation={navigation} />
        <View style={s.trimWrapper}>
          <VideoTrimEditor
            videoUri={rawVideoUri}
            onConfirm={(uri, startMs, endMs) => {
              setRawVideoUri(uri);
              setTrimStart(startMs);
              setTrimEnd(endMs);
              setStep('ready');
            }}
            onCancel={() => {
              setRawVideoUri(null);
              setTrimStart(undefined);
              setTrimEnd(undefined);
              setStep('select');
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader navigation={navigation} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 헤더 */}
        <View style={s.headerSection}>
          <Text style={s.pageTitle}>분석 준비</Text>
          <Text style={s.pageSubtitle}>
            {step === 'select'
              ? '영상을 선택하거나 직접 촬영해 주세요.'
              : '클럽과 촬영 방향을 선택하고 분석을 시작하세요.'}
          </Text>
        </View>

        {/* Step 1: 영상 선택 전 */}
        {step === 'select' && (
          <View style={s.pickSection}>
            <TouchableOpacity
              style={s.btnCamera}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('Camera')}>
              <Text style={s.btnCameraIcon}>📷</Text>
              <Text style={s.btnCameraTitle}>촬영하기</Text>
              <Text style={s.btnCameraDesc}>앱에서 바로 촬영</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnFile}
              activeOpacity={0.85}
              onPress={handlePickFile}>
              <Text style={s.btnFileIcon}>📁</Text>
              <Text style={s.btnFileTitle}>파일 선택</Text>
              <Text style={s.btnFileDesc}>갤러리에서 불러오기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: 영상 선택 완료 — 클럽 선택 + 분석 버튼 */}
        {step === 'ready' && rawVideoUri && (
          <>
            <View style={s.detailCard}>
              <Text style={s.detailTitle}>촬영 방향</Text>
              <View style={s.chipRow}>
                {VIEWS.map((view, i) => (
                  <TouchableOpacity
                    key={view}
                    style={[s.chip, selectedView === i && s.chipActive]}
                    onPress={() => setSelectedView(i)}>
                    <Text style={[s.chipText, selectedView === i && s.chipTextActive]}>
                      {view}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.detailTitle}>클럽 종류</Text>
              <View style={s.chipRow}>
                {CLUBS.map((club, i) => (
                  <TouchableOpacity
                    key={club}
                    style={[s.chip, selectedClub === i && s.chipActive]}
                    onPress={() => setSelectedClub(i)}>
                    <Text style={[s.chipText, selectedClub === i && s.chipTextActive]}>
                      {club}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.actionButtons}>
                <TouchableOpacity
                  style={[s.btnPrimary, isAnalyzing && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                  disabled={isAnalyzing}
                  onPress={() => { void handleAnalyze(); }}>
                  {isAnalyzing
                    ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={s.btnPrimaryText}>{POLL_STATUS_LABEL[pollStatus] ?? '처리 중...'}</Text>
                      </View>
                    )
                    : <Text style={s.btnPrimaryText}>🔍  분석 시작</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.rePickBtn} onPress={handleReset}>
                  <Text style={s.rePickText}>🔄 처음부터</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Pro Tip */}
        <View style={s.tipCard}>
          <View style={s.tipHeader}>
            <Text style={s.tipIcon}>💡</Text>
            <Text style={s.tipTitle}>PRO TIP</Text>
          </View>
          <Text style={s.tipBody}>
            {step === 'ready'
              ? '클럽 선택과 촬영 방향을 정확히 입력하면 더 정밀한 분석 결과를 받을 수 있습니다.'
              : '정면에서 전신이 보이도록 촬영하면 더 정확한 분석이 가능합니다.'}
          </Text>
        </View>

        <BottomSpacer tabBar />
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, { bottom: fabBottom }]}
        onPress={() => navigation?.getParent()?.navigate('SwingChat')}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },

  trimWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 20 },

  headerSection: { gap: 4 },
  pageTitle: { fontSize: 30, fontWeight: '700', color: C.textPrimary },
  pageSubtitle: { fontSize: 15, color: C.textSub, lineHeight: 24 },

  pickSection: { flexDirection: 'row', gap: 12 },
  btnCamera: {
    flex: 1, backgroundColor: C.green, borderRadius: 24,
    paddingVertical: 28, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  btnCameraIcon: { fontSize: 32 },
  btnCameraTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnCameraDesc: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  btnFile: {
    flex: 1, backgroundColor: C.surface, borderRadius: 24,
    paddingVertical: 28, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: C.blueBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  btnFileIcon: { fontSize: 32 },
  btnFileTitle: { fontSize: 16, fontWeight: '700', color: C.blueDeep },
  btnFileDesc: { fontSize: 12, color: C.textMuted },

  videoCard: {
    backgroundColor: '#000', borderRadius: 28, overflow: 'hidden', height: 240,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  videoThumb: { width: '100%', height: '100%' },
  videoTagLeft: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ba1a1a' },
  videoTagText: { fontSize: 10, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.5 },

  detailCard: {
    backgroundColor: C.surface, borderRadius: 28, padding: 22, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.chipInactive, alignItems: 'center',
  },
  chipActive: { backgroundColor: C.green },
  chipText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  chipTextActive: { color: '#fff' },

  actionButtons: { gap: 10, marginTop: 4 },
  btnPrimary: {
    backgroundColor: C.green, borderRadius: 999,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  rePickBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blueBorder,
    alignItems: 'center',
  },
  rePickText: { fontSize: 13, fontWeight: '700', color: C.blueDeep },

  tipCard: { backgroundColor: C.bluePill, borderRadius: 28, padding: 18, gap: 8 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipIcon: { fontSize: 13 },
  tipTitle: { fontSize: 10, fontWeight: '700', color: '#001d36', letterSpacing: 1, textTransform: 'uppercase' },
  tipBody: { fontSize: 12, color: '#00497d', lineHeight: 20 },

  fab: {
    position: 'absolute', right: 22, bottom: 90,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: C.greenMid,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 22 },
});
