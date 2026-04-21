import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { AppHeader } from '../../components/ui/AppHeader';

import { PLACEHOLDER_URI } from '../../assets';

// TODO: 실제 에셋으로 교체 필요 (src/assets/index.ts 참고)
const imgSkeletonUser = PLACEHOLDER_URI;
const imgSkeletonPro  = PLACEHOLDER_URI;
const imgBg           = PLACEHOLDER_URI;

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
  navInactive: '#9ca3af',
};

const PHASES = ['어드레스', '탑', '임팩트', '피니시'];
const SPEEDS = ['0.2x', '0.5x', '1x'];
const VIEWS  = ['정면 뷰', '측면 뷰', '후면 뷰'];

type Props = {
  navigation?: any;
  route?: { params?: { sessionId?: string } };
};

export const Viewer3DScreen: React.FC<Props> = ({ navigation, route }) => {
  // TODO: sessionId로 GET /module3/landmarks/{sessionId} 호출
  const sessionId = route?.params?.sessionId;
  void sessionId;
  const [shadowOn, setShadowOn]     = useState(true);
  const [activePhase, setPhase]     = useState(1);
  const [activeSpeed, setSpeed]     = useState(1);
  const [activeView, setView]       = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [scrubPct]                  = useState(0.45);

  return (
    <View style={s.root}>
      <AppHeader navigation={navigation} />

      {/* 3D 뷰포트 */}
      <View style={s.viewport}>
        {/* 배경 이미지 */}
        <Image source={{ uri: imgBg }} style={s.vpBg} />
        <View style={s.vpDim} />

        {/* 스켈레톤 */}
        {shadowOn && (
          <Image source={{ uri: imgSkeletonPro }} style={[s.skeleton, s.skeletonPro]} />
        )}
        <Image source={{ uri: imgSkeletonUser }} style={s.skeleton} />

        {/* 좌측 컨트롤 패널 */}
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
          <View style={s.hudRow}>
            <Text style={s.hudLabel}>섀도우 아바타</Text>
            <TouchableOpacity
              style={[s.toggle, shadowOn && s.toggleOn]}
              onPress={() => setShadowOn(v => !v)}>
              <View style={[s.toggleThumb, shadowOn && s.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          <View style={s.hudDivider} />
          <Text style={s.hudSub}>스윙 대칭</Text>
          <Text style={s.hudValue}>94%</Text>
        </View>

        {/* 하단 스크러버 */}
        <View style={s.scrubber}>
          {/* 타임라인 */}
          <View style={s.timeRow}>
            <Text style={s.timeText}>0:12</Text>
            <View style={s.trackOuter}>
              <View style={s.trackBg} />
              <View style={[s.trackFill, { width: `${scrubPct * 100}%` as any }]} />
              <View style={[s.trackThumb, { left: `${scrubPct * 100}%` as any }]} />
            </View>
            <Text style={s.timeText}>0:34</Text>
          </View>

          {/* 페이즈 점프 + 재생 */}
          <View style={s.controlRow}>
            <View style={s.phaseChips}>
              {PHASES.map((p, i) => (
                <TouchableOpacity
                  key={p}
                  style={[s.phaseChip, activePhase === i && s.phaseChipActive]}
                  onPress={() => setPhase(i)}>
                  <Text style={[s.phaseChipText, activePhase === i && s.phaseChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={s.playBtn}
              onPress={() => setPlaying(v => !v)}>
              <Text style={s.playIcon}>{playing ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
          </View>

          {/* 배속 */}
          <View style={s.speedRow}>
            {SPEEDS.map((sp, i) => (
              <TouchableOpacity
                key={sp}
                style={[s.speedBtn, activeSpeed === i && s.speedBtnActive]}
                onPress={() => setSpeed(i)}>
                <Text style={[s.speedText, activeSpeed === i && s.speedTextActive]}>{sp}</Text>
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

  // 뷰포트
  viewport: {
    flex: 1,
    width: '100%',
    backgroundColor: C.dark,
    overflow: 'hidden',
  },
  vpBg: {
    position: 'absolute', width: '200%', height: '100%',
    left: '-42%', opacity: 0.2, resizeMode: 'cover',
  },
  vpDim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(28,25,23,0.6)',
  },

  // 스켈레톤
  skeleton: {
    position: 'absolute',
    alignSelf: 'center',
    width: 122, height: 244,
    top: '50%', left: '50%',
    marginTop: -122, marginLeft: -61,
    resizeMode: 'contain',
  },
  skeletonPro: { opacity: 0.3 },

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
  hudSub: { fontSize: 11, fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: -0.5 },
  hudValue: { fontSize: 24, fontWeight: '700', color: C.textPrimary },

  // 스크러버
  scrubber: {
    position: 'absolute', bottom: 96, left: '4%', right: '4%',
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
