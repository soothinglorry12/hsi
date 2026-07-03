export type DetectionCategory = 'PERSON' | 'VEHICLE';

export interface DetectionEvent {
  id: string;
  timestamp: number;
  labels: string[];
  categories: DetectionCategory[];
  topScore: number;
}

export interface MonitorSettings {
  intervalMs: number;
  confidenceThreshold: number;
  cooldownMs: number;
  notifyPerson: boolean;
  notifyVehicle: boolean;
}

export const DEFAULT_SETTINGS: MonitorSettings = {
  intervalMs: 1000,
  confidenceThreshold: 0.5,
  cooldownMs: 30000,
  notifyPerson: true,
  notifyVehicle: true,
};

export interface ServiceError {
  code: string;
  message: string;
}
