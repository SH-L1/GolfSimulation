import React, { useState, useEffect, useCallback, useRef, Component } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import UnityView from '@azesmway/react-native-unity';
import { AppHeader } from '../../components/ui/AppHeader';
import { useLandmarks } from '../../hooks/useLandmarks';
import { PhaseTimeline } from '../../components/module3/PhaseTimeline';
import { getCurrentSessionId } from '../../store/analysisStore';
import { PHASE_LABEL } from '../../constants/swing';
import { getProRecommendations } from '../../api/module3';
import { API_BASE, getToken } from '../../api/client';

// ── ErrorBoundary ────────────────────────────────────────────────
class UnityErrorBoundary extends Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  componentDidCatch() { this.setState({ crashed: true }); }
  render() {
    if (this.state.crashed) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>Unity 초기화 실패</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── 상수 ─────────────────────────────────────────────────────────
const C = {
  dark:     '#0c0a09',
  green:    '#006e1c',
  surface:  '#ffffff',
  textSub:  '#3f4a3c',
  textMuted:'#78716c',
  glass:    'rgba(20,20,20,0.72)',
  glassBright: 'rgba(255,255,255,0.12)',
  grayBar:  '#e1e3e1',
  grayLight:'#f2f4f2',
  grayChip: '#e6e9e7',
};

const SPEEDS = [
  { label: '0.2x', val: 0.2 },
  { label: '0.5x', val: 0.5 },
  { label: '1x',   val: 1.0 },
];

const CAM_VIEWS   = ['정면', '측면', '후면'];
const CAM_NAMES   = ['front', 'side', 'back'];
const OPACITY_STEPS  = [0, 0.5, 1.0];
const OPACITY_LABELS = ['0%', '50%', '100%'];

type ViewMode = 'user' | 'overlay' | 'pro';
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  user: '내 스윙', overlay: '오버레이', pro: '프로',
};

type Props = {
  navigation?: any;
  route?: { params?: { sessionId?: string } };
};

