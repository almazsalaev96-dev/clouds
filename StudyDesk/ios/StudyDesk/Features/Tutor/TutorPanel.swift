import SwiftUI

/// The tutor card.
///
/// Sized like a tutor leaning over your shoulder, not like a chat app: 360pt
/// wide, capped at 460pt tall, draggable, and translucent enough that the page
/// is still legible underneath. Quick actions come first because most requests
/// are one of four things; the text field is there for the rest.
struct TutorPanel: View {

    @Bindable var tutor: TutorEngine
    @Bindable var model: ReaderModel
    let voice: VoicePlayer?
    let onClose: () -> Void

    @State private var draft = ""
    @State private var offset: CGSize = .zero
    @State private var dragOffset: CGSize = .zero
    @State private var showsPrivacyDetail = false
    @FocusState private var isComposerFocused: Bool
    @Environment(AppSettings.self) private var settings

    private let width: CGFloat = 360
    private let maxHeight: CGFloat = 460

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            transcript
            Divider()
            footer
        }
        .frame(width: width)
        .frame(maxHeight: maxHeight)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous)
                .strokeBorder(Theme.Palette.separator, lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(Theme.Elevation.floating.opacity), radius: Theme.Elevation.floating.radius, y: Theme.Elevation.floating.y)
        .offset(x: offset.width + dragOffset.width, y: offset.height + dragOffset.height)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: Theme.Space.s) {
            Image(systemName: "sparkles")
                .foregroundStyle(Theme.Palette.tutor)

            VStack(alignment: .leading, spacing: 0) {
                Text("Study Tutor").font(Theme.Text.bodyEmphasis)
                Text(contextLine)
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                showsPrivacyDetail = true
            } label: {
                Image(systemName: "eye")
                    .font(.footnote)
                    .foregroundStyle(Theme.Palette.textTertiary)
            }
            .accessibilityLabel("What gets sent to your tutor")
            .popover(isPresented: $showsPrivacyDetail) {
                PrivacyDetailView(lines: privacyLines)
                    .presentationCompactAdaptation(.popover)
            }

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.Palette.textSecondary)
                    .frame(width: 28, height: 28)
            }
            .accessibilityLabel("Close tutor")
        }
        .padding(.horizontal, Theme.Space.l)
        .padding(.vertical, Theme.Space.m)
        .contentShape(Rectangle())
        // The whole header is the drag handle, so moving the panel out of the
        // way is one gesture rather than a hunt for a grip.
        .gesture(
            DragGesture()
                .onChanged { dragOffset = $0.translation }
                .onEnded { value in
                    offset.width += value.translation.width
                    offset.height += value.translation.height
                    dragOffset = .zero
                }
        )
    }

    private var contextLine: String {
        if model.selectedRegion != nil { return "About the part you selected" }
        if let question = model.detectedQuestionLabel { return question }
        return "Page \(model.pageIndex + 1)"
    }

    private var privacyLines: [String] {
        tutor.lastPrivacySummary.isEmpty
            ? ["Page \(model.pageIndex + 1) of \(model.document.title)",
               settings.sendsPageImages ? "A picture of this page" : "Text only — images are off",
               "The printed text on this page"]
            : tutor.lastPrivacySummary
    }

    // MARK: Transcript

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Theme.Space.m) {
                    if tutor.messages.isEmpty {
                        opener
                    }
                    ForEach(tutor.messages) { message in
                        TutorMessageView(
                            message: message,
                            isSpeaking: voice?.speakingMessageID == message.id,
                            onSpeak: { speak(message) }
                        )
                        .id(message.id)
                    }
                    if let pending = tutor.pendingSolutionRequest {
                        hintFirstPrompt(pending)
                    }
                    if let error = tutor.error {
                        errorRow(error)
                    }
                }
                .padding(Theme.Space.l)
            }
            .onChange(of: tutor.messages.last?.text) { _, _ in
                guard let last = tutor.messages.last else { return }
                withAnimation(Theme.Motion.fade) { proxy.scrollTo(last.id, anchor: .bottom) }
            }
        }
    }

    private var opener: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s) {
            Text(openerText)
                .font(Theme.Text.body)
                .foregroundStyle(Theme.Palette.textPrimary)
            Text("What would you like?")
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textSecondary)
        }
    }

    private var openerText: String {
        if model.selectedRegion != nil {
            return "I can see the part of the page you selected."
        }
        if let question = model.detectedQuestionLabel {
            return "Looks like you're on \(question)."
        }
        if model.hasInkOnCurrentPage {
            return "I can see the question and your working."
        }
        return "I can see this page."
    }

    /// The hint-first fork. Both buttons are equally easy to press; the point
    /// is to make the smaller step visible, not to make the bigger one hard.
    private func hintFirstPrompt(_ pending: TutorEngine.PendingRequest) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.s) {
            Text("I can give you the full solution — want a hint first?")
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textPrimary)
            HStack(spacing: Theme.Space.s) {
                Chip(title: "Hint first", systemImage: "lightbulb", isSelected: true, tint: Theme.Palette.tutor) {
                    tutor.takeHintInstead()
                }
                Chip(title: "Full solution", systemImage: "equal.square") {
                    tutor.takeFullSolution()
                }
            }
        }
        .padding(Theme.Space.m)
        .background(Theme.Palette.tutor.opacity(0.08), in: RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
    }

    private func errorRow(_ error: StudyDeskError) -> some View {
        HStack(alignment: .top, spacing: Theme.Space.s) {
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(Theme.Palette.warning)
            VStack(alignment: .leading, spacing: Theme.Space.xs) {
                Text(error.errorDescription ?? "")
                    .font(Theme.Text.caption)
                    .foregroundStyle(Theme.Palette.textPrimary)
                if error.isRetryable {
                    Button("Try again") {
                        tutor.ask(mode: model.smartActionMode)
                    }
                    .font(Theme.Text.label.weight(.semibold))
                    .foregroundStyle(Theme.Palette.accent)
                }
            }
        }
        .padding(Theme.Space.m)
        .background(Theme.Palette.warning.opacity(0.10), in: RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
    }

    // MARK: Footer

    private var footer: some View {
        VStack(spacing: Theme.Space.s) {
            SmartActionBar(
                modes: model.suggestedModes,
                isBusy: tutor.isStreaming,
                onSelect: { tutor.ask(mode: $0) }
            )

            HStack(spacing: Theme.Space.s) {
                TextField("Ask anything…", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.plain)
                    .font(Theme.Text.caption)
                    .focused($isComposerFocused)
                    .onSubmit(send)
                    .submitLabel(.send)

                if tutor.isStreaming {
                    Button {
                        tutor.cancel()
                    } label: {
                        Image(systemName: "stop.circle.fill")
                            .font(.title3)
                            .foregroundStyle(Theme.Palette.textSecondary)
                    }
                    .accessibilityLabel("Stop")
                } else {
                    Button(action: send) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title3)
                            .foregroundStyle(draft.trimmedNonEmpty == nil ? Theme.Palette.textTertiary : Theme.Palette.tutor)
                    }
                    .disabled(draft.trimmedNonEmpty == nil)
                    .accessibilityLabel("Send")
                }
            }
            .padding(.horizontal, Theme.Space.m)
            .padding(.vertical, Theme.Space.s)
            .background(Theme.Palette.surfaceRaised, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.Palette.separator, lineWidth: 0.5))
        }
        .padding(Theme.Space.m)
    }

    // MARK: Actions

    private func send() {
        guard let text = draft.trimmedNonEmpty else { return }
        draft = ""
        tutor.ask(mode: nil, message: text)
    }

    private func speak(_ message: TutorEngine.DisplayMessage) {
        guard let voice else { return }
        if voice.speakingMessageID == message.id, voice.state == .playing {
            voice.pause()
        } else if voice.speakingMessageID == message.id, voice.state == .paused {
            voice.resume()
        } else {
            voice.speak(message.text, messageID: message.id)
        }
    }
}

