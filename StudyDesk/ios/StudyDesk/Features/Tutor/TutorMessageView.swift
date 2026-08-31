import SwiftUI

/// One turn in the tutor transcript.
///
/// The student's turns are compact and right-aligned; the tutor's are plain
/// text at full width, because an explanation is meant to be read, not skimmed
/// out of a coloured bubble.
struct TutorMessageView: View {

    let message: TutorEngine.DisplayMessage
    let isSpeaking: Bool
    let onSpeak: () -> Void

    @Environment(AppSettings.self) private var settings

    var body: some View {
        switch message.role {
        case .student:
            studentTurn
        case .tutor:
            tutorTurn
        }
    }

    private var studentTurn: some View {
        HStack {
            Spacer(minLength: Theme.Space.xxl)
            Text(message.text)
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textPrimary)
                .padding(.horizontal, Theme.Space.m)
                .padding(.vertical, Theme.Space.s)
                .background(Theme.Palette.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("You said: \(message.text)")
    }

    private var tutorTurn: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s) {
            if let verdict = message.verdict {
                verdictChip(verdict)
            }

            // Markdown so the model can use emphasis and lists without the app
            // shipping a parser. Falls back to plain text on anything malformed.
            Text(attributed)
                .font(Theme.Text.body)
                .foregroundStyle(Theme.Palette.textPrimary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)

            if message.isStreaming {
                ThinkingIndicator()
            } else if !message.text.isEmpty {
                footerControls
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var attributed: AttributedString {
        (try? AttributedString(
            markdown: message.text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(message.text)
    }

    private func verdictChip(_ verdict: AnswerVerdict) -> some View {
        HStack(spacing: Theme.Space.xs) {
            Image(systemName: verdict.symbolName)
            Text(verdict.title)
        }
        .font(Theme.Text.label)
        .foregroundStyle(tint(for: verdict))
        .padding(.horizontal, Theme.Space.s)
        .padding(.vertical, 4)
        .background(tint(for: verdict).opacity(0.12), in: Capsule())
    }

    private func tint(for verdict: AnswerVerdict) -> Color {
        switch verdict {
        case .correct: Theme.Palette.success
        case .mostlyCorrect: Theme.Palette.warning
        case .incorrect: Theme.Palette.accent   // not red: "not yet" is not a failure
        case .unclear: Theme.Palette.textSecondary
        }
    }

    private var footerControls: some View {
        HStack(spacing: Theme.Space.m) {
            if settings.voiceEnabled {
                Button(action: onSpeak) {
                    Label(
                        isSpeaking ? "Pause" : "Listen",
                        systemImage: isSpeaking ? "pause.circle" : "speaker.wave.2"
                    )
                    .font(Theme.Text.label)
                    .labelStyle(.titleAndIcon)
                }
                .foregroundStyle(Theme.Palette.tutor)
            }

            if message.includedImage {
                Label("Page image sent", systemImage: "photo")
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.textTertiary)
            }
        }
        .padding(.top, 2)
    }
}

/// The "thinking" state. Three dots, no spinner, no fake progress bar.
struct ThinkingIndicator: View {

    @State private var phase = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Theme.Palette.tutor.opacity(phase == index ? 0.9 : 0.28))
                    .frame(width: 5, height: 5)
            }
        }
        .accessibilityLabel("Your tutor is thinking")
        .task {
            guard !reduceMotion else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(320))
                phase = (phase + 1) % 3
            }
        }
    }
}
