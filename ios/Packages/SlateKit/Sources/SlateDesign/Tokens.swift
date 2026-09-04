#if canImport(SwiftUI)
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// The design system.
///
/// Calm, spacious, precise. The page is the subject of every screen and the interface
/// is the frame around it, so nothing here competes with a worksheet for attention:
/// no gradients, no glow, no floating cards stacked three deep, and no colour that
/// exists only to signal that software is involved.
public enum Slate {

    // MARK: - Colour

    /// Colours are defined in code rather than in an asset catalogue.
    ///
    /// Two reasons: a missing colour asset fails at runtime as magenta rather than at
    /// build time, and having the light and dark values side by side in one file is the
    /// only way anyone notices when a pair stops being legible together.
    public enum Palette {
        /// The page. Slightly warm, so a scanned worksheet does not look grey on it.
        public static let paper = adaptive(light: 0xFCFBF8, dark: 0x121316)
        public static let surface = adaptive(light: 0xFFFFFF, dark: 0x1B1C20)
        public static let surfaceRaised = adaptive(light: 0xF6F5F1, dark: 0x24262B)
        public static let ink = adaptive(light: 0x1C1E22, dark: 0xF2F2F0)
        public static let inkSecondary = adaptive(light: 0x5A5E66, dark: 0xA8ACB4)
        public static let inkTertiary = adaptive(light: 0x8C9098, dark: 0x74787F)
        public static let hairline = adaptive(light: 0xE4E2DC, dark: 0x33353A)

        /// The tutor's single accent. One colour, used sparingly, so that when it
        /// appears the student already knows what it means.
        public static let tutor = adaptive(light: 0x3A5CB8, dark: 0x7D9BEA)

        /// Verdicts, deliberately muted. A red flash on a wrong answer teaches
        /// avoidance rather than mathematics, so "incorrect" is a considered amber-red
        /// at low saturation and "correct" never shouts.
        public static let correct = adaptive(light: 0x3C7A52, dark: 0x6FB587)
        public static let partial = adaptive(light: 0x9A7327, dark: 0xD4AC5A)
        public static let incorrect = adaptive(light: 0xA84B3C, dark: 0xE08A78)
        public static let dueSoon = adaptive(light: 0x9A5B27, dark: 0xD79A5E)

        static func adaptive(light: UInt32, dark: UInt32) -> Color {
            #if canImport(UIKit)
            return Color(UIColor { traits in
                UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
            })
            #else
            return Color(rgb: light)
            #endif
        }
    }

    // MARK: - Spacing

    /// A four-point grid. Everything is a multiple, which is most of what makes a
    /// layout feel deliberate rather than assembled.
    public enum Space {
        public static let hairline: CGFloat = 1
        public static let xs: CGFloat = 4
        public static let s: CGFloat = 8
        public static let m: CGFloat = 12
        public static let l: CGFloat = 16
        public static let xl: CGFloat = 24
        public static let xxl: CGFloat = 32
        public static let section: CGFloat = 48
    }

    public enum Radius {
        public static let small: CGFloat = 8
        public static let medium: CGFloat = 14
        public static let large: CGFloat = 22
        public static let sheet: CGFloat = 28
    }

    // MARK: - Typography

    /// Dynamic Type throughout. A fixed point size is an accessibility failure that
    /// looks fine on the designer's device and nowhere else.
    ///
    /// Named `Typography` rather than `Type` because `Slate.Type` is Swift's metatype
    /// syntax and would refer to the type of `Slate` itself.
    public enum Typography {
        public static let display = Font.system(.largeTitle, design: .serif, weight: .regular)
        public static let title = Font.system(.title2, design: .default, weight: .semibold)
        public static let heading = Font.system(.headline, design: .default, weight: .semibold)
        public static let body = Font.system(.body)
        public static let bodyEmphasis = Font.system(.body, weight: .medium)
        public static let caption = Font.system(.subheadline)
        public static let footnote = Font.system(.footnote)
        /// Mathematics and transcribed working, where alignment carries meaning.
        public static let mono = Font.system(.body, design: .monospaced)
    }

    // MARK: - Motion

    /// Motion exists to explain where something came from. Anything longer than this
    /// is decoration, and decoration between a student and their next answer is a cost.
    public enum Motion {
        public static let quick = Animation.easeOut(duration: 0.18)
        public static let standard = Animation.easeInOut(duration: 0.26)
        public static let sheet = Animation.spring(response: 0.38, dampingFraction: 0.86)

        /// Respects the accessibility setting rather than merely offering one.
        public static func respectful(_ animation: Animation,
                                      reduceMotion: Bool) -> Animation? {
            reduceMotion ? nil : animation
        }
    }

    public enum Layout {
        /// The tutor never takes more than this. The page is the point of the screen.
        public static let tutorPanelWidth: CGFloat = 380
        public static let toolbarHeight: CGFloat = 52
        public static let minimumTapTarget: CGFloat = 44
        public static let readableWidth: CGFloat = 680
    }
}

public extension View {
    /// One surface treatment, used everywhere. A hairline border rather than a shadow:
    /// shadows stack, and a screen of stacked shadows looks like a filing cabinet.
    func slateSurface(raised: Bool = false, radius: CGFloat = Slate.Radius.medium) -> some View {
        background(raised ? Slate.Palette.surfaceRaised : Slate.Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Slate.Palette.hairline, lineWidth: Slate.Space.hairline)
            )
    }

    /// Everything tappable is at least 44 points, without having to remember to say so.
    func slateTapTarget() -> some View {
        frame(minWidth: Slate.Layout.minimumTapTarget,
              minHeight: Slate.Layout.minimumTapTarget)
            .contentShape(Rectangle())
    }
}

#if canImport(UIKit)
extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}
#else
extension Color {
    init(rgb: UInt32) {
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
#endif
#endif
