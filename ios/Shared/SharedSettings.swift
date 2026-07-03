import Foundation

/// Mirrors the JS-configurable settings (see src/native/screenGuard.ts). The main
/// app writes these into the App Group defaults before/while a broadcast is live;
/// the extension reads them at broadcastStarted() and there's no live update path
/// mid-broadcast (the extension process only reads once — Apple gives no channel
/// for the main app to push into an already-running extension).
struct SharedSettings: Codable {
    var intervalSeconds: TimeInterval = 1.0
    var confidenceThreshold: Float = 0.5
    var cooldownSeconds: TimeInterval = 30.0
    var notifyPerson: Bool = true
    var notifyVehicle: Bool = true

    private static let key = "cerberus.settings"

    static func load() -> SharedSettings {
        guard let defaults = UserDefaults(suiteName: AppGroup.identifier),
              let data = defaults.data(forKey: key),
              let decoded = try? JSONDecoder().decode(SharedSettings.self, from: data)
        else {
            return SharedSettings()
        }
        return decoded
    }

    func save() {
        guard let defaults = UserDefaults(suiteName: AppGroup.identifier),
              let data = try? JSONEncoder().encode(self)
        else { return }
        defaults.set(data, forKey: Self.key)
    }
}
