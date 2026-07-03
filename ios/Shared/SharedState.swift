import Foundation

/// App-Group-backed store the extension writes to and the main app reads from.
/// Cross-process "push" isn't available here, so the main app should re-read
/// this (e.g. on foreground / via a short poll while a broadcast is active) —
/// the local notification posted by the extension is the real-time signal.
enum SharedState {
    private static let historyKey = "cerberus.history"
    private static let monitoringKey = "cerberus.isMonitoring"
    private static let errorKey = "cerberus.lastError"
    private static let maxEntries = 200

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: AppGroup.identifier)
    }

    static func appendHistory(_ event: DetectionEvent) {
        guard let defaults = defaults else { return }
        var history = readHistory()
        history.insert(event, at: 0)
        if history.count > maxEntries {
            history.removeLast(history.count - maxEntries)
        }
        if let data = try? JSONEncoder().encode(history) {
            defaults.set(data, forKey: historyKey)
        }
    }

    static func readHistory() -> [DetectionEvent] {
        guard let defaults = defaults,
              let data = defaults.data(forKey: historyKey),
              let decoded = try? JSONDecoder().decode([DetectionEvent].self, from: data)
        else {
            return []
        }
        return decoded
    }

    static func clearHistory() {
        defaults?.removeObject(forKey: historyKey)
    }

    static func setMonitoring(_ value: Bool) {
        defaults?.set(value, forKey: monitoringKey)
    }

    static func isMonitoring() -> Bool {
        defaults?.bool(forKey: monitoringKey) ?? false
    }

    static func recordError(_ message: String) {
        defaults?.set(message, forKey: errorKey)
    }
}
