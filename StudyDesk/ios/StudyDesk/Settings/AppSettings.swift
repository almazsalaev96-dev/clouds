import SwiftUI

/// Everything a student can change, in one observable object.
///
/// Backed by `UserDefaults` — these are preferences, not work, and they should
/// survive a database repair.
@MainActor
@Observable
final class AppSettings {

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        defaults.register(defaults: [
            Key.hintFirst: true,
            Key.voiceEnabled: true,
            Key.voiceSpeed: 1.0,
            Key.remembersWeakTopics: false,   // opt in, never opt out
            Key.sendsPageImages: true,
            Key.smartSuggestions: true,
            Key.hasCompletedOnboarding: false,
            Key.hasSeenReaderTips: false,
            Key.autoDetectSubject: true
        ])
    }

    private enum Key {
        static let hintFirst = "settings.hintFirst"
        static let voiceEnabled = "settings.voiceEnabled"
        static let voiceSpeed = "settings.voiceSpeed"
        static let remembersWeakTopics = "settings.remembersWeakTopics"
        static let sendsPageImages = "settings.sendsPageImages"
        static let smartSuggestions = "settings.smartSuggestions"
        static let hasCompletedOnboarding = "settings.hasCompletedOnboarding"
        static let hasSeenReaderTips = "settings.hasSeenReaderTips"
        static let autoDetectSubject = "settings.autoDetectSubject"
    }

    /// When on, asking for "the answer" offers a hint first. The student can
    /// always take the full solution — this is a nudge, not a lock.
    var hintFirst: Bool {
        get { access(Key.hintFirst) }
        set { set(Key.hintFirst, newValue) }
    }

    var voiceEnabled: Bool {
        get { access(Key.voiceEnabled) }
        set { set(Key.voiceEnabled, newValue) }
    }

    var voiceSpeed: Double {
        get {
            _ = revision
            return defaults.double(forKey: Key.voiceSpeed)
        }
        set { set(Key.voiceSpeed, min(1.4, max(0.7, newValue))) }
    }

    var remembersWeakTopics: Bool {
        get { access(Key.remembersWeakTopics) }
        set { set(Key.remembersWeakTopics, newValue) }
    }

    /// Off means the tutor works from text alone — no picture of the page ever
    /// leaves the iPad. Diagrams stop working; some students will want that
    /// trade, and it should be theirs to make.
    var sendsPageImages: Bool {
        get { access(Key.sendsPageImages) }
        set { set(Key.sendsPageImages, newValue) }
    }

    /// The "need a hint?" nudge after a long pause.
    var smartSuggestions: Bool {
        get { access(Key.smartSuggestions) }
        set { set(Key.smartSuggestions, newValue) }
    }

    var autoDetectSubject: Bool {
        get { access(Key.autoDetectSubject) }
        set { set(Key.autoDetectSubject, newValue) }
    }

    var hasCompletedOnboarding: Bool {
        get { access(Key.hasCompletedOnboarding) }
        set { set(Key.hasCompletedOnboarding, newValue) }
    }

    var hasSeenReaderTips: Bool {
        get { access(Key.hasSeenReaderTips) }
        set { set(Key.hasSeenReaderTips, newValue) }
    }

    // MARK: Plumbing

    /// `@Observable` needs the read to go through a property it can track, so
    /// each accessor touches this counter. Cheap, and it keeps the settings in
    /// one place instead of scattered `@AppStorage` across a dozen views.
    private var revision = 0

    private func access(_ key: String) -> Bool {
        _ = revision
        return defaults.bool(forKey: key)
    }

    private func set(_ key: String, _ value: Any) {
        defaults.set(value, forKey: key)
        revision &+= 1
    }
}
