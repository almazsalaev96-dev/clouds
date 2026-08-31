import SwiftUI

/// Subjects are stored as plain strings so a student can add their own, but
/// every subject — known or not — gets a stable icon and colour so the desk
/// never looks half-designed.
struct Subject: Hashable, Identifiable, Codable {
    var name: String

    var id: String { name.lowercased() }

    init(_ name: String) {
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static let mathematics = Subject("Mathematics")
    static let physics = Subject("Physics")
    static let chemistry = Subject("Chemistry")
    static let biology = Subject("Biology")
    static let economics = Subject("Economics")
    static let business = Subject("Business")
    static let computerScience = Subject("Computer Science")
    static let history = Subject("History")
    static let geography = Subject("Geography")
    static let english = Subject("English")
    static let unspecified = Subject("Unsorted")

    static let builtIn: [Subject] = [
        .mathematics, .physics, .chemistry, .biology, .economics,
        .business, .computerScience, .history, .geography, .english
    ]

    var symbolName: String {
        switch id {
        case Subject.mathematics.id: "function"
        case Subject.physics.id: "atom"
        case Subject.chemistry.id: "flask"
        case Subject.biology.id: "leaf"
        case Subject.economics.id: "chart.line.uptrend.xyaxis"
        case Subject.business.id: "briefcase"
        case Subject.computerScience.id: "chevron.left.forwardslash.chevron.right"
        case Subject.history.id: "building.columns"
        case Subject.geography.id: "globe.europe.africa"
        case Subject.english.id: "text.book.closed"
        case Subject.unspecified.id: "tray"
        default: "book"
        }
    }

    /// Deterministic hue for custom subjects, so "Latin" always looks the same
    /// on every device without needing a stored colour.
    var tint: Color {
        let builtInTints: [String: Color] = [
            Subject.mathematics.id: Color(red: 0.20, green: 0.42, blue: 0.92),
            Subject.physics.id: Color(red: 0.44, green: 0.30, blue: 0.86),
            Subject.chemistry.id: Color(red: 0.86, green: 0.44, blue: 0.20),
            Subject.biology.id: Color(red: 0.16, green: 0.62, blue: 0.38),
            Subject.economics.id: Color(red: 0.14, green: 0.56, blue: 0.62),
            Subject.business.id: Color(red: 0.60, green: 0.40, blue: 0.18),
            Subject.computerScience.id: Color(red: 0.30, green: 0.34, blue: 0.72),
            Subject.history.id: Color(red: 0.56, green: 0.26, blue: 0.34),
            Subject.geography.id: Color(red: 0.22, green: 0.50, blue: 0.44),
            Subject.english.id: Color(red: 0.72, green: 0.28, blue: 0.50),
            Subject.unspecified.id: Color(red: 0.45, green: 0.45, blue: 0.48)
        ]
        if let tint = builtInTints[id] { return tint }

        // Swift's Hasher is seeded per process, so it would give a subject a
        // different colour on every launch. This is a stable djb2 instead.
        var hash: UInt32 = 5381
        for scalar in id.unicodeScalars {
            hash = (hash &* 33) &+ (scalar.value & 0xFF)
        }
        let hue = Double(hash % 360) / 360
        return Color(hue: hue, saturation: 0.52, brightness: 0.72)
    }
}
