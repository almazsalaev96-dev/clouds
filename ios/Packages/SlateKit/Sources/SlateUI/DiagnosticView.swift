#if canImport(SwiftUI)
import SwiftUI
import SlateAI
import SlateDesign
import SlateFoundation
import SlateModel

/// The diagnostic, on screen.
///
/// It never shows a score and never says how many questions are left, because neither
/// is knowable — it stops when it knows enough. What it does show, at the end, is how
/// sure it is and how much it actually learned, so "fairly sure" and "best guess" are
/// visibly different claims.
public struct DiagnosticView: View {

    @ObservedObject var model: DiagnosticModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var answerFocused: Bool

    public init(model: DiagnosticModel) { self.model = model }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Slate.Space.xl) {
                    content
                }
                .padding(Slate.Space.xl)
                .frame(maxWidth: Slate.Layout.readableWidth, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .background(Slate.Palette.paper)
            .navigationTitle("A few questions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Stop") { dismiss() }
                }
            }
            .task { await model.start() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .preparing:
            VStack(alignment: .leading, spacing: Slate.Space.m) {
                ProgressView()
                Text("Working out what would be most useful to ask.")
                    .font(Slate.Typography.caption)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }
            .frame(maxWidth: .infinity, minHeight: 200)

        case .asking(let question):
            VStack(alignment: .leading, spacing: Slate.Space.l) {
                // No "question 2 of 6". It stops when it knows enough, and pretending
                // to a fixed length would be a lie about how it works.
                Text(model.askedCount == 0 ? "First one" : "Next one")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)

                Text(question.prompt)
                    .font(Slate.Typography.title)
                    .foregroundStyle(Slate.Palette.ink)

                TextField("Your answer", text: $model.typedAnswer, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(Slate.Typography.mono)
                    .lineLimit(1...4)
                    .focused($answerFocused)
                    .padding(Slate.Space.m)
                    .slateSurface()
                    .onSubmit { Task { await model.submit() } }
                    .onAppear { answerFocused = true }

                HStack {
                    Spacer()
                    Button("Answer") { Task { await model.submit() } }
                        .buttonStyle(.borderedProminent)
                        .tint(Slate.Palette.tutor)
                        .disabled(model.typedAnswer.isEmpty || model.isWorking)
                }
            }

        case .finished(let conclusion):
            VStack(alignment: .leading, spacing: Slate.Space.l) {
                Text(model.confidenceWording(conclusion))
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)

                Text(conclusion.hypothesis.label)
                    .font(Slate.Typography.title)
                    .foregroundStyle(Slate.Palette.ink)

                Text(summary(conclusion))
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.inkSecondary)

                HStack(spacing: Slate.Space.m) {
                    Button("Fix this") { model.fix() }
                        .buttonStyle(.borderedProminent)
                        .tint(Slate.Palette.tutor)
                    Button("Not now") { dismiss() }
                        .buttonStyle(.plain)
                        .foregroundStyle(Slate.Palette.inkSecondary)
                }
            }

        case .inconclusive(let message):
            VStack(alignment: .leading, spacing: Slate.Space.m) {
                Text("Not conclusive")
                    .font(Slate.Typography.title)
                    .foregroundStyle(Slate.Palette.ink)
                // Saying so is the honest outcome. Naming the least unlikely of four
                // possibilities as the answer would be worse than useless.
                Text(message)
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.inkSecondary)
                Button("Alright") { dismiss() }
                    .buttonStyle(.bordered)
            }

        case .failed(let message):
            ProblemBanner(message: message) { Task { await model.start() } }
        }
    }

    private func summary(_ conclusion: DiagnosticModel.Conclusion) -> String {
        let questions = conclusion.questionsAsked
        let asked = "\(questions) question\(questions == 1 ? "" : "s")"
        if conclusion.bitsLearned >= 1.0 {
            return "That took \(asked). It is the most likely explanation for how your answers have been going wrong."
        }
        return "That took \(asked) and narrowed it down, though not as far as it could have. Worth treating as a lead rather than a diagnosis."
    }
}
#endif
