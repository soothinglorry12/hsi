import React from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {colors} from '../theme';

interface StepperProps {
  label: string;
  description?: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

export function StepperRow({
  label,
  description,
  value,
  onDecrease,
  onIncrease,
}: StepperProps) {
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepButton} onPress={onDecrease} hitSlop={8}>
          <Text style={styles.stepButtonText}>–</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable style={styles.stepButton} onPress={onIncrease} hitSlop={8}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface SwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: SwitchProps) {
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{false: colors.surfaceAlt, true: colors.accentMuted}}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelWrap: {flex: 1, paddingRight: 12},
  label: {color: colors.text, fontSize: 15, fontWeight: '600'},
  description: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  stepper: {flexDirection: 'row', alignItems: 'center'},
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {color: colors.text, fontSize: 18, lineHeight: 20},
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'center',
  },
});
