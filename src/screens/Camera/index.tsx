import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
  type CameraRef,
  type Recorder,
} from 'react-native-vision-camera';

const { width: SW, height: SH } = Dimensions.get('window');

const GUIDE_W = SW * 0.85;
const GUIDE_H = GUIDE_W * 1.6;
const GUIDE_X = (SW - GUIDE_W) / 2;
const GUIDE_Y = (SH - GUIDE_H) / 2 - 30;
const CORNER  = 24;
const CORNER_T = 3;

const TIMER_OPTIONS = [
  { label: '즉시', value: 0 },
  { label: '3초',  value: 3 },
  { label: '5초',  value: 5 },
  { label: '10초', value: 10 },
];

const MAX_DURATION_SEC = 30;

type Props = { navigation?: any; route?: any };

export const CameraScreen: React.FC<Props> = ({ navigation }) => {
  const { hasPermission: hasCam, requestPermission: reqCam } = useCameraPermission();
  const { hasPermission: hasMic, requestPermission: reqMic } = useMicrophonePermission();
  const device     = useCameraDevice('back');
  const cameraRef  = useRef<CameraRef>(null);
  const recorderRef = useRef<Recorder | null>(null);

  // v5: useVideoOutput으로 비디오 출력 설정
  const videoOutput = useVideoOutput({ enableAudio: true });

  const [timerSec, setTimerSec]     = useState(0);
  const [countdown, setCountdown]   = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [showGuide, setShowGuide]   = useState(false);

  const elapsedRef        = useRef(0);
  const elapsedTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasCam) { void reqCam(); }
    if (!hasMic) { void reqMic(); }
  }, [hasCam, hasMic, reqCam, reqMic]);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopElapsedTimer();
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); }
  }, [stopElapsedTimer]);

  const startElapsedTimer = useCallback(() => {
    elapsedRef.current = 0;
    setElapsed(0);
    elapsedTimerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // v5: videoOutput에서 Recorder 생성 (maxDuration으로 자동 종료)
      const recorder = await videoOutput.createRecorder({ maxDuration: MAX_DURATION_SEC });
      recorderRef.current = recorder;
      setIsRecording(true);
      startElapsedTimer();

      await recorder.startRecording(
        (filePath) => {
          const duration = elapsedRef.current;
          stopElapsedTimer();
          setIsRecording(false);
          setElapsed(0);
          recorderRef.current = null;
          navigation?.navigate('Main', { screen: 'SwingUpload', params: { recordedVideoUri: filePath, recordedDuration: duration } });
        },
        (error) => {
          stopElapsedTimer();
          setIsRecording(false);
          setElapsed(0);
          recorderRef.current = null;
          Alert.alert('녹화 오류', error.message ?? '알 수 없는 오류가 발생했습니다.');
        },
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert('녹화 시작 실패', err.message ?? '카메라를 준비할 수 없습니다.');
      setIsRecording(false);
    }
  }, [videoOutput, navigation, startElapsedTimer, stopElapsedTimer]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) { return; }
    try {
      await recorderRef.current.stopRecording();
    } catch {
      // 이미 종료된 경우 무시
    }
  }, []);

  const handleRecordPress = useCallback(() => {
    if (isRecording) {
      void stopRecording();
      return;
    }
    if (timerSec === 0) {
      void startRecording();
      return;
    }
    // 카운트다운 후 녹화 시작
    setCountdown(timerSec);
    let remaining = timerSec;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        setCountdown(null);
        void startRecording();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [isRecording, timerSec, startRecording, stopRecording]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!hasCam || !hasMic) {
    return (
      <View style={s.permissionScreen}>
        <Text style={s.permissionText}>카메라 및 마이크 권한이 필요합니다.</Text>
        <TouchableOpacity style={s.permissionBtn} onPress={() => { void reqCam(); void reqMic(); }}>
          <Text style={s.permissionBtnText}>권한 허용</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={s.permissionScreen}>
        <Text style={s.permissionText}>카메라를 사용할 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar hidden />

      {/* v5: Camera에 outputs 배열로 videoOutput 전달 */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[videoOutput]}
      />

      <DimOverlay />
      <GuideBox />

      <View style={s.guideLabel}>
        <Text style={s.guideLabelText}>정면 촬영</Text>
      </View>

      <View style={s.guideHint}>
        <Text style={s.guideHintText}>전신이 프레임 안에 들어오도록 서 주세요</Text>
      </View>

      {/* 상단 바 */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation?.goBack()}>
          <Text style={s.iconBtnText}>✕</Text>
        </TouchableOpacity>

        {isRecording && (
          <View style={s.recBadge}>
            <View style={s.recDot} />
            <Text style={s.recTime}>{formatElapsed(elapsed)}</Text>
          </View>
        )}

        <TouchableOpacity style={s.iconBtn} onPress={() => setShowGuide(true)}>
          <Text style={s.iconBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* 하단 컨트롤 */}
      <View style={s.bottomBar}>
        {!isRecording && countdown === null && (
          <View style={s.timerRow}>
            {TIMER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.timerChip, timerSec === opt.value && s.timerChipActive]}
                onPress={() => setTimerSec(opt.value)}>
                <Text style={[s.timerChipText, timerSec === opt.value && s.timerChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {countdown !== null && (
          <Text style={s.countdownText}>{countdown}</Text>
        )}

        <TouchableOpacity
          style={[s.recordBtn, isRecording && s.recordBtnActive]}
          onPress={handleRecordPress}
          disabled={countdown !== null}>
          {isRecording
            ? <View style={s.stopSquare} />
            : <View style={s.recordInner} />
          }
        </TouchableOpacity>

        {isRecording && (
          <Text style={s.maxDurText}>최대 {MAX_DURATION_SEC}초</Text>
        )}
      </View>

      <GuideModal visible={showGuide} onClose={() => setShowGuide(false)} />
    </View>
  );
};

// ── 딤 오버레이 ───────────────────────────────────────────────────────────
const DimOverlay: React.FC = () => (
  <>
    <View style={[s.dim, { top: 0, left: 0, right: 0, height: GUIDE_Y }]} />
    <View style={[s.dim, { top: GUIDE_Y + GUIDE_H, left: 0, right: 0, bottom: 0 }]} />
    <View style={[s.dim, { top: GUIDE_Y, left: 0, width: GUIDE_X, height: GUIDE_H }]} />
    <View style={[s.dim, { top: GUIDE_Y, right: 0, width: GUIDE_X, height: GUIDE_H }]} />
  </>
);

// ── 가이드박스 코너 마커 ──────────────────────────────────────────────────
const GuideBox: React.FC = () => {
  const corners: Array<{ top?: number; bottom?: number; left?: number; right?: number }> = [
    { top: GUIDE_Y,                   left: GUIDE_X },
    { top: GUIDE_Y,                   right: SW - GUIDE_X - GUIDE_W },
    { bottom: SH - GUIDE_Y - GUIDE_H, left: GUIDE_X },
    { bottom: SH - GUIDE_Y - GUIDE_H, right: SW - GUIDE_X - GUIDE_W },
  ];
  return (
    <>
      {corners.map((pos, idx) => {
        const isRight  = pos.right  !== undefined;
        const isBottom = pos.bottom !== undefined;
        return (
          <View key={idx} style={[s.corner, pos]}>
            <View style={[s.cornerH, isRight ? { right: 0 } : { left: 0 }]} />
            <View style={[s.cornerV, isBottom ? { bottom: 0 } : { top: 0 }, isRight ? { right: 0 } : { left: 0 }]} />
          </View>
        );
      })}
    </>
  );
};

// ── 촬영 가이드 Modal ────────────────────────────────────────────────────
const GUIDE_STEPS = [
  { icon: '📐', title: '카메라 위치',  desc: '카메라를 허리 높이(약 1m)에 삼각대로 고정하세요. 정면에서 찍어주세요.' },
  { icon: '🧍', title: '서는 위치',    desc: '공을 기준으로 약 2~3m 거리에 서 주세요. 전신이 가이드 박스 안에 들어와야 합니다.' },
  { icon: '🌞', title: '조명 & 배경', desc: '역광이 없는 환경에서 촬영하세요. 단색 배경일수록 분석 정확도가 높아집니다.' },
  { icon: '⏱️', title: '촬영 길이',   desc: '준비 자세부터 스윙 마무리까지 전 과정을 촬영해 주세요. 최대 30초입니다.' },
];

const GuideModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={s.modalBg}>
      <View style={s.modalCard}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>촬영 가이드</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        {GUIDE_STEPS.map((step, i) => (
          <View key={i} style={s.guideStep}>
            <Text style={s.guideStepIcon}>{step.icon}</Text>
            <View style={s.guideStepText}>
              <Text style={s.guideStepTitle}>{step.title}</Text>
              <Text style={s.guideStepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.modalBtn} onPress={onClose}>
          <Text style={s.modalBtnText}>확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },

  corner:  { position: 'absolute', width: CORNER, height: CORNER },
  cornerH: { position: 'absolute', height: CORNER_T, width: CORNER, backgroundColor: '#fff', top: 0 },
  cornerV: { position: 'absolute', width: CORNER_T, height: CORNER, backgroundColor: '#fff' },

  guideLabel: { position: 'absolute', top: GUIDE_Y - 28, left: 0, right: 0, alignItems: 'center' },
  guideLabelText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 2, opacity: 0.8 },

  guideHint: { position: 'absolute', top: GUIDE_Y + GUIDE_H + 10, left: 0, right: 0, alignItems: 'center' },
  guideHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  topBar: {
    position: 'absolute', top: 44, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b30' },
  recTime: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, paddingTop: 16,
    alignItems: 'center', gap: 16,
  },

  timerRow: { flexDirection: 'row', gap: 10 },
  timerChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  timerChipActive:     { backgroundColor: '#fff' },
  timerChipText:       { color: '#fff', fontSize: 13, fontWeight: '600' },
  timerChipTextActive: { color: '#000' },

  countdownText: {
    fontSize: 80, fontWeight: '800', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  recordBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  recordBtnActive: { borderColor: '#ff3b30' },
  recordInner:     { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ff3b30' },
  stopSquare:      { width: 28, height: 28, borderRadius: 6,  backgroundColor: '#ff3b30' },

  maxDurText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  permissionScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', gap: 16 },
  permissionText:   { color: '#fff', fontSize: 16, textAlign: 'center' },
  permissionBtn:    { backgroundColor: '#006e1c', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  permissionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalClose:  { color: 'rgba(255,255,255,0.6)', fontSize: 20 },
  guideStep:   { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  guideStepIcon:  { fontSize: 22, marginTop: 2 },
  guideStepText:  { flex: 1, gap: 4 },
  guideStepTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  guideStepDesc:  { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20 },
  modalBtn:       { backgroundColor: '#006e1c', borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
});
