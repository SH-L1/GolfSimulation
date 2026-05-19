import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<Props> = ({ visible, message }) => {
  if (!visible) { return null; }
  return (
    <View style={s.overlay}>
      <View style={s.box}>
        <ActivityIndicator size="large" color="#006e1c" />
        {message ? <Text style={s.msg}>{message}</Text> : null}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    minWidth: 140,
  },
  msg: { fontSize: 14, color: '#3f4a3c', textAlign: 'center' },
});
