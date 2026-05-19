import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import UnityView from '@azesmway/react-native-unity';
import { AppHeader } from '../../components/ui/AppHeader';
import { useLandmarks } from '../../hooks/useLandmarks';
import { PhaseTimeline } from '../../components/module3/PhaseTimeline';
import { getCurrentSessionId } from '../../store/analysisStore';

const C = {
  bg:          '#f8faf8',
  dark:        '#0c0a09',
  green:       '#006e1c',
  greenMid:    '#4caf50',
  surface:     '#ffffff',
  textPrimary: '#191c1b',
  textSub:     '#3f4a3c',
  textMuted:   '#78716c',
  glass:       'rgba(255,255,255,0.75)',
  grayChip:    '#e6e9e7',
  grayLight:   '#f2f4f2',
  grayBar:     '#e1e3e1',
};

const SPEEDS: { label: string; multiplier: number }[] = [
  { label: '0.2x', multiplier: 0.2 },
  { label: '0.5x', multiplier: 0.5 },
  { label: '1x',   multiplier: 1.0 },
];

const VIEWS = ['정면 뷰', '측면 뷰', '후면 뷰'];

// 페이즈 레이블
const PHASE_LABEL: Record<string, string> = {
  address: '어드레스',
  top:     '탑',
  impact:  '임팩트',
  finish:  '피니시',
};

type Props = {
  navigation?: any;
  route?: { params?: { sessionId?: string } };
};

