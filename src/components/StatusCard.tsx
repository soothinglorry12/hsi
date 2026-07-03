import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors} from '../theme';

interface Props {
  isMonitoring: boolean;
  isBusy: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function StatusCard({isMonitoring, isBusy, onStart, onStop}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            {backgroundColor: isMonitoring ? colors.success : colors.textMuted},
          ]}
        />
        <Text style={styles.status}>{isMonitoring ? 'Watching' : 'Idle'}</Text>
      </View>
      <Text style={styles.subtitle}>
        {isMonitoring
          ? 'Analyzing on-screen frames for people and vehicles.'
          : Platform.OS === 'ios'
          ? 'Tap Start, then confirm in the system broadcast sheet that appears.'
          : 'Tap Start and grant screen-capture permission to begin.'}
      </Text>
      <Pressable
        style={[
          styles.button,
          {backgroundColor: isMonitoring ? colors.surfaceAlt : colors.accent},
        ]}
        disabled={isBusy}
        onPress={isMonitoring ? onStop : onStart}>
        {isBusy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.buttonText}>
            {isMonitoring ? 'Stop Watching' : 'Start Watching'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  dot: {width: 10, height: 10, borderRadius: 5, marginRight: 8},
  status: {color: colors.text, fontSize: 20, fontWeight: '700'},
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {color: colors.text, fontSize: 16, fontWeight: '700'},
});
