import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {screenGuard} from '../native/screenGuard';
import {
  DEFAULT_SETTINGS,
  DetectionEvent,
  MonitorSettings,
  ServiceError,
} from '../types';

const SETTINGS_KEY = '@cerberus/settings';

interface CerberusContextValue {
  settings: MonitorSettings;
  isMonitoring: boolean;
  history: DetectionEvent[];
  lastError: ServiceError | null;
  isBusy: boolean;
  requestPermissionAndStart: () => Promise<void>;
  stop: () => Promise<void>;
  updateSettings: (patch: Partial<MonitorSettings>) => Promise<void>;
  clearHistory: () => Promise<void>;
  dismissError: () => void;
}

const CerberusContext = createContext<CerberusContextValue | null>(null);

export function CerberusProvider({children}: {children: React.ReactNode}) {
  const [settings, setSettings] = useState<MonitorSettings>(DEFAULT_SETTINGS);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [history, setHistory] = useState<DetectionEvent[]>([]);
  const [lastError, setLastError] = useState<ServiceError | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          setSettings({...DEFAULT_SETTINGS, ...JSON.parse(raw)});
        }
      } catch {
        // Fall back to defaults if storage is corrupt/unavailable.
      }
      try {
        setIsMonitoring(await screenGuard.isMonitoring());
      } catch {
        // Native module not linked yet (e.g. mid-setup); leave default false.
      }
      try {
        setHistory(await screenGuard.getDetectionHistory());
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    const offDetection = screenGuard.onDetection(event => {
      setHistory(prev => [event, ...prev].slice(0, 200));
      setIsMonitoring(true);
    });
    const offStopped = screenGuard.onCaptureStopped(() =>
      setIsMonitoring(false),
    );
    const offError = screenGuard.onServiceError(error => {
      setLastError(error);
      setIsMonitoring(false);
    });
    return () => {
      offDetection();
      offStopped();
      offError();
    };
  }, []);

  const persistSettings = useCallback(async (next: MonitorSettings) => {
    setSettings(next);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: settings just won't survive an app restart this time.
    }
  }, []);

  const requestPermissionAndStart = useCallback(async () => {
    setIsBusy(true);
    setLastError(null);
    try {
      const granted = await screenGuard.requestCapturePermission();
      if (!granted) {
        setLastError({
          code: 'permission_denied',
          message: 'Screen capture permission was not granted.',
        });
        return;
      }
      await screenGuard.startMonitoring(settings);
      setIsMonitoring(true);
    } catch (e) {
      setLastError({
        code: 'start_failed',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsBusy(false);
    }
  }, [settings]);

  const stop = useCallback(async () => {
    setIsBusy(true);
    try {
      await screenGuard.stopMonitoring();
      setIsMonitoring(false);
    } catch (e) {
      setLastError({
        code: 'stop_failed',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsBusy(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<MonitorSettings>) => {
      const next = {...settings, ...patch};
      await persistSettings(next);
      if (isMonitoring) {
        try {
          await screenGuard.updateSettings(next);
        } catch {
          // Best-effort; the service keeps running with its previous settings.
        }
      }
    },
    [settings, isMonitoring, persistSettings],
  );

  const clearHistory = useCallback(async () => {
    await screenGuard.clearDetectionHistory();
    setHistory([]);
  }, []);

  const dismissError = useCallback(() => setLastError(null), []);

  const value = useMemo<CerberusContextValue>(
    () => ({
      settings,
      isMonitoring,
      history,
      lastError,
      isBusy,
      requestPermissionAndStart,
      stop,
      updateSettings,
      clearHistory,
      dismissError,
    }),
    [
      settings,
      isMonitoring,
      history,
      lastError,
      isBusy,
      requestPermissionAndStart,
      stop,
      updateSettings,
      clearHistory,
      dismissError,
    ],
  );

  return (
    <CerberusContext.Provider value={value}>
      {children}
    </CerberusContext.Provider>
  );
}

export function useCerberus(): CerberusContextValue {
  const ctx = useContext(CerberusContext);
  if (!ctx) {
    throw new Error('useCerberus must be used within a CerberusProvider');
  }
  return ctx;
}
