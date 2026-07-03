import ReplayKit
import UserNotifications
import TensorFlowLiteTaskVision
import CoreImage

/// Broadcast Upload Extension entry point. iOS routes screen frames here (in a
/// separate, sandboxed process with a tight memory ceiling) once the user starts
/// a broadcast via the system picker. This is the only Apple-sanctioned way to
/// see on-screen content while the app itself is backgrounded — there is no
/// equivalent of Android's MediaProjection-in-a-foreground-service here.
///
/// Because this process can be jetsam-killed for exceeding its memory budget,
/// keep the model tiny and only decode every Nth frame.
class SampleHandler: RPBroadcastSampleHandler {

    private var detector: ObjectDetector?
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    private let personLabels: Set<String> = ["person"]
    private let vehicleLabels: Set<String> = ["car", "motorcycle", "bus", "truck", "train", "bicycle"]

    private var lastProcessedAt = Date.distantPast
    private var lastNotifiedAt: [String: Date] = [:]

    private var settings = SharedSettings.load()

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        SharedState.setMonitoring(true)
        settings = SharedSettings.load()
        do {
            guard let modelPath = Bundle(for: SampleHandler.self).path(forResource: "model", ofType: "tflite") else {
                SharedState.recordError("Detection model not bundled with extension")
                return
            }
            let options = ObjectDetectorOptions(modelPath: modelPath)
            options.classificationOptions.maxResults = 10
            options.classificationOptions.scoreThreshold = 0.2
            detector = try ObjectDetector.detector(options: options)
        } catch {
            SharedState.recordError("Failed to load detector: \(error.localizedDescription)")
        }
    }

    override func broadcastFinished() {
        SharedState.setMonitoring(false)
        detector = nil
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video else { return }
        guard let detector = detector else { return }

        let now = Date()
        guard now.timeIntervalSince(lastProcessedAt) >= settings.intervalSeconds else { return }
        lastProcessedAt = now

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        do {
            let mlImage = MLImage(pixelBuffer: pixelBuffer)
            let result = try detector.detect(mlImage: mlImage!)
            handle(result: result)
        } catch {
            // Skip this frame; a transient detector failure shouldn't kill the broadcast.
        }
    }

    private func handle(result: DetectionResult) {
        var labels: [String] = []
        var categories: Set<String> = []
        var topScore: Float = 0

        for detection in result.detections {
            guard let best = detection.categories.max(by: { $0.score < $1.score }) else { continue }
            guard best.score >= settings.confidenceThreshold else { continue }
            let label = best.label?.lowercased() ?? ""
            if personLabels.contains(label), settings.notifyPerson {
                labels.append(label)
                categories.insert("PERSON")
                topScore = max(topScore, best.score)
            } else if vehicleLabels.contains(label), settings.notifyVehicle {
                labels.append(label)
                categories.insert("VEHICLE")
                topScore = max(topScore, best.score)
            }
        }

        guard !labels.isEmpty else { return }

        let now = Date()
        let due = categories.filter { category in
            let last = lastNotifiedAt[category] ?? .distantPast
            return now.timeIntervalSince(last) >= settings.cooldownSeconds
        }
        guard !due.isEmpty else { return }
        due.forEach { lastNotifiedAt[$0] = now }

        let event = DetectionEvent(
            id: UUID().uuidString,
            timestamp: now.timeIntervalSince1970,
            labels: Array(Set(labels)),
            categories: Array(categories),
            topScore: topScore
        )
        SharedState.appendHistory(event)
        postNotification(for: event)
    }

    private func postNotification(for event: DetectionEvent) {
        let hasPerson = event.categories.contains("PERSON")
        let hasVehicle = event.categories.contains("VEHICLE")
        let content = UNMutableNotificationContent()
        content.title = hasPerson && hasVehicle
            ? "Person & vehicle detected"
            : (hasPerson ? "Person detected" : "Vehicle detected")
        content.body = event.labels.map { $0.capitalized }.joined(separator: ", ")
        content.sound = .default

        let request = UNNotificationRequest(identifier: event.id, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
