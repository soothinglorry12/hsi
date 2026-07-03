import Foundation

/// Shared between the main app target and the BroadcastExtension target.
/// Add this file (and the rest of ios/Shared/) to BOTH targets' "Target Membership"
/// in Xcode. Replace this identifier with an App Group you've registered in your
/// own Apple Developer account, and set it identically in both targets'
/// entitlements files.
enum AppGroup {
    static let identifier = "group.com.projectcerberus.shared"
}
