import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme';
import type {DetectionEvent} from '../types';

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DetectionListItem({event}: {event: DetectionEvent}) {
  const hasPerson = event.categories.includes('PERSON');
  const hasVehicle = event.categories.includes('VEHICLE');
  const title =
    hasPerson && hasVehicle
      ? 'Person & vehicle'
      : hasPerson
      ? 'Person'
      : 'Vehicle';

  return (
    <View style={styles.item}>
      <View
        style={[
          styles.badge,
          {backgroundColor: hasPerson ? colors.accent : colors.warning},
        ]}
      />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title} detected</Text>
        <Text style={styles.labels}>{event.labels.join(', ')}</Text>
        <Text style={styles.meta}>
          {formatTime(event.timestamp)} · {Math.round(event.topScore * 100)}%
          confidence
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  badge: {width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 12},
  textWrap: {flex: 1},
  title: {color: colors.text, fontSize: 15, fontWeight: '600'},
  labels: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  meta: {color: colors.textMuted, fontSize: 12, marginTop: 4},
});
