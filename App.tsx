import React, {useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {CerberusProvider} from './src/state/CerberusProvider';
import {MonitorScreen} from './src/screens/MonitorScreen';
import {HistoryScreen} from './src/screens/HistoryScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {colors} from './src/theme';

type Tab = 'monitor' | 'history' | 'settings';

const TABS: {key: Tab; label: string}[] = [
  {key: 'monitor', label: 'Monitor'},
  {key: 'history', label: 'History'},
  {key: 'settings', label: 'Settings'},
];

function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('monitor');

  return (
    <CerberusProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={colors.background}
        />
        <View style={styles.header}>
          <Text style={styles.brand}>PROJECT CERBERUS</Text>
        </View>
        <View style={styles.body}>
          {tab === 'monitor' && <MonitorScreen />}
          {tab === 'history' && <HistoryScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </View>
        <View style={styles.tabBar}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              style={styles.tabButton}
              onPress={() => setTab(t.key)}>
              <Text
                style={[
                  styles.tabLabel,
                  tab === t.key && styles.tabLabelActive,
                ]}>
                {t.label}
              </Text>
              {tab === t.key ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </CerberusProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.background},
  header: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4},
  brand: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  body: {flex: 1},
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButton: {flex: 1, alignItems: 'center', paddingVertical: 12},
  tabLabel: {color: colors.textMuted, fontSize: 13, fontWeight: '600'},
  tabLabelActive: {color: colors.text},
  tabIndicator: {
    marginTop: 6,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});

export default App;
