#if canImport(SwiftUI)
import SwiftUI
import SlateAI
import SlateDesign
import SlateModel

/// The tutor.
///
/// Opening it should feel like calling a teacher over to your desk: it appears beside
/// the work, says one useful thing, and can be sent away. It does not ask whether you
/// need help, it does not congratulate you, and it never fills the space with text
/// because the space is there.
struct TutorPanel: View {

    @ObservedObject var model: WorkspaceModel
    @ObservedObject var voice: VoiceController
    @State private var typed = ""
    @FocusState private var isTyping: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: Slate.Space.l) {
                    if let check = model.lastCheck {
                        CheckResult(check: check)
                    }
                    if let reply = model.tutorReply {
                        TutorMessage(reply: reply, voice: voice)
                    }
                    if model.lastCheck == nil && model.tutorReply == nil {
                        EmptyStateView(
                            icon: "sparkle",
                            title: "Ask about anything on the page",
                            detail: "Select something and ask, or just say what you are stuck on. It can see the question and what you have written."
                        )
                        .frame(minHeight: 220)
                    }
                }
                .padding(Slate.Space.l)
            }

            composer
        }
        .background(Slate.Palette.surface)
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        HStack {
            Text("Tutor")
                .font(Slate.Typography.heading)
                .foregroundStyle(Slate.Palette.ink)
            Spacer()
            if model.isThinking {
                ProgressView().controlSize(.small)
            }
            Button {
                model.isTutorOpen = false
            } label: {
                Image(systemName: "xmark")
                    .imageScale(.small)
                    .foregroundStyle(Slate.Palette.inkTertiary)
                    .slateTapTarget()
            }
            .accessibilityLabel("Close the tutor")
        }
        .padding(.horizontal, Slate.Space.l)
        .padding(.vertical, Slate.Space.m)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Slate.Palette.hairline).frame(height: Slate.Space.hairline)
        }
    }

    private var composer: some View {
        VStack(spacing: Slate.Space.s) {
            if model.tutorReply != nil {
                // "More help" is always available and never gated. Refusing a student
                // who has asked twice teaches them to use a different app.
                Button("I still do not get it") {
                    Task { await model.askForMore() }
                }
                .font(Slate.Typography.footnote.weight(.medium))
                .buttonStyle(.plain)
                .foregroundStyle(Slate.Palette.tutor)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: Slate.Space.s) {
                TextField("Ask about this", text: $typed, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(Slate.Typography.body)
                    .lineLimit(1...4)
                    .focused($isTyping)
                    .onSubmit(send)

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .imageScale(.large)
                        .foregroundStyle(typed.isEmpty
                            ? Slate.Palette.inkTertiary : Slate.Palette.tutor)
                        .slateTapTarget()
                }
                .disabled(typed.isEmpty || model.isThinking)
                .accessibilityLabel("Send")
            }
            .padding(Slate.Space.m)
            .slateSurface(raised: true, radius: Slate.Radius.medium)
        }
        .padding(Slate.Space.l)
    }

    private func send() {
        let text = typed.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        typed = ""
        Task { await model.ask(text) }
    }
}

/// A tutor reply. The message first, steps folded away, uncertainty stated.
struct TutorMessage: View {
    let reply: TutorReply
    @ObservedObject var voice: VoiceController
    @State private var showSteps = false

    var body: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            Text(reply.message)
                .font(Slate.Typography.body)
                .foregroundStyle(Slate.Palette.ink)
                .textSelection(.enabled)

            // Only the message is read aloud, never the steps. Hearing a list of steps
            // recited is useless; reading them while they are on screen is not.
            ListenButton(voice: voice, text: reply.message)

            if let uncertainty = reply.uncertainty, !uncertainty.isEmpty {
                // Shown, not buried. A tutor that admits it cannot read a digit is
                // more useful than one that guesses and sounds sure.
                Label(uncertainty, systemImage: "questionmark.circle")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }

            if let steps = reply.steps, !steps.isEmpty {
                DisclosureGroup(isExpanded: $showSteps) {
                    VStack(alignment: .leading, spacing: Slate.Space.s) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            HStack(alignment: .top, spacing: Slate.Space.s) {
                                Text("\(index + 1).")
                                    .font(Slate.Typography.footnote.monospacedDigit())
                                    .foregroundStyle(Slate.Palette.inkTertiary)
                                Text(step.text)
                                    .font(Slate.Typography.body)
                                    .foregroundStyle(Slate.Palette.ink)
                            }
                        }
                    }
                    .padding(.top, Slate.Space.s)
                } label: {
                    Text(showSteps ? "Hide the steps" : "Show the steps")
                        .font(Slate.Typography.footnote.weight(.medium))
                        .foregroundStyle(Slate.Palette.tutor)
                }
            }

            if reply.nextAction.kind != .none {
                Text(reply.nextAction.label)
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A marked answer.
///
/// What is right comes before what is wrong, always. And when arithmetic settled it
/// rather than a model's opinion, the interface says so, because that changes whether a
/// student should trust it or argue with it.
struct CheckResult: View {
    let check: CheckReply

    var body: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            HStack(spacing: Slate.Space.s) {
                VerdictChip(outcome: check.outcome, isCertain: check.isCertain)
                if let step = check.firstProblemStep {
                    Text("from line \(step)")
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }
            }

            if !check.whatIsRight.isEmpty {
                Text(check.whatIsRight)
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.ink)
            }

            if !check.whatToFix.isEmpty {
                Text(check.whatToFix)
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }

            if let error = check.error, check.errorConfidence >= 0.6 {
                Label(error.studentFacingName.capitalisedFirst,
                      systemImage: "tag")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Slate.Space.l)
        .slateSurface(raised: true)
        .accessibilityElement(children: .combine)
    }
}

extension String {
    var capitalisedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}
#endif
