import SwiftUI

/// The tutor's presence on the study screen.
///
/// Collapsed it is one small button. Expanded it is a card the student can drag
/// anywhere, sized so the worksheet stays visible behind and beside it. There
/// is no state in which the tutor covers the whole page — that is the rule the
/// rest of this file exists to keep.
struct TutorLayer: View {

    @Bindable var model: ReaderModel

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.clear

            switch model.tutorPresentation {
            case .collapsed:
                collapsed
            case .expanded:
                if let tutor = model.tutor {
                    TutorPanel(
                        tutor: tutor,
                        model: model,
                        voice: model.voice,
                        onClose: { model.tutorPresentation = .collapsed }
                    )
                    .transition(.scale(scale: 0.94, anchor: .bottomTrailing).combined(with: .opacity))
                }
            }
        }
        .padding(Theme.Space.xl)
        .animation(Theme.Motion.respecting(Theme.Motion.panel, reduceMotion: reduceMotion), value: model.tutorPresentation)
        .animation(Theme.Motion.respecting(Theme.Motion.fade, reduceMotion: reduceMotion), value: model.suggestion)
    }

    @ViewBuilder
    private var collapsed: some View {
        VStack(alignment: .trailing, spacing: Theme.Space.s) {
            if let suggestion = model.suggestion {
                nudge(suggestion)
            }
            tutorButton
        }
    }

    private var tutorButton: some View {
        Button {
            model.dismissSuggestion()
            model.tutorPresentation = .expanded
        } label: {
            HStack(spacing: Theme.Space.s) {
                Image(systemName: "sparkles")
                    .font(.body.weight(.semibold))
                Text(model.smartActionTitle)
                    .font(Theme.Text.label)
                    .lineLimit(1)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.Space.l)
            .padding(.vertical, Theme.Space.m)
            .frame(minHeight: 48)
            .background(Theme.Palette.tutor, in: Capsule())
            .shadow(color: Theme.Palette.tutor.opacity(0.35), radius: 16, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(model.tutor == nil)
        .opacity(model.tutor == nil ? 0.5 : 1)
        .accessibilityLabel(model.tutor == nil ? "Tutor unavailable" : model.smartActionTitle)
        .accessibilityHint(model.tutor == nil ? "No connection to your tutor" : "Opens your study tutor")
    }

    /// The "need a hint?" nudge. Two buttons, dismissible, and it never appears
    /// twice for the same page.
    private func nudge(_ text: String) -> some View {
        HStack(spacing: Theme.Space.s) {
            Text(text)
                .font(Theme.Text.label)
                .foregroundStyle(Theme.Palette.textPrimary)
            Button("Hint") {
                model.dismissSuggestion()
                model.tutorPresentation = .expanded
                model.tutor?.ask(mode: .hint)
            }
            .font(Theme.Text.label.weight(.semibold))
            .foregroundStyle(Theme.Palette.tutor)

            Button {
                model.dismissSuggestion()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
                    .foregroundStyle(Theme.Palette.textTertiary)
            }
            .accessibilityLabel("Dismiss")
        }
        .padding(.horizontal, Theme.Space.l)
        .padding(.vertical, Theme.Space.m)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.Palette.separator, lineWidth: 0.5))
        .shadow(color: .black.opacity(0.10), radius: 12, y: 4)
        .transition(.move(edge: .trailing).combined(with: .opacity))
    }
}
