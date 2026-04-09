import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/ui/AppHeader';

import { PLACEHOLDER_URI } from '../../assets';

// TODO: 실제 에셋으로 교체 필요 (src/assets/index.ts 참고)
const imgSwingVideo = PLACEHOLDER_URI;

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
  navInactive: '#9ca3af',
  timelineBg:  '#eceeec',
  timelineBar: '#e1e3e1',
  chipInactive:'#e6e9e7',
};

const CLUBS = ['드라이버', '아이언'];
const ANGLES = ['측면 (DTL)', '정면', '후면'];
const TIMELINE_MARKS = ['0:00', '0:02', '0:04', '0:06', '0:08', '0:10'];

type Props = { navigation?: any };

export const SwingUploadScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedClub, setSelectedClub] = useState(0);
  const [selectedAngle, setSelectedAngle] = useState(0);
  const [angleOpen, setAngleOpen] = useState(false);

  const handlePickFile = () => {
    launchImageLibrary({ mediaType: 'video', selectionLimit: 1 }, res => {
      if (res.didCancel) return;
      if (res.errorCode) {
        Alert.alert('오류', res.errorMessage ?? '파일을 불러올 수 없습니다.');
        return;
      }
      if (res.assets?.[0]) {
        Alert.alert('파일 선택됨', res.assets[0].fileName ?? '영상이 선택되었습니다.');
      }
    });
  };

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
          <Text style={s.pageSubtitle}>정확한 피드백을 위해 임팩트 구간을 잘라주세요.</Text>
        </View>

        {/* 영상 플레이어 */}
        <View style={s.videoCard}>
          <Image source={{ uri: imgSwingVideo }} style={s.videoThumb} />

          {/* 상단 좌측 — 파일명 */}
          <View style={s.videoTagLeft}>
            <View style={s.recordDot} />
            <Text style={s.videoTagText}>RAW_FOOTAGE.MP4</Text>
          </View>

          {/* 상단 우측 — 해상도 */}
          <View style={s.videoTagRight}>
            <Text style={s.videoTagText}>1080p • 60fps</Text>
          </View>

          {/* 재생 버튼 */}
          <View style={s.playBtn}>
            <Text style={s.playIcon}>▶</Text>
          </View>
        </View>

        {/* 트림 타임라인 */}
        <View style={s.trimCard}>
          <View style={s.trimHeader}>
            <Text style={s.trimLabel}>Trim: 0:02.4 — 0:05.1</Text>
            <Text style={s.trimDuration}>2.7s</Text>
          </View>

          {/* 타임라인 바 */}
          <View style={s.timelineOuter}>
            {/* 배경 세그먼트 */}
            <View style={s.timelineSegments}>
              {[0,1,2,3,4].map(i => (
                <View key={i} style={s.timelineSegment} />
              ))}
            </View>
            {/* 선택 구간 */}
            <View style={s.trimSelection} />
            {/* 왼쪽 핸들 */}
            <View style={[s.trimHandle, { left: '20%' }]}>
              <View style={s.handlePill} />
            </View>
            {/* 오른쪽 핸들 */}
            <View style={[s.trimHandle, { left: '68%' }]}>
              <View style={s.handlePill} />
            </View>
            {/* 현재 위치 표시 */}
            <View style={s.playhead}>
              <View style={s.playheadDot} />
            </View>
          </View>

          {/* 시간 마커 */}
          <View style={s.timeMarkers}>
            {TIMELINE_MARKS.map(m => (
              <Text key={m} style={s.timeMarker}>{m}</Text>
            ))}
          </View>
        </View>

        {/* 스윙 상세 카드 */}
        <View style={s.detailCard}>
          <Text style={s.detailTitle}>스윙 상세</Text>

          {/* 클럽 종류 */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>클럽 종류</Text>
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
          </View>

          {/* 카메라 각도 */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>카메라 각도</Text>
            <TouchableOpacity
              style={s.dropdown}
              onPress={() => setAngleOpen(v => !v)}>
              <Text style={s.dropdownText}>{ANGLES[selectedAngle]}</Text>
              <Text style={s.dropdownArrow}>{angleOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {angleOpen && (
              <View style={s.dropdownMenu}>
                {ANGLES.map((a, i) => (
                  <TouchableOpacity
                    key={a}
                    style={s.dropdownItem}
                    onPress={() => { setSelectedAngle(i); setAngleOpen(false); }}>
                    <Text style={[s.dropdownItemText, selectedAngle === i && { color: C.green, fontWeight: '700' }]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 버튼 */}
          <View style={s.actionButtons}>
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('SwingFeedback')}>
              <Text style={s.btnPrimaryText}>🔍  분석 시작</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} activeOpacity={0.85} onPress={handlePickFile}>
              <Text style={s.btnSecondaryText}>파일 선택</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pro Tip */}
        <View style={s.tipCard}>
          <View style={s.tipHeader}>
            <Text style={s.tipIcon}>💡</Text>
            <Text style={s.tipTitle}>PRO TIP</Text>
          </View>
          <Text style={s.tipBody}>
            최상의 결과를 위해 스윙의 전체 궤적이 보이고 테이크어웨이 직전에 클립이 시작되도록 하세요.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation?.navigate('SwingChat')}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },

  // 헤더
  headerSection: { gap: 4 },
  pageTitle: { fontSize: 30, fontWeight: '700', color: C.textPrimary },
  pageSubtitle: { fontSize: 15, color: C.textSub, lineHeight: 24 },

  // 영상 플레이어
  videoCard: {
    backgroundColor: '#000',
    borderRadius: 28,
    overflow: 'hidden',
    height: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  videoThumb: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.9 },
  videoTagLeft: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ba1a1a' },
  videoTagRight: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  videoTagText: { fontSize: 10, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.5 },
  playBtn: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginTop: -24, marginLeft: -24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  playIcon: { fontSize: 18, color: C.textPrimary, marginLeft: 3 },

  // 트림 타임라인
  trimCard: {
    backgroundColor: C.surface, borderRadius: 24, padding: 18, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  trimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trimLabel: { fontSize: 13, fontWeight: '700', color: C.green },
  trimDuration: { fontSize: 12, color: C.textSub },
  timelineOuter: {
    height: 64, backgroundColor: C.timelineBg,
    borderRadius: 6, overflow: 'visible',
    position: 'relative',
  },
  timelineSegments: {
    position: 'absolute', top: 4, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 3, opacity: 0.4,
  },
  timelineSegment: { flex: 1, backgroundColor: C.timelineBar },
  trimSelection: {
    position: 'absolute', top: 4, bottom: 0,
    left: '20%', right: '30%',
    backgroundColor: 'rgba(0,110,28,0.10)',
    borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.green,
  },
  trimHandle: {
    position: 'absolute', top: 4, bottom: 0,
    width: 4, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  handlePill: {
    width: 20, height: 28, borderRadius: 6,
    backgroundColor: C.green,
    shadowColor: C.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  playhead: {
    position: 'absolute', top: 0, bottom: 0,
    left: '45%', width: 2, backgroundColor: '#ba1a1a',
  },
  playheadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ba1a1a',
    marginLeft: -3, marginTop: -4,
  },
  timeMarkers: { flexDirection: 'row', justifyContent: 'space-between' },
  timeMarker: { fontSize: 9, fontWeight: '700', color: C.textSub, opacity: 0.7, letterSpacing: 0.5 },

  // 스윙 상세 카드
  detailCard: {
    backgroundColor: C.surface, borderRadius: 28, padding: 22, gap: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.6, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.chipInactive, alignItems: 'center',
  },
  chipActive: { backgroundColor: C.green },
  chipText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  chipTextActive: { color: '#fff' },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f2f4f2', borderRadius: 28,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownText: { fontSize: 14, color: C.textPrimary },
  dropdownArrow: { fontSize: 11, color: C.textMuted },
  dropdownMenu: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: '#e6e9e7',
    overflow: 'hidden', marginTop: -4,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, color: C.textPrimary },

  // 버튼
  actionButtons: { gap: 10, marginTop: 4 },
  btnPrimary: {
    backgroundColor: C.green, borderRadius: 999,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnSecondary: {
    backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blueBorder,
    borderRadius: 999, paddingVertical: 14, alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: C.blueDeep },

  // Pro Tip
  tipCard: {
    backgroundColor: C.bluePill, borderRadius: 28, padding: 18, gap: 8,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipIcon: { fontSize: 13 },
  tipTitle: { fontSize: 10, fontWeight: '700', color: '#001d36', letterSpacing: 1, textTransform: 'uppercase' },
  tipBody: { fontSize: 12, color: '#00497d', lineHeight: 20 },

  // FAB
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