/// The four subject-appropriate actions. Chips rather than a menu: a student
/// stuck on a question shouldn't have to read twelve options to find "hint".
struct SmartActionBar: View {

    let modes: [TutorMode]
    let isBusy: Bool
    let onSelect: (TutorMode) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.s) {
                ForEach(modes) { mode in
                    Chip(title: mode.title, systemImage: mode.symbolName, tint: Theme.Palette.tutor) {
                        onSelect(mode)
                    }
                    .disabled(isBusy)
                    .opacity(isBusy ? 0.5 : 1)
                }
            }
            .padding(.horizontal, Theme.Space.xs)
        }
        .scrollClipDisabled()
    }
}

/// Shown behind the eye button in the panel header: exactly what this request
/// will send, in the moment the student can still change their mind.
private struct PrivacyDetailView: View {

    let lines: [String]
    @Environment(AppSettings.self) private var settings

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.m) {
            Text("What your tutor sees").font(Theme.Text.section)
            VStack(alignment: .leading, spacing: Theme.Space.xs) {
                ForEach(lines, id: \.self) { line in
                    Label(line, systemImage: "checkmark")
                        .font(Theme.Text.caption)
                        .foregroundStyle(Theme.Palette.textSecondary)
                }
            }
            Divider()
            Text("Your handwriting is read on this iPad. Nothing else from your library is sent.")
                .font(Theme.Text.label)
                .foregroundStyle(Theme.Palette.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

            Toggle("Send a picture of the page", isOn: Binding(
                get: { settings.sendsPageImages },
                set: { settings.sendsPageImages = $0 }
            ))
            .font(Theme.Text.caption)
        }
        .padding(Theme.Space.l)
        .frame(width: 300)
    }
}
