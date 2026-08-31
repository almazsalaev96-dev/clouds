import SwiftUI

/// The single source of truth for how Study Desk looks.
///
/// Rules that keep the app feeling like one product:
/// - Nothing hardcodes a colour, radius, or spacing value. It comes from here.
/// - Every colour is defined for light *and* dark; the PDF page stays paper-white
///   in both, because a worksheet that inverts is a worksheet you can't read.
/// - Type scale is derived from Dynamic Type, never from fixed point sizes.
enum Theme {}

// MARK: - Colour

extension Theme {
    enum Palette {
        /// The desk surface behind cards. Warm, not clinical.
        static let background = Color(light: .init(white: 0.96), dark: .init(white: 0.07))
        /// Cards, panels, toolbars.
        static let surface = Color(light: .white, dark: .init(white: 0.13))
        /// A surface sitting on top of another surface (popover on a card).
        static let surfaceRaised = Color(light: .white, dark: .init(white: 0.18))
        /// Hairlines and dividers.
        static let separator = Color(light: .init(white: 0.88), dark: .init(white: 0.26))

        static let textPrimary = Color(light: .init(white: 0.09), dark: .init(white: 0.96))
        static let textSecondary = Color(light: .init(white: 0.42), dark: .init(white: 0.66))
        static let textTertiary = Color(light: .init(white: 0.60), dark: .init(white: 0.48))

        /// The one accent. Used for the tutor, primary actions, and progress.
        static let accent = Color(
            light: .init(red: 0.20, green: 0.42, blue: 0.92),
            dark: .init(red: 0.44, green: 0.62, blue: 1.00)
        )
        /// The tutor's own tint — a shade apart from `accent` so AI-authored
        /// content is never mistaken for the student's work.
        static let tutor = Color(
            light: .init(red: 0.42, green: 0.30, blue: 0.86),
            dark: .init(red: 0.66, green: 0.56, blue: 1.00)
        )
        static let success = Color(
            light: .init(red: 0.10, green: 0.56, blue: 0.35),
            dark: .init(red: 0.35, green: 0.80, blue: 0.57)
        )
        static let warning = Color(
            light: .init(red: 0.72, green: 0.48, blue: 0.05),
            dark: .init(red: 0.96, green: 0.74, blue: 0.32)
        )
        static let danger = Color(
            light: .init(red: 0.78, green: 0.20, blue: 0.18),
            dark: .init(red: 1.00, green: 0.46, blue: 0.42)
        )

        /// The page itself. Deliberately identical in both appearances.
        static let page = Color.white
    }
}

// MARK: - Spacing, radius, elevation

extension Theme {
    /// A 4pt grid. Every gap in the app is one of these.
    enum Space {
        static let xxs: CGFloat = 2
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
        static let xxxl: CGFloat = 48
    }

    enum Radius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 14
        static let large: CGFloat = 20
        static let panel: CGFloat = 24
        /// Fully rounded controls (the tutor button, chips).
        static let pill: CGFloat = 999
    }

    enum Elevation {
        static let card = ShadowStyle(radius: 12, y: 4, opacity: 0.07)
        static let floating = ShadowStyle(radius: 24, y: 10, opacity: 0.14)

        struct ShadowStyle {
            let radius: CGFloat
            let y: CGFloat
            let opacity: Double
        }
    }
}

// MARK: - Type

extension Theme {
    enum Text {
        static let display = Font.system(.largeTitle, design: .rounded).weight(.bold)
        static let title = Font.system(.title2, design: .rounded).weight(.semibold)
        static let section = Font.system(.headline, design: .rounded).weight(.semibold)
        static let body = Font.system(.body)
        static let bodyEmphasis = Font.system(.body).weight(.medium)
        static let caption = Font.system(.subheadline)
        static let label = Font.system(.footnote, design: .rounded).weight(.medium)
        /// Used only where a value should line up in a column.
        static let numeric = Font.system(.subheadline, design: .rounded).monospacedDigit()
    }
}

// MARK: - Motion

extension Theme {
    /// Animations are short and have a job. Nothing here is longer than 0.35s,
    /// and everything respects Reduce Motion via `Motion.respecting(_:)`.
    enum Motion {
        static let tap = Animation.spring(response: 0.28, dampingFraction: 0.82)
        static let panel = Animation.spring(response: 0.34, dampingFraction: 0.86)
        static let fade = Animation.easeOut(duration: 0.18)

        static func respecting(_ animation: Animation, reduceMotion: Bool) -> Animation? {
            reduceMotion ? nil : animation
        }
    }
}

// MARK: - Appearance-aware colour helper

extension Color {
    /// Builds a colour that resolves per appearance without needing an asset
    /// catalog entry, so the palette above stays readable in one file.
    init(light: RGB, dark: RGB) {
        self.init(uiColor: UIColor { traits in
            let rgb = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: rgb.red, green: rgb.green, blue: rgb.blue, alpha: rgb.alpha)
        })
    }

    struct RGB {
        var red: CGFloat
        var green: CGFloat
        var blue: CGFloat
        var alpha: CGFloat = 1

        init(red: CGFloat, green: CGFloat, blue: CGFloat, alpha: CGFloat = 1) {
            self.red = red
            self.green = green
            self.blue = blue
            self.alpha = alpha
        }

        init(white: CGFloat, alpha: CGFloat = 1) {
            self.init(red: white, green: white, blue: white, alpha: alpha)
        }
    }
}
