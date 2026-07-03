import {NativeEventEmitter, NativeModules} from 'react-native';
import type {DetectionEvent, MonitorSettings, ServiceError} from '../types';

interface ScreenGuardNativeModule {
  requestCapturePermission(): Promise<boolean>;
  startMonitoring(options: MonitorSettings): Promise<boolean>;
  updateSettings(options: MonitorSettings): Promise<boolean>;
  stopMonitoring(): Promise<boolean>;
  isMonitoring(): Promise<boolean>;
  getDetectionHistory(): Promise<DetectionEvent[]>;
  clearDetectionHistory(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const LINKING_ERROR =
  'The native module "ScreenGuard" is not linked. Make sure you\'ve rebuilt the ' +
  'native app (this module is not available in Expo Go / JS-only environments).';

const ScreenGuardNative: ScreenGuardNativeModule = NativeModules.ScreenGuard
  ? NativeModules.ScreenGuard
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    );

// Only constructed when the native module is actually linked — RN 0.74 throws if
// you pass a null/undefined argument, and there's nothing to emit from in JS-only
// environments (unit tests, a stale Metro bundle before a native rebuild) anyway.
const emitter = NativeModules.ScreenGuard
  ? new NativeEventEmitter(NativeModules.ScreenGuard)
  : null;

function subscribe<T>(
  eventName: string,
  callback: (payload: T) => void,
): () => void {
  if (!emitter) {
    return () => {};
  }
  const sub = emitter.addListener(eventName, callback);
  return () => sub.remove();
}

export const screenGuard = {
  /**
   * Android: shows the MediaProjection consent dialog and resolves once the user
   * answers. iOS: requests local-notification authorization (there is no
   * equivalent up-front consent for screen capture — that consent happens when
   * the user taps the broadcast picker in startMonitoring()).
   */
  requestCapturePermission(): Promise<boolean> {
    return ScreenGuardNative.requestCapturePermission();
  },

  /**
   * Android: starts the foreground capture+detection service immediately.
   * iOS: surfaces the system broadcast picker; monitoring only truly begins once
   * the user taps "Start Broadcast" in that sheet.
   */
  startMonitoring(settings: MonitorSettings): Promise<boolean> {
    return ScreenGuardNative.startMonitoring(settings);
  },

  updateSettings(settings: MonitorSettings): Promise<boolean> {
    return ScreenGuardNative.updateSettings(settings);
  },

  /**
   * Android: stops the capture service. iOS: this can't stop an in-progress
   * broadcast (Apple only lets the user do that); it resolves with whatever the
   * current state actually is.
   */
  stopMonitoring(): Promise<boolean> {
    return ScreenGuardNative.stopMonitoring();
  },

  isMonitoring(): Promise<boolean> {
    return ScreenGuardNative.isMonitoring();
  },

  getDetectionHistory(): Promise<DetectionEvent[]> {
    return ScreenGuardNative.getDetectionHistory();
  },

  clearDetectionHistory(): Promise<boolean> {
    return ScreenGuardNative.clearDetectionHistory();
  },

  onDetection(callback: (event: DetectionEvent) => void) {
    return subscribe('CerberusDetection', callback);
  },

  onCaptureStopped(callback: () => void) {
    return subscribe('CerberusCaptureStopped', callback);
  },

  onServiceError(callback: (error: ServiceError) => void) {
    return subscribe('CerberusServiceError', callback);
  },
};
