import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { isValidFile } from 'react-native-video-trim';

const HANDLE_W = 22;
const MIN_SEP  = 40;

const C = {
  green:      '#006e1c',
  textMuted:  '#78716c',
  blueBorder: 'rgba(51,160,253,0.2)',
  blueDeep:   '#00355c',
};

function fmtSec(sec: number): string {
  const m  = Math.floor(sec / 60);
  const s  = sec % 60;
  const ss = s < 10 ? `0${s.toFixed(1)}` : s.toFixed(1);
  return `${m}:${ss}`;
}

type Props = {
  videoUri:  string;
  onConfirm: (uri: string, startMs: number, endMs: number) => void;
  onCancel:  () => void;
};

export const VideoTrimEditor: React.FC<Props> = ({ videoUri, onConfirm, onCancel }) => {
  const [duration,   setDuration]   = useState(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [leftX,  setLeftX]  = useState(0);
  const [rightX, setRightX] = useState(0);
  const [loading, setLoading] = useState(true);

  const leftXRef     = useRef(0);
  const rightXRef    = useRef(0);
  const stripWRef    = useRef(0);
  const dragStartRef = useRef(0);

  const startSec = stripWidth > 0 ? (leftX  / stripWidth) * duration : 0;
  const endSec   = stripWidth > 0 ? (rightX / stripWidth) * duration : duration;

  // isValidFile로 영상 길이 로드 (react-native-video / getFrameAt 없이)
  useEffect(() => {
    setLoading(true);
    isValidFile(videoUri)
      .then(res => {
        const sec = res.duration > 0 ? res.duration / 1000 : 0;
        setDuration(sec);
      })
      .catch(() => {
        Alert.alert('오류', '영상 정보를 읽을 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [videoUri]);

  const onStripLayout = useCallback((e: any) => {
    const w = e.nativeEvent.layout.width;
    if (w === stripWRef.current) { return; }
    setStripWidth(w);
    stripWRef.current = w;
    rightXRef.current = w;
    setRightX(w);
  }, []);

  const leftPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragStartRef.current = leftXRef.current; },
    onPanResponderMove: (_, gs) => {
      const nx = Math.max(0, Math.min(rightXRef.current - MIN_SEP, dragStartRef.current + gs.dx));
      leftXRef.current = nx;
      setLeftX(nx);
    },
  })).current;

  const rightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragStartRef.current = rightXRef.current; },
    onPanResponderMove: (_, gs) => {
      const nx = Math.max(leftXRef.current + MIN_SEP, Math.min(stripWRef.current, dragStartRef.current + gs.dx));
      rightXRef.current = nx;
      setRightX(nx);
    },
  })).current;

  const handleConfirm = () => {
    const startMs = Math.round(startSec * 1000);
    const endMs   = Math.round(endSec   * 1000);
    if (endMs - startMs < 500) {
      Alert.alert('구간 오류', '최소 0.5초 이상 선택해주세요.');
      return;
    }
    onConfirm(videoUri, startMs, endMs);
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={C.green} size="large" />
        <Text style={s.loadingText}>영상 정보 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* 영상 길이 */}
      <View style={s.infoCard}>
        <Text style={s.infoLabel}>영상 전체 길이</Text>
        <Text style={s.infoDuration}>{fmtSec(duration)}</Text>
      </View>

      {/* 필름스트립 + 핸들 */}
      <View style={s.trimSection}>
        <Text style={s.trimLabel}>구간 선택  —  핸들을 드래그해 조절하세요</Text>

        <View style={s.stripWrap} onLayout={onStripLayout}>
          {/* 배경 */}
          <View style={s.filmstrip}>
            <Text style={s.filmIcon}>🎬</Text>
          </View>

          {/* 범위 밖 어둡게 */}
          {stripWidth > 0 && <View style={[s.dimLeft,  { width: leftX  + HANDLE_W / 2 }]} />}
          {stripWidth > 0 && <View style={[s.dimRight, { width: stripWidth - rightX + HANDLE_W / 2 }]} />}

          {/* 선택 구간 테두리 */}
          {stripWidth > 0 && (
            <View style={[s.selBorder, {
              left:  leftX  + HANDLE_W / 2,
              right: stripWidth - rightX + HANDLE_W / 2,
            }]} />
          )}

          {/* 왼쪽 핸들 */}
          {stripWidth > 0 && (
            <View style={[s.handle, s.handleLeft, { left: leftX }]} {...leftPan.panHandlers}>
              <View style={s.handleGrip} />
            </View>
          )}
          {/* 오른쪽 핸들 */}
          {stripWidth > 0 && (
            <View style={[s.handle, s.handleRight, { left: rightX - HANDLE_W }]} {...rightPan.panHandlers}>
              <View style={s.handleGrip} />
            </View>
          )}
        </View>

        {/* 시간 레이블 */}
        <View style={s.timeRow}>
          <Text style={s.timeTag}>{fmtSec(startSec)}</Text>
          <View style={s.durationPill}>
            <Text style={s.durationPillText}>{fmtSec(endSec - startSec)} 선택</Text>
          </View>
          <Text style={s.timeTag}>{fmtSec(endSec)}</Text>
        </View>
      </View>

      {/* 버튼 */}
      <View style={s.btnRow}>
        <TouchableOpacity style={s.btnCancel} onPress={onCancel}>
          <Text style={s.btnCancelText}>취소</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btnConfirm, !duration && { opacity: 0.6 }]}
          onPress={handleConfirm}
          disabled={!duration}>
          <Text style={s.btnConfirmText}>✂  구간 선택 완료</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, gap: 20 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: C.textMuted },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  infoLabel:    { fontSize: 13, color: C.textMuted, fontWeight: '600' },
  infoDuration: { fontSize: 20, fontWeight: '700', color: C.green },

  trimSection: { gap: 10 },
  trimLabel:   { fontSize: 13, fontWeight: '600', color: C.textMuted },

  stripWrap: { height: 72, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  filmstrip: {
    flex: 1, backgroundColor: '#e8f0e8',
    justifyContent: 'center', alignItems: 'center',
  },
  filmIcon: { fontSize: 28, opacity: 0.4 },

  dimLeft:  { position: 'absolute', top: 0, bottom: 0, left: 0,  backgroundColor: 'rgba(0,0,0,0.55)' },
  dimRight: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  selBorder: {
    position: 'absolute', top: 0, bottom: 0,
    borderTopWidth: 3, borderBottomWidth: 3, borderColor: C.green,
  },

  handle: {
    position: 'absolute', top: 0, bottom: 0, width: HANDLE_W,
    backgroundColor: C.green, justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  handleLeft:  { borderTopLeftRadius: 6,  borderBottomLeftRadius: 6 },
  handleRight: { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  handleGrip: { width: 3, height: 24, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2 },

  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeTag: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  durationPill: {
    backgroundColor: 'rgba(0,110,28,0.1)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  durationPillText: { fontSize: 12, fontWeight: '700', color: C.green },

  btnRow:    { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    borderWidth: 1, borderColor: C.blueBorder, alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, fontWeight: '700', color: C.blueDeep },
  btnConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: 999,
    backgroundColor: C.green, alignItems: 'center',
  },
  btnConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
