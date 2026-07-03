import Foundation
import ReplayKit
import UserNotifications

/// Main-app side of the iOS integration. Unlike Android, iOS gives an app no way
/// to programmatically start a background screen capture — the user must tap the
/// system broadcast picker themselves. We show that picker (via a hidden
/// RPSystemBroadcastPickerView triggered by the button the user just pressed in
/// JS) and otherwise just read the state the extension leaves in the App Group.
@objc(ScreenGuard)
class ScreenGuardModule: RCTEventEmitter {

    private var pollTimer: Timer?
    private var lastSeenEventId: String?

    override static func requiresMainQueueSetup() -> Bool { true }

    override func supportedEvents() -> [String]! {
        ["CerberusDetection", "CerberusCaptureStopped", "CerberusServiceError"]
    }

    override func startObserving() {
        startPolling()
    }

    override func stopObserving() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    // There's no in-app permission step on iOS beyond the broadcast picker
    // itself and (separately) notification permission, so this just requests
    // local notification authorization and resolves true/false.
    @objc(requestCapturePermission:withRejecter:)
    func requestCapturePermission(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
            resolve(granted)
        }
    }

    @objc(startMonitoring:resolver:rejecter:)
    func startMonitoring(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        var settings = SharedSettings()
        if let ms = options["intervalMs"] as? Double { settings.intervalSeconds = ms / 1000.0 }
        if let c = options["confidenceThreshold"] as? Double { settings.confidenceThreshold = Float(c) }
        if let cd = options["cooldownMs"] as? Double { settings.cooldownSeconds = cd / 1000.0 }
        if let p = options["notifyPerson"] as? Bool { settings.notifyPerson = p }
        if let v = options["notifyVehicle"] as? Bool { settings.notifyVehicle = v }
        settings.save()

        DispatchQueue.main.async {
            self.presentBroadcastPicker()
        }
        startPolling()
        resolve(true)
    }

    @objc(updateSettings:resolver:rejecter:)
    func updateSettings(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // Best-effort only: a broadcast already in progress won't see this until
        // the user stops and restarts it (see SharedSettings doc comment).
        var settings = SharedSettings.load()
        if let ms = options["intervalMs"] as? Double { settings.intervalSeconds = ms / 1000.0 }
        if let c = options["confidenceThreshold"] as? Double { settings.confidenceThreshold = Float(c) }
        if let cd = options["cooldownMs"] as? Double { settings.cooldownSeconds = cd / 1000.0 }
        if let p = options["notifyPerson"] as? Bool { settings.notifyPerson = p }
        if let v = options["notifyVehicle"] as? Bool { settings.notifyVehicle = v }
        settings.save()
        resolve(true)
    }

    @objc(stopMonitoring:rejecter:)
    func stopMonitoring(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // iOS has no API to stop a running broadcast from the host app — only the
        // user can, via the red status-bar indicator or the picker itself.
        resolve(!SharedState.isMonitoring())
    }

    @objc(isMonitoring:rejecter:)
    func isMonitoring(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(SharedState.isMonitoring())
    }

    @objc(getDetectionHistory:rejecter:)
    func getDetectionHistory(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let history = SharedState.readHistory().map { event -> [String: Any] in
            [
                "id": event.id,
                "timestamp": event.timestamp * 1000,
                "labels": event.labels,
                "categories": event.categories,
                "topScore": event.topScore,
            ]
        }
        resolve(history)
    }

    @objc(clearDetectionHistory:rejecter:)
    func clearDetectionHistory(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        SharedState.clearHistory()
        resolve(true)
    }

    private func presentBroadcastPicker() {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: -1000, y: -1000, width: 1, height: 1))
        picker.preferredExtension = Bundle.main.object(forInfoDictionaryKey: "CerberusBroadcastExtensionBundleId") as? String
        picker.showsMicrophoneButton = false
        if let window = UIApplication.shared.windows.first {
            window.addSubview(picker)
        }
        for subview in picker.subviews {
            if let button = subview as? UIButton {
                button.sendActions(for: .touchUpInside)
            }
        }
        picker.removeFromSuperview()
    }

    private func startPolling() {
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.pollForNewDetections()
        }
    }

    private func pollForNewDetections() {
        guard let latest = SharedState.readHistory().first, latest.id != lastSeenEventId else { return }
        lastSeenEventId = latest.id
        sendEvent(withName: "CerberusDetection", body: [
            "id": latest.id,
            "timestamp": latest.timestamp * 1000,
            "labels": latest.labels,
            "categories": latest.categories,
            "topScore": latest.topScore,
        ])
    }
}
