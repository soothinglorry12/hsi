import Foundation

struct DetectionEvent: Codable {
    let id: String
    let timestamp: TimeInterval
    let labels: [String]
    let categories: [String]
    let topScore: Float
}
