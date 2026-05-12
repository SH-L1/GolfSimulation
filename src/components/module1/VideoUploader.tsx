import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

interface Props {
  videoUri:   string | null;
  onSelect:   (uri: string) => void;
}

export const VideoUploader: React.FC<Props> = ({ videoUri, onSelect }) => {
  const handlePick = () => {
    launchImageLibrary({ mediaType: 'video', selectionLimit: 1 }, res => {
      if (res.didCancel) { return; }
      if (res.errorCode) { Alert.alert('오류', res.errorMessage ?? '파일을 불러올 수 없습니다.'); return; }
      const uri = res.assets?.[0]?.uri;
      if (uri) { onSelect(uri); }
    });
  };

  return (
    <TouchableOpacity style={[s.btn, videoUri && s.btnSelected]} onPress={handlePick} activeOpacity={0.8}>
      <Text style={s.icon}>{videoUri ? '🎬' : '📁'}</Text>
      <Text style={s.label}>{videoUri ? '영상 변경' : '영상 선택'}</Text>
      {videoUri ? <Text style={s.uri} numberOfLines={1}>{videoUri.split('/').pop()}</Text> : null}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  btn: {
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(51,160,253,0.3)',
    backgroundColor: 'rgba(51,160,253,0.05)',
    paddingVertical: 18, paddingHorizontal: 20,
    alignItems: 'center', gap: 6,
  },
  btnSelected: { borderColor: '#006e1c', backgroundColor: 'rgba(0,110,28,0.05)' },
  icon:  { fontSize: 28 },
  label: { fontSize: 14, fontWeight: '700', color: '#00355c' },
  uri:   { fontSize: 11, color: '#78716c', maxWidth: '90%' },
});
