#if canImport(SwiftUI)
import SwiftUI
import SlateAI
import SlateDesign
import SlateLearning
import SlateModel

/// One intervention, on screen.
///
/// The plan is visible from the start — a student who can see that this is five minutes
/// and four steps behaves differently from one staring into an open-ended session — and
/// the last step is always the one that measures whether it worked.
public struct PracticeView: View {

    @ObservedObject var model: PracticeModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var answerFocused: Bool

    public init(model: PracticeModel) { self.model = model }

    public var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                header
                ScrollView {
                    content
                        .padding(Slate.Space.xl)
                        .frame(maxWidth: Slate.Layout.readableWidth, alignment: .leading)
                        .frame(maxWidth: .infinity)
                }
                footer
            }
            .background(Slate.Palette.paper)
            .navigationTitle(model.concept.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Stop") { dismiss() }
                }
            }
            .task { await model.start() }
            .animation(Slate.Motion.respectful(Slate.Motion.standard, reduceMotion: reduceMotion),
                       value: model.stepIndex)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Slate.Space.s) {
            // Why this plan exists, in the student's terms. A recommendation nobody can
            // check is a recommendation they eventually stop trusting.
            Text(model.plan.rationale)
                .font(Slate.Typography.caption)
                .foregroundStyle(Slate.Palette.inkSecondary)

            HStack(spacing: Slate.Space.xs) {
                ForEach(Array(model.plan.steps.enumerated()), id: \.offset) { index, step in
                    Capsule()
                        .fill(index <= model.stepIndex
                              ? Slate.Palette.tutor : Slate.Palette.hairline)
                        .frame(height: 3)
                        .accessibilityLabel(step.kind.label)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Step \(model.stepIndex + 1) of \(model.plan.steps.count)")
        }
        .padding(.horizontal, Slate.Space.xl)
        .padding(.vertical, Slate.Space.m)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .preparing:
            ProgressView().frame(maxWidth: .infinity, minHeight: 200)

        case .learning(let step, let text):
            VStack(alignment: .leading, spacing: Slate.Space.m) {
                Text(step.kind.label)
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
                Text(text)
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.ink)
                    .textSelection(.enabled)
            }

        case .answering(let step, let question):
            VStack(alignment: .leading, spacing: Slate.Space.l) {
                Text(step.kind.label)
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
                Text(question.prompt)
                    .font(Slate.Typography.title)
                    .foregroundStyle(Slate.Palette.ink)

                TextField("Your answer", text: $model.typedAnswer, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(Slate.Typography.mono)
                    .lineLimit(1...5)
                    .focused($answerFocused)
                    .padding(Slate.Space.m)
                    .slateSurface()
                    .onSubmit { Task { await model.submit() } }

                if question.marks > 1 {
                    Text("\(question.marks) marks")
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }
            }
            .onAppear { answerFocused = true }

        case .marked(_, let question, let reply):
            VStack(alignment: .leading, spacing: Slate.Space.l) {
                Text(question.prompt)
                    .font(Slate.Typography.bodyEmphasis)
                    .foregroundStyle(Slate.Palette.inkSecondary)
                CheckResult(check: reply)
                if reply.outcome != .correct {
                    DisclosureGroup("Show the worked solution") {
                        VStack(alignment: .leading, spacing: Slate.Space.s) {
                            ForEach(Array(question.workedSolution.enumerated()), id: \.offset) { i, line in
                                Text("\(i + 1). \(line)")
                                    .font(Slate.Typography.body)
                                    .foregroundStyle(Slate.Palette.ink)
                            }
                        }
                        .padding(.top, Slate.Space.s)
                    }
                    .font(Slate.Typography.footnote.weight(.medium))
                    .tint(Slate.Palette.tutor)
                }
            }

        case .finished:
            FinishedPanel(model: model)

        case .failed(let message):
            ProblemBanner(message: message) { Task { await model.start() } }
        }
    }

    @ViewBuilder
    private var footer: some View {
        HStack {
            Spacer()
            switch model.phase {
            case .learning:
                Button("Got it") { Task { await model.advance() } }
                    .buttonStyle(.borderedProminent).tint(Slate.Palette.tutor)
            case .answering:
                Button("Check") { Task { await model.submit() } }
                    .buttonStyle(.borderedProminent).tint(Slate.Palette.tutor)
                    .disabled(model.typedAnswer.isEmpty || model.isWorking)
            case .marked:
                Button("Next") { Task { await model.advance() } }
                    .buttonStyle(.borderedProminent).tint(Slate.Palette.tutor)
            case .finished, .preparing, .failed:
                EmptyView()
            }
        }
        .padding(Slate.Space.xl)
    }
}

/// The end of a session, reported honestly.
struct FinishedPanel: View {
    @ObservedObject var model: PracticeModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Slate.Space.l) {
            Text(model.headline)
                .font(Slate.Typography.title)
                .foregroundStyle(Slate.Palette.ink)

            if model.improved == true {
                Text("It will come back in \(days) to check it stuck. That is the part that turns a good session into something you still have next month.")
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            } else {
                // No consolation prize and no pretending. The next thing offered is a
                // different approach, because repeating the failed one is not an attempt.
                Text("The last question did not come out unaided, so nothing has been marked as learned. A different approach is usually the answer, not a longer version of the same one.")
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }

            HStack(spacing: Slate.Space.m) {
                if model.improved != true {
                    Button("Try a different approach") {
                        Task { await model.tryADifferentApproach() }
                    }
                    .buttonStyle(.borderedProminent).tint(Slate.Palette.tutor)
                }
                Button("Done") { dismiss() }
                    .buttonStyle(.plain)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }
        }
    }

    private var days: String {
        let value = model.plan.followUpDays
        if value < 1.5 { return "a day" }
        if value < 7 { return "\(Int(value.rounded())) days" }
        return "about \(Int((value / 7).rounded())) weeks"
    }
}
#endif