export const Viewer3DScreen: React.FC<Props> = ({ navigation, route }) => {
  const routeSessionId = route?.params?.sessionId;
  const sessionId      = routeSessionId ?? getCurrentSessionId();

  const unityRef = useRef<UnityView>(null);

  const { userFrames, loading, error } = useLandmarks(sessionId ?? null);

  const [activeSpeed, setSpeed]   = useState(2);
  const [activeView, setView]     = useState(0);
  const [playing, setPlaying]     = useState(false);
  const [currentFrameIndex, setCurrent] = useState(0);

  const { width: windowWidth } = useWindowDimensions();

  const frames = userFrames?.frames ?? [];
  const fps    = userFrames?.fps ?? 30;
  const total  = frames.length;

  // ── 페이즈 목록 (고유 페이즈, 순서 유지) ────────────────────────
  const phases = React.useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    frames.forEach(f => { if (!seen.has(f.phase)) { seen.add(f.phase); list.push(f.phase); } });
    return list;
  }, [frames]);

  const [activePhaseKey, setActivePhaseKey] = useState<string | null>(null);

  // 재생 중 현재 프레임 phase 변경 시 activePhaseKey 자동 업데이트
  useEffect(() => {
    const phase = frames[currentFrameIndex]?.phase ?? null;
    if (phase && phase !== activePhaseKey) { setActivePhaseKey(phase); }
  }, [currentFrameIndex, frames]);

  // 프레임 변경 시 Unity에 현재 프레임 데이터 전송
  useEffect(() => {
    const frame = frames[currentFrameIndex];
    if (!frame || !unityRef.current) { return; }
    unityRef.current.postMessage(
      'SwingController',
      'OnFrameData',
      JSON.stringify(frame),
    );
  }, [currentFrameIndex, frames]);

  // 페이즈 클릭 → 해당 페이즈 첫 프레임으로 이동
  const seekToPhase = useCallback((phaseKey: string) => {
    const idx = frames.findIndex(f => f.phase === phaseKey);
    if (idx >= 0) { setCurrent(idx); }
    setActivePhaseKey(phaseKey);
  }, [frames]);

  // PhaseTimeline onSeek: frame_index 값 → 배열 인덱스 찾기
  const handleSeek = useCallback((frameIndex: number) => {
    const idx = frames.findIndex(f => f.frame_index === frameIndex);
    if (idx >= 0) { setCurrent(idx); }
  }, [frames]);

  // ── 재생 루프 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || total === 0) { return; }
    const intervalMs = (1000 / fps) / SPEEDS[activeSpeed].multiplier;
    const timer = setInterval(() => {
      setCurrent(prev => {
        if (prev >= total - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [playing, total, fps, activeSpeed]);

  // ── 현재 프레임 ──────────────────────────────────────────────────
  const userFrame = frames[currentFrameIndex] ?? null;

  // 진행률 (0~1)
  const progress = total > 1 ? currentFrameIndex / (total - 1) : 0;

  // 타임스탬프 표시
  const currentMs  = userFrame?.timestamp_ms ?? 0;
  const totalMs    = frames.at(-1)?.timestamp_ms ?? 0;
  const fmtMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = String(Math.floor(s / 60)).padStart(1, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <View style={s.root}>
      <AppHeader navigation={navigation} />

      {/* 3D 뷰포트 */}
      <View style={s.viewport}>

        {/* Unity 3D 뷰 (전체 viewport 배경) */}
        {Platform.OS === 'android' && (
          <UnityView
            ref={unityRef}
            style={StyleSheet.absoluteFill}
            androidKeepPlayerMounted
            fullScreen={false}
          />
        )}

        {/* 로딩 / 에러 오버레이 */}
        {loading && (
          <View style={s.centerState}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={s.centerText}>랜드마크 로딩 중...</Text>
          </View>
        )}
        {!loading && error && (
          <View style={s.centerState}>
            <Text style={[s.centerText, { color: '#ef4444' }]}>{error}</Text>
          </View>
        )}

        {/* 좌측 뷰 컨트롤 패널 */}
        <View style={s.leftPanel}>
          {[{ icon: '🎥', view: 0 }, { icon: '⬛', view: 1 }, { icon: '🔲', view: 2 }].map(btn => (
            <TouchableOpacity
              key={btn.view}
              style={[s.panelBtn, activeView === btn.view && s.panelBtnActive]}
              onPress={() => setView(btn.view)}>
              <Text style={s.panelBtnIcon}>{btn.icon}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 뷰 레이블 */}
        <View style={s.viewLabel}>
          <Text style={s.viewLabelText}>{VIEWS[activeView]}</Text>
        </View>

        {/* 우측 HUD */}
        <View style={s.hudPanel}>
          <Text style={s.hudSub}>현재 페이즈</Text>
          <Text style={s.hudPhase}>
            {userFrame ? (PHASE_LABEL[userFrame.phase] ?? userFrame.phase) : '—'}
          </Text>
        </View>

        {/* 하단 스크러버 */}
        <View style={[s.scrubber, { width: windowWidth * 0.92, left: windowWidth * 0.04 }]}>
          {/* 타임라인 바 */}
          <View style={s.timeRow}>
            <Text style={s.timeText}>{fmtMs(currentMs)}</Text>
            <View style={s.trackOuter}>
              <View style={s.trackBg} />
              <View style={[s.trackFill, { width: `${progress * 100}%` as any }]} />
              <View style={[s.trackThumb, { left: `${progress * 100}%` as any }]} />
            </View>
            <Text style={s.timeText}>{fmtMs(totalMs)}</Text>
          </View>

          {/* PhaseTimeline (프레임이 있을 때만) */}
          {frames.length > 0 && (
            <PhaseTimeline
              frames={frames}
              currentIndex={currentFrameIndex}
              onSeek={handleSeek}
            />
          )}

          {/* 페이즈 점프 버튼 + 재생 */}
          <View style={s.controlRow}>
            <View style={s.phaseChips}>
              {phases.map(phaseKey => (
                <TouchableOpacity
                  key={phaseKey}
                  style={[s.phaseChip, activePhaseKey === phaseKey && s.phaseChipActive]}
                  onPress={() => seekToPhase(phaseKey)}>
                  <Text style={[s.phaseChipText, activePhaseKey === phaseKey && s.phaseChipTextActive]}>
                    {PHASE_LABEL[phaseKey] ?? phaseKey}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.playBtn, total === 0 && { opacity: 0.4 }]}
              onPress={() => setPlaying(v => !v)}
              disabled={total === 0}>
              <Text style={s.playIcon}>{playing ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
          </View>

          {/* 배속 */}
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

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation?.navigate('SwingChat', { sessionId })}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.dark },

  viewport: {
    flex: 1,
    width: '100%',
    backgroundColor: C.dark,
    overflow: 'hidden',
  },
  // 로딩/에러 상태
  centerState: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  centerText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  // 좌측 패널
  leftPanel: {
    position: 'absolute', top: 20, left: 20,
    backgroundColor: C.glass,
    borderRadius: 16, padding: 6, gap: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
  },
  panelBtn: {
    width: 48, height: 48, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  panelBtnActive: { backgroundColor: C.green },
  panelBtnIcon: { fontSize: 18 },

  // 뷰 레이블
  viewLabel: {
    position: 'absolute', top: 172, left: 20,
    backgroundColor: C.glass,
    borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  viewLabelText: { fontSize: 11, fontWeight: '700', color: C.textSub, letterSpacing: 1, textTransform: 'uppercase' },

  // HUD 패널
  hudPanel: {
    position: 'absolute', top: 20, right: 20,
    backgroundColor: C.glass,
    borderRadius: 16, padding: 14, minWidth: 160, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
  },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hudLabel: { fontSize: 12, color: C.textSub },
  toggle: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: C.grayBar,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: C.greenMid },
  toggleThumb: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  hudDivider: { height: 1, backgroundColor: 'rgba(190,202,185,0.3)' },
  hudSub:  { fontSize: 11, fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: -0.5 },
  hudPhase: { fontSize: 18, fontWeight: '700', color: C.textPrimary },

  // 스크러버
  scrubber: {
    position: 'absolute', bottom: 96,
    backgroundColor: C.glass,
    borderRadius: 24, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2, shadowRadius: 30, elevation: 10,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { fontSize: 10, fontWeight: '700', color: C.textMuted, width: 28 },
  trackOuter: { flex: 1, height: 24, justifyContent: 'center', position: 'relative' },
  trackBg: {
    height: 6, backgroundColor: C.grayBar,
    borderRadius: 999, position: 'absolute', left: 0, right: 0,
  },
  trackFill: {
    height: 6, backgroundColor: C.green,
    borderRadius: 999, position: 'absolute', left: 0,
  },
  trackThumb: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.green,
    position: 'absolute', top: 4, marginLeft: -8,
    shadowColor: C.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },

  // 컨트롤 행
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phaseChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  phaseChip: {
    backgroundColor: C.grayChip, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  phaseChipActive: { backgroundColor: C.green },
  phaseChipText: { fontSize: 10, fontWeight: '700', color: C.textSub },
  phaseChipTextActive: { color: C.surface },
  playBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    marginLeft: 8,
  },
  playIcon: { fontSize: 16, color: C.surface, marginLeft: 2 },

  // 배속
  speedRow: {
    flexDirection: 'row', gap: 4,
    backgroundColor: C.grayLight,
    borderRadius: 999, padding: 4,
    alignSelf: 'flex-start',
  },
  speedBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6,
  },
  speedBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  speedText: { fontSize: 10, fontWeight: '700', color: C.textSub },
  speedTextActive: { color: C.green },

  // FAB
  fab: {
    position: 'absolute', right: 22, bottom: 112,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
    zIndex: 20,
  },
  fabIcon: { fontSize: 22 },
});
