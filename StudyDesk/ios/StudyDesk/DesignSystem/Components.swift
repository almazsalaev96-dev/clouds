import SwiftUI

// MARK: - Surfaces

/// The standard card. Used for documents, assignments, tutor panels — anything
/// that needs to read as a discrete object on the desk.
struct DeskCard<Content: View>: View {
    var padding: CGFloat = Theme.Space.l
    var elevation: Theme.Elevation.ShadowStyle = Theme.Elevation.card
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                    .strokeBorder(Theme.Palette.separator, lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(elevation.opacity), radius: elevation.radius, y: elevation.y)
    }
}

// MARK: - Buttons

struct PrimaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.Palette.accent
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Text.bodyEmphasis)
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.Space.xl)
            .padding(.vertical, Theme.Space.m)
            .frame(minHeight: 44)
            .background(tint.opacity(configuration.isPressed ? 0.82 : 1), in: Capsule())
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(Theme.Motion.respecting(Theme.Motion.tap, reduceMotion: reduceMotion), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Text.bodyEmphasis)
            .foregroundStyle(Theme.Palette.textPrimary)
            .padding(.horizontal, Theme.Space.l)
            .padding(.vertical, Theme.Space.m)
            .frame(minHeight: 44)
            .background(Theme.Palette.surfaceRaised, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.Palette.separator, lineWidth: 0.5))
            .opacity(configuration.isPressed ? 0.7 : 1)
            .animation(Theme.Motion.respecting(Theme.Motion.fade, reduceMotion: reduceMotion), value: configuration.isPressed)
    }
}

/// A compact tappable chip. Tutor quick actions, subject filters, tool options.
struct Chip: View {
    let title: String
    var systemImage: String?
    var isSelected: Bool = false
    var tint: Color = Theme.Palette.accent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Space.xs) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(Theme.Text.label)
            .padding(.horizontal, Theme.Space.m)
            .padding(.vertical, Theme.Space.s)
            .frame(minHeight: 34)
            .foregroundStyle(isSelected ? Color.white : Theme.Palette.textPrimary)
            .background(
                isSelected ? tint : Theme.Palette.surfaceRaised,
                in: Capsule()
            )
            .overlay(
                Capsule().strokeBorder(isSelected ? .clear : Theme.Palette.separator, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Structure

struct SectionHeader: View {
    let title: String
    var subtitle: String?
    var action: (title: String, handler: () -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: Theme.Space.xxs) {
                Text(title).font(Theme.Text.section)
                if let subtitle {
                    Text(subtitle)
                        .font(Theme.Text.caption)
                        .foregroundStyle(Theme.Palette.textSecondary)
                }
            }
            Spacer(minLength: Theme.Space.m)
            if let action {
                Button(action.title, action: action.handler)
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.accent)
            }
        }
    }
}

/// Shown wherever a list can legitimately be empty. Never a dead end: every
/// empty state carries the action that fills it.
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Space.m) {
            Image(systemName: icon)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.Palette.textTertiary)
            Text(title).font(Theme.Text.section)
            Text(message)
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, Theme.Space.xs)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Space.xxl)
    }
}

/// A thin progress bar with a label. Used on document cards and the exam report.
struct ProgressBar: View {
    let value: Double
    var tint: Color = Theme.Palette.accent
    var height: CGFloat = 5

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Palette.separator)
                Capsule()
                    .fill(tint)
                    .frame(width: max(0, min(1, value)) * geo.size.width)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityLabel("Progress")
        .accessibilityValue("\(Int((max(0, min(1, value)) * 100).rounded())) percent")
    }
}

// MARK: - Feedback

/// A transient, non-blocking message ("Saved", "You're offline"). Never a modal:
/// nothing in the study view is allowed to interrupt writing.
struct Toast: Equatable, Identifiable {
    enum Kind { case info, success, warning }

    let id = UUID()
    var kind: Kind = .info
    var message: String

    static func == (lhs: Toast, rhs: Toast) -> Bool { lhs.id == rhs.id }
}

struct ToastView: View {
    let toast: Toast

    private var icon: String {
        switch toast.kind {
        case .info: "info.circle.fill"
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        }
    }

    private var tint: Color {
        switch toast.kind {
        case .info: Theme.Palette.accent
        case .success: Theme.Palette.success
        case .warning: Theme.Palette.warning
        }
    }

    var body: some View {
        HStack(spacing: Theme.Space.s) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(toast.message)
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textPrimary)
        }
        .padding(.horizontal, Theme.Space.l)
        .padding(.vertical, Theme.Space.m)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.Palette.separator, lineWidth: 0.5))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
        .accessibilityElement(children: .combine)
    }
}

extension View {
    /// Presents a toast above the content without taking focus or blocking touch.
    func toast(_ toast: Binding<Toast?>) -> some View {
        overlay(alignment: .top) {
            if let value = toast.wrappedValue {
                ToastView(toast: value)
                    .padding(.top, Theme.Space.l)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .allowsHitTesting(false)
                    .task(id: value.id) {
                        try? await Task.sleep(for: .seconds(2.6))
                        withAnimation(Theme.Motion.fade) { toast.wrappedValue = nil }
                    }
            }
        }
        .animation(Theme.Motion.panel, value: toast.wrappedValue)
    }
}
