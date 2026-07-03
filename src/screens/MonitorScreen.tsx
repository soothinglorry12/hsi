import React from 'react';
import {Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {StatusCard} from '../components/StatusCard';
import {DetectionListItem} from '../components/DetectionListItem';
import {useCerberus} from '../state/CerberusProvider';
import {colors} from '../theme';

export function MonitorScreen() {
  const {
    isMonitoring,
    isBusy,
    history,
    lastError,
    requestPermissionAndStart,
    stop,
    dismissError,
  } = useCerberus();
  const recent = history.slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusCard
        isMonitoring={isMonitoring}
        isBusy={isBusy}
        onStart={requestPermissionAndStart}
        onStop={stop}
      />

      {lastError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{lastError.message}</Text>
          <Text style={styles.errorDismiss} onPress={dismissError}>
            Dismiss
          </Text>
        </View>
      ) : null}

      {Platform.OS === 'ios' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>About iOS monitoring</Text>
          <Text style={styles.noticeText}>
            iOS requires you to confirm the system broadcast sheet each time,
            and only Apple can stop an in-progress broadcast (via the red
            status-bar indicator). Detections still trigger notifications while
            the app is backgrounded.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Recent activity</Text>
      <View style={styles.listCard}>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No detections yet.</Text>
        ) : (
          recent.map(event => (
            <DetectionListItem key={event.id} event={event} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: 16, paddingBottom: 32},
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  empty: {color: colors.textMuted, padding: 16, fontSize: 14},
  errorBanner: {
    marginTop: 16,
    backgroundColor: colors.accentMuted,
    borderRadius: 12,
    padding: 14,
  },
  errorText: {color: colors.text, fontSize: 13, marginBottom: 8},
  errorDismiss: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  notice: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {color: colors.textMuted, fontSize: 12, lineHeight: 18},
});