// ── 컴포넌트 ─────────────────────────────────────────────────────
export const Viewer3DScreen: React.FC<Props> = ({ navigation, route }) => {
  const sessionId = route?.params?.sessionId ?? getCurrentSessionId();
  const { userFrames, loading, error } = useLandmarks(sessionId ?? null);
  const unityRef = useRef<UnityView>(null);

  // ── 재생 상태 ──────────────────────────────────────────────────
  const [unityMounted,       setUnityMounted]       = useState(false);
  const [unityReady,         setUnityReady]         = useState(false);
  const pendingSwingUrl      = useRef<string | null>(null);
  const [playing,            setPlaying]            = useState(false);
  const [currentFrameIndex,  setCurrent]            = useState(0);
  const [activeSpeed,        setSpeed]              = useState(2);
  const [activeCam,          setCam]                = useState(0);

  // ── 비교 상태 ──────────────────────────────────────────────────
  const [compMode,   setCompMode]   = useState(false);
  const [viewMode,   setViewMode]   = useState<ViewMode>('overlay');
  const [syncOn,     setSyncOn]     = useState(true);
  const [userOpIdx,  setUserOpIdx]  = useState(2);  // 100%
  const [proOpIdx,   setProOpIdx]   = useState(1);  // 50%
  const [proLoaded,  setProLoaded]  = useState(false);
  const [proLoading, setProLoading] = useState(false);


  const frames = userFrames?.frames ?? [];
  const fps    = userFrames?.fps ?? 30;
  const total  = frames.length;


  // ── Unity 마운트 ───────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setUnityMounted(true), 250);
    return () => clearTimeout(t);
  }, []);

  // ── Unity 스윙 데이터 전송 헬퍼 ───────────────────────────────
  const currentFrameRef = useRef(0);
  const trackWidth      = useRef(0);
  useEffect(() => { currentFrameRef.current = currentFrameIndex; }, [currentFrameIndex]);

  const sendSwingData = useCallback((url: string) => {
    if (!unityRef.current) { return; }
    const trimmed = url.trim();
    unityRef.current.postMessage('SwingController', 'LoadSwingData', trimmed);
    console.log('[Unity] LoadSwingData sent:', trimmed);
  }, []);

  useFocusEffect(useCallback(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation?.goBack();
      return true;
    });

    unityRef.current?.windowFocusChanged(true);

    // 재진입 시 Unity가 이미 ready 상태면 토큰 새로 발급 후 재전송 (stale 토큰 방지)
    if (unityReady && userFrames?.final_json_path) {
      getToken().then(token => {
        const serverBase = API_BASE.replace(/\/api$/, '');
        const base = `${serverBase}/${userFrames.final_json_path.replace(/\\/g, '/')}`;
        const url = token ? `${base}?token=${token}` : base;
        pendingSwingUrl.current = url;
        setTimeout(() => sendSwingData(url), 300);
      });
    }

    return () => {
      backSub.remove();
      setPlaying(false);
      unityRef.current?.windowFocusChanged(false);
    };
  }, [navigation, unityReady, userFrames, sendSwingData]));

  // ── userFrames 로드 시 URL 저장 + 준비되면 즉시 전송 ──────────
  useEffect(() => {
    if (!userFrames?.final_json_path) { return; }
    getToken().then(token => {
      const serverBase = API_BASE.replace(/\/api$/, '');
      const base = `${serverBase}/${userFrames.final_json_path.replace(/\\/g, '/')}`;
      const url = token ? `${base}?token=${token}` : base;
      pendingSwingUrl.current = url;
      if (unityReady) { sendSwingData(url); }
    });
  }, [userFrames, unityReady, sendSwingData]);

  // ── onUnityMessage: Unity 준비 감지 + 대기 중 URL 전송 ────────
  const handleUnityMessage = useCallback((msg: string) => {
    console.log('[Unity] message:', msg);
    if (!unityReady) {
      setUnityReady(true);
      if (pendingSwingUrl.current) {
        sendSwingData(pendingSwingUrl.current);
      }
    }
  }, [unityReady, sendSwingData]);

  // ── 폴백: onUnityMessage 없을 때 5s/10s 후 재시도 ─────────────
  useEffect(() => {
    if (!unityMounted) { return; }
    const t1 = setTimeout(() => {
      if (!unityReady && pendingSwingUrl.current) {
        console.log('[Unity] 5s fallback retry');
        sendSwingData(pendingSwingUrl.current);
      }
    }, 5000);
    const t2 = setTimeout(() => {
      if (!unityReady && pendingSwingUrl.current) {
        console.log('[Unity] 10s fallback retry');
        sendSwingData(pendingSwingUrl.current);
      }
    }, 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [unityMounted]);

  // ── Unity: 프로 추천 1위 자동 로드 ────────────────────────────
  useEffect(() => {
    if (!sessionId) { return; }
    setProLoading(true);
    getProRecommendations(sessionId, 1)
      .then(res => {
        console.log('[Pro] recommend res:', JSON.stringify(res?.neighbors?.[0]));
        const top = res.neighbors[0];
        if (top?.swing_url) {
          getToken().then(token => {
            const serverBase = API_BASE.replace(/\/api$/, '');
            const base = `${serverBase}/${top.swing_url}`;
            const fullUrl = token ? `${base}&token=${token}` : base;
            unityRef.current?.postMessage('SwingController', 'LoadReferenceSwingData', fullUrl);
            console.log('[Unity] LoadReferenceSwingData sent:', fullUrl);
            setProLoaded(true);
          });
        } else {
          console.log('[Pro] swing_url 없음, neighbors:', res?.neighbors?.length);
        }
      })
      .catch(e => { console.log('[Pro] recommend error:', e?.status, e?.code, e?.message); })
      .finally(() => setProLoading(false));
  }, [sessionId]);

  // ── Unity: 프레임 동기화 ───────────────────────────────────────
  useEffect(() => {
    if (!unityReady || !unityRef.current || total === 0) { return; }
    const f = frames[currentFrameIndex]?.frame ?? currentFrameIndex;
    unityRef.current.postMessage('SwingController', 'SeekFrame', String(f));
  }, [currentFrameIndex, unityReady]);

  // ── Unity: 비교 모드 전환 (unityReady 후에만) ─────────────────
  useEffect(() => {
    if (!unityReady || !unityRef.current) { return; }
    const u = unityRef.current;
    if (!compMode) {
      u.postMessage('SwingController', 'SetUserAvatarVisible',      'true');
      u.postMessage('SwingController', 'SetReferenceAvatarVisible', 'false');
      u.postMessage('SwingController', 'SetComparisonOverlayEnabled', 'false');
      return;
    }
    u.postMessage('SwingController', 'SetComparisonOverlayEnabled', 'true');
    switch (viewMode) {
      case 'user':
        u.postMessage('SwingController', 'SetUserAvatarVisible',      'true');
        u.postMessage('SwingController', 'SetReferenceAvatarVisible', 'false');
        break;
      case 'pro':
        u.postMessage('SwingController', 'SetUserAvatarVisible',      'false');
        u.postMessage('SwingController', 'SetReferenceAvatarVisible', 'true');
        break;
      case 'overlay':
        u.postMessage('SwingController', 'SetUserAvatarVisible',      'true');
        u.postMessage('SwingController', 'SetReferenceAvatarVisible', 'true');
        break;
    }
  }, [unityReady, compMode, viewMode]);

  // ── Unity: 싱크 ───────────────────────────────────────────────
  useEffect(() => {
    if (!unityReady) { return; }
    unityRef.current?.postMessage('SwingController', 'SetComparisonSyncEnabled', syncOn ? 'true' : 'false');
  }, [syncOn, unityReady]);

  // ── Unity: 투명도 ──────────────────────────────────────────────
  useEffect(() => {
    if (!unityReady) { return; }
    unityRef.current?.postMessage('SwingController', 'SetUserAvatarOpacity', String(OPACITY_STEPS[userOpIdx]));
  }, [userOpIdx, unityReady]);

  useEffect(() => {
    if (!unityReady) { return; }
    unityRef.current?.postMessage('SwingController', 'SetReferenceAvatarOpacity', String(OPACITY_STEPS[proOpIdx]));
  }, [proOpIdx, unityReady]);

  // ── Unity: 배속 ───────────────────────────────────────────────
  useEffect(() => {
    if (!unityReady) { return; }
    unityRef.current?.postMessage('SwingController', 'SetPlaybackSpeed', String(SPEEDS[activeSpeed].val));
  }, [activeSpeed, unityReady]);

  // ── 재생 루프 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || total === 0) { return; }
    const ms = (1000 / fps) / SPEEDS[activeSpeed].val;
    const t = setInterval(() => {
      setCurrent(prev => {
        if (prev >= total - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, ms);
    return () => clearInterval(t);
  }, [playing, total, fps, activeSpeed]);

  // playing 상태에 따라 Pause/Play 전송 — unityMounted 이후 항상 동작
  useEffect(() => {
    if (!unityMounted) { return; }
    if (playing) {
      unityRef.current?.postMessage('SwingController', 'Play', '');
    } else {
      unityRef.current?.postMessage('SwingController', 'Pause', '');
    }
  }, [playing, unityMounted]);

  // ── 핸들러 ───────────────────────────────────────────────────
const handleSeek = useCallback((frameNum: number) => {
    const idx = frames.findIndex(f => f.frame === frameNum);
    if (idx >= 0) { setCurrent(idx); }
  }, [frames]);

  const cycleCam = () => {
    const next = (activeCam + 1) % CAM_VIEWS.length;
    setCam(next);
    unityRef.current?.postMessage('SwingController', 'SetCameraView', CAM_NAMES[next]);
  };

  // ── 진행률 / 타임 ─────────────────────────────────────────────
  const progress  = total > 1 ? currentFrameIndex / (total - 1) : 0;
  const currentMs = (frames[currentFrameIndex]?.timestamp ?? 0) * 1000;
  const totalMs   = (frames.at(-1)?.timestamp ?? 0) * 1000;
  const fmtMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <AppHeader navigation={navigation} />

      <View style={s.viewport}>
        {/* Unity */}
        {unityMounted && (
          <UnityErrorBoundary>
            <UnityView ref={unityRef} style={StyleSheet.absoluteFill} onUnityMessage={handleUnityMessage} {...{ androidKeepPlayerMounted: true } as any} />
          </UnityErrorBoundary>
        )}

        {/* 로딩/에러 */}
        {loading && (
          <View style={s.centerState}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={s.centerText}>스윙 데이터 로딩 중...</Text>
          </View>
        )}
        {!loading && error && (
          <View style={s.centerState}>
            <Text style={[s.centerText, { color: '#ef4444' }]}>{error}</Text>
          </View>
        )}

        {/* ── 좌측 상단: 카메라 ── */}
        <TouchableOpacity style={s.camBtn} onPress={cycleCam}>
          <Text style={s.camIcon}>📷</Text>
          <Text style={s.camLabel}>{CAM_VIEWS[activeCam]}</Text>
        </TouchableOpacity>

        {/* ── 우측 상단: 페이즈 + 비교 토글 ── */}
        <View style={s.topRight}>
          <View style={s.hudPhaseBox}>
            <Text style={s.hudSub}>페이즈</Text>
            <Text style={s.hudPhase}>
              {frames[currentFrameIndex]?.phase
                ? (PHASE_LABEL[frames[currentFrameIndex].phase!] ?? frames[currentFrameIndex].phase)
                : '—'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.compToggleBtn, compMode && s.compToggleBtnOn]}
            onPress={() => setCompMode(v => !v)}
            disabled={!proLoaded}>
            {proLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.compToggleText}>
                  {proLoaded ? (compMode ? '비교 ON' : '비교') : '추천 없음'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── 비교 모드 패널 ── */}
        {compMode && (
          <View style={s.compPanel}>
            {/* 뷰 모드 */}
            <View style={s.compRow}>
              {(['user', 'overlay', 'pro'] as ViewMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[s.viewChip, viewMode === mode && s.viewChipActive]}
                  onPress={() => setViewMode(mode)}>
                  <Text style={[s.viewChipText, viewMode === mode && s.viewChipTextActive]}>
                    {VIEW_MODE_LABELS[mode]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 싱크 */}
            <TouchableOpacity style={s.syncRow} onPress={() => setSyncOn(v => !v)}>
              <Text style={s.syncLabel}>싱크</Text>
              <View style={[s.toggleTrack, syncOn && s.toggleTrackOn]}>
                <View style={[s.toggleThumb, syncOn && s.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* 투명도 — 내 스윙 */}
            {viewMode !== 'pro' && (
              <View style={s.opacityRow}>
                <Text style={s.opacityLabel}>내 스윙</Text>
                <View style={s.opacityBtns}>
                  {OPACITY_LABELS.map((lbl, i) => (
                    <TouchableOpacity
                      key={lbl}
                      style={[s.opacityBtn, userOpIdx === i && s.opacityBtnActive]}
                      onPress={() => setUserOpIdx(i)}>
                      <Text style={[s.opacityBtnText, userOpIdx === i && s.opacityBtnTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 투명도 — 프로 */}
            {viewMode !== 'user' && (
              <View style={s.opacityRow}>
                <Text style={s.opacityLabel}>프로</Text>
                <View style={s.opacityBtns}>
                  {OPACITY_LABELS.map((lbl, i) => (
                    <TouchableOpacity
                      key={lbl}
                      style={[s.opacityBtn, proOpIdx === i && s.opacityBtnActive]}
                      onPress={() => setProOpIdx(i)}>
                      <Text style={[s.opacityBtnText, proOpIdx === i && s.opacityBtnTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── 하단 스크러버 ── */}
        <View style={s.scrubber}>
          {/* 진행 바 — 터치로 프레임 이동 */}
          <View style={s.timeRow}>
            <Text style={s.timeText}>{fmtMs(currentMs)}</Text>
            <View
              style={s.trackOuter}
              onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFill}
                onPress={e => {
                  if (total === 0 || !trackWidth.current) { return; }
                  const ratio = e.nativeEvent.locationX / trackWidth.current;
                  const idx = Math.round(Math.max(0, Math.min(1, ratio)) * (total - 1));
                  setCurrent(idx);
                }}
              />
              <View style={s.trackBg} />
              <View style={[s.trackFill, { width: `${progress * 100}%` as any }]} />
              <View style={[s.trackThumb, { left: `${progress * 100}%` as any }]} />
            </View>
            <Text style={s.timeText}>{fmtMs(totalMs)}</Text>
          </View>

          {/* 페이즈 타임라인 — 진행바 트랙 너비에 맞춤 (timeText 38px 제외) */}
          {frames.length > 0 && (
            <View style={{ marginLeft: 38, marginRight: 38 }}>
              <PhaseTimeline frames={frames} currentIndex={currentFrameIndex} onSeek={handleSeek} />
            </View>
          )}

          {/* 재생 + 배속 한 줄 */}
          <View style={s.controlRow}>
            <TouchableOpacity
              style={[s.playBtn, total === 0 && { opacity: 0.4 }]}
              onPress={() => {
                if (!playing && currentFrameIndex >= total - 1) { setCurrent(0); }
                setPlaying(v => !v);
              }}
              disabled={total === 0}>
              <Text style={s.playIcon}>{playing ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
            <View style={s.speedRow}>
              {SPEEDS.map((sp, i) => (
                <TouchableOpacity
                  key={sp.label}
                  style={[s.speedBtn, activeSpeed === i && s.speedBtnActive]}
                  onPress={() => setSpeed(i)}>
                  <Text style={[s.speedText, activeSpeed === i && s.speedTextActive]}>{sp.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// ── 스타일 ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.dark },
  viewport: { flex: 1, backgroundColor: C.dark, overflow: 'hidden' },

  centerState: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  centerText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  // 카메라 버튼 — Unity 자체 UI 덮기 위해 크게
  camBtn: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderBottomRightRadius: 18,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: 120,
  },
  camIcon:  { fontSize: 20 },
  camLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 우측 상단
  topRight: {
    position: 'absolute', top: 16, right: 16,
    alignItems: 'flex-end', gap: 8,
  },
  hudPhaseBox: {
    backgroundColor: C.glass,
    borderRadius: 14, padding: 10, alignItems: 'flex-end',
    borderWidth: 1, borderColor: C.glassBright,
  },
  hudSub:   { fontSize: 10, fontWeight: '700', color: C.green, textTransform: 'uppercase' },
  hudPhase: { fontSize: 16, fontWeight: '700', color: '#fff' },

  compToggleBtn: {
    backgroundColor: C.glass,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: C.glassBright,
    minWidth: 72, alignItems: 'center',
  },
  compToggleBtnOn: { backgroundColor: C.green, borderColor: C.green },
  compToggleText:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  // 비교 패널
  compPanel: {
    position: 'absolute', right: 16, top: 160,
    backgroundColor: C.glass,
    borderRadius: 16, padding: 12, gap: 10, minWidth: 180,
    borderWidth: 1, borderColor: C.glassBright,
  },
  compRow:   { flexDirection: 'row', gap: 6 },
  viewChip:  {
    flex: 1, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.glassBright, alignItems: 'center',
  },
  viewChipActive:     { backgroundColor: C.green },
  viewChipText:       { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  viewChipTextActive: { color: '#fff' },

  syncRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  toggleTrack: {
    width: 38, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleTrackOn:  { backgroundColor: C.green },
  toggleThumb:    { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  toggleThumbOn:  { alignSelf: 'flex-end' },

  opacityRow:  { gap: 4 },
  opacityLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  opacityBtns:  { flexDirection: 'row', gap: 4 },
  opacityBtn:   {
    flex: 1, paddingVertical: 5, borderRadius: 6,
    backgroundColor: C.glassBright, alignItems: 'center',
  },
  opacityBtnActive:     { backgroundColor: '#fff' },
  opacityBtnText:       { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  opacityBtnTextActive: { color: C.dark },

  // 스크러버 — 하단 고정, 전체 너비, 컴팩트
  scrubber: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText:  { fontSize: 10, fontWeight: '700', color: C.textMuted, width: 28 },
  trackOuter:{ flex: 1, height: 24, justifyContent: 'center', position: 'relative' },
  trackBg:   {
    height: 6, backgroundColor: C.grayBar,
    borderRadius: 999, position: 'absolute', left: 0, right: 0,
  },
  trackFill: { height: 6, backgroundColor: C.green, borderRadius: 999, position: 'absolute', left: 0 },
  trackThumb:{
    width: 16, height: 16, borderRadius: 8, backgroundColor: C.green,
    position: 'absolute', top: 4, marginLeft: -8,
    shadowColor: C.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },

  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phaseChips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', flex: 1 },
  phaseChip:  {
    backgroundColor: C.grayChip, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  phaseChipActive:     { backgroundColor: C.green },
  phaseChipText:       { fontSize: 10, fontWeight: '700', color: C.textSub },
  phaseChipTextActive: { color: '#fff' },

  playBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.green, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  playIcon: { fontSize: 16, color: '#fff', marginLeft: 2 },

  speedRow: {
    flexDirection: 'row', gap: 4,
    backgroundColor: '#f2f4f2', borderRadius: 999, padding: 4, alignSelf: 'flex-start',
  },
  speedBtn:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  speedBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  speedText:       { fontSize: 10, fontWeight: '700', color: C.textSub },
  speedTextActive: { color: C.green },
});
