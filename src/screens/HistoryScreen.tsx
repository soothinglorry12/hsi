import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {DetectionListItem} from '../components/DetectionListItem';
import {useCerberus} from '../state/CerberusProvider';
import {colors} from '../theme';

export function HistoryScreen() {
  const {history, clearHistory} = useCerberus();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Detection history</Text>
        <Pressable onPress={clearHistory} disabled={history.length === 0}>
          <Text
            style={[
              styles.clear,
              history.length === 0 && styles.clearDisabled,
            ]}>
            Clear
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={history}
        keyExtractor={item => item.id}
        renderItem={({item}) => <DetectionListItem event={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing detected yet. History persists across app restarts.
          </Text>
        }
        contentContainerStyle={
          history.length === 0 ? styles.emptyContainer : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {color: colors.text, fontSize: 22, fontWeight: '700'},
  clear: {color: colors.accent, fontSize: 14, fontWeight: '600'},
  clearDisabled: {color: colors.textMuted},
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {flex: 1, justifyContent: 'center'},
});
