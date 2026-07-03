import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {StepperRow, SwitchRow} from '../components/SettingRow';
import {useCerberus} from '../state/CerberusProvider';
import {colors} from '../theme';

const INTERVAL_STEP = 250;
const INTERVAL_MIN = 250;
const INTERVAL_MAX = 5000;

const CONFIDENCE_STEP = 0.05;
const CONFIDENCE_MIN = 0.2;
const CONFIDENCE_MAX = 0.9;

const COOLDOWN_STEP = 5000;
const COOLDOWN_MIN = 5000;
const COOLDOWN_MAX = 300000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SettingsScreen() {
  const {settings, updateSettings} = useCerberus();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Detection</Text>
      <View style={styles.card}>
        <SwitchRow
          label="Detect people"
          value={settings.notifyPerson}
          onValueChange={notifyPerson => updateSettings({notifyPerson})}
        />
        <SwitchRow
          label="Detect vehicles"
          description="Cars, motorcycles, buses, trucks, trains, bicycles"
          value={settings.notifyVehicle}
          onValueChange={notifyVehicle => updateSettings({notifyVehicle})}
        />
        <StepperRow
          label="Confidence threshold"
          description="Higher = fewer false positives"
          value={`${Math.round(settings.confidenceThreshold * 100)}%`}
          onDecrease={() =>
            updateSettings({
              confidenceThreshold: clamp(
                settings.confidenceThreshold - CONFIDENCE_STEP,
                CONFIDENCE_MIN,
                CONFIDENCE_MAX,
              ),
            })
          }
          onIncrease={() =>
            updateSettings({
              confidenceThreshold: clamp(
                settings.confidenceThreshold + CONFIDENCE_STEP,
                CONFIDENCE_MIN,
                CONFIDENCE_MAX,
              ),
            })
          }
        />
      </View>

      <Text style={styles.sectionTitle}>Performance</Text>
      <View style={styles.card}>
        <StepperRow
          label="Scan interval"
          description="How often a frame is analyzed. Lower = more battery use."
          value={`${(settings.intervalMs / 1000).toFixed(2)}s`}
          onDecrease={() =>
            updateSettings({
              intervalMs: clamp(
                settings.intervalMs - INTERVAL_STEP,
                INTERVAL_MIN,
                INTERVAL_MAX,
              ),
            })
          }
          onIncrease={() =>
            updateSettings({
              intervalMs: clamp(
                settings.intervalMs + INTERVAL_STEP,
                INTERVAL_MIN,
                INTERVAL_MAX,
              ),
            })
          }
        />
        <StepperRow
          label="Notification cooldown"
          description="Minimum time between repeat alerts for the same category"
          value={`${Math.round(settings.cooldownMs / 1000)}s`}
          onDecrease={() =>
            updateSettings({
              cooldownMs: clamp(
                settings.cooldownMs - COOLDOWN_STEP,
                COOLDOWN_MIN,
                COOLDOWN_MAX,
              ),
            })
          }
          onIncrease={() =>
            updateSettings({
              cooldownMs: clamp(
                settings.cooldownMs + COOLDOWN_STEP,
                COOLDOWN_MIN,
                COOLDOWN_MAX,
              ),
            })
          }
        />
      </View>

      <Text style={styles.footnote}>
        All analysis runs on-device — no frames or detections ever leave your
        phone. Changes apply the next time you start watching (Android also
        applies them live while already running).
      </Text>
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
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    paddingHorizontal: 4,
  },
});
