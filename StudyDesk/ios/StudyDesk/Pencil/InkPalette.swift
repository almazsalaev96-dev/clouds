import SwiftUI

/// The ink colours offered in the toolbar.
///
/// Chosen for schoolwork rather than for art: dark enough to photocopy, distinct
/// from each other for a colour-blind reader, and — critically — none of them is
/// the tutor's purple. AI-suggested marks must never be confusable with the
/// student's own hand.
enum InkPalette {

    struct Ink: Identifiable, Equatable {
        let id: String
        let name: String
        let color: Color
    }

    static let colors: [Ink] = [
        Ink(id: "graphite", name: "Graphite", color: Color(red: 0.11, green: 0.12, blue: 0.14)),
        Ink(id: "ink-blue", name: "Ink Blue", color: Color(red: 0.13, green: 0.28, blue: 0.68)),
        Ink(id: "marking-red", name: "Marking Red", color: Color(red: 0.76, green: 0.16, blue: 0.16)),
        Ink(id: "forest", name: "Forest", color: Color(red: 0.11, green: 0.44, blue: 0.28)),
        Ink(id: "amber", name: "Amber", color: Color(red: 0.85, green: 0.55, blue: 0.06)),
        Ink(id: "teal", name: "Teal", color: Color(red: 0.10, green: 0.48, blue: 0.55))
    ]

    /// Highlighters get their own, lighter set — the pen colours are far too
    /// dark to read printed text through.
    static let highlighterColors: [Ink] = [
        Ink(id: "hl-yellow", name: "Yellow", color: Color(red: 1.00, green: 0.87, blue: 0.20)),
        Ink(id: "hl-green", name: "Green", color: Color(red: 0.50, green: 0.92, blue: 0.44)),
        Ink(id: "hl-pink", name: "Pink", color: Color(red: 1.00, green: 0.52, blue: 0.72)),
        Ink(id: "hl-blue", name: "Blue", color: Color(red: 0.44, green: 0.78, blue: 1.00)),
        Ink(id: "hl-orange", name: "Orange", color: Color(red: 1.00, green: 0.68, blue: 0.32))
    ]

    static func colors(for kind: PencilToolState.Kind) -> [Ink] {
        kind == .highlighter ? highlighterColors : colors
    }

    /// The colour the tutor uses for anything it draws on a page. One colour,
    /// used nowhere else, always dashed — see `AnnotationSuggestion`.
    static let tutorInk = Color(red: 0.42, green: 0.30, blue: 0.86)
}
