#if canImport(SwiftUI)
import SwiftUI
import SlateAI
import SlateDesign
import SlateFoundation
import SlateLearning
import SlateModel

/// Sitting a test, and reading what it meant.
///
/// The sitting half is deliberately bare: question, answer box, navigation, and a timer
/// only if one was set. No tutor, no hints, no mastery badges — everything that helps
/// during practice is noise here, and some of it would invalidate the result.
public struct TestSessionView: View {

    @ObservedObject var model: TestSessionModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var answerFocused: Bool

    /// Where "start fixing this" goes. Supplied by the caller so the results screen
    /// does not have to know how a practice session is presented.
    let onFix: ((ConceptID) -> Void)?

    public init(model: TestSessionModel, onFix: ((ConceptID) -> Void)? = nil) {
        self.model = model
        self.onFix = onFix
    }

    public var body: some View {
        NavigationStack {
            Group {
                switch model.stage {
                case .loading:
                    ProgressView("Preparing").frame(maxWidth: .infinity, maxHeight: .infinity)
                case .sitting:
                    sitting
                case .marking(let done, let total):
                    VStack(spacing: Slate.Space.m) {
                        ProgressView(value: Double(done), total: Double(total))
                            .frame(maxWidth: 240)
                        Text("Marking \(done) of \(total)")
                            .font(Slate.Typography.caption)
                            .foregroundStyle(Slate.Palette.inkSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .results:
                    if let report = model.report {
                        ResultsView(report: report, model: model, onFix: onFix)
                    }
                case .failed(let message):
                    ProblemBanner(message: message) { Task { await model.start() } }
                        .padding(Slate.Space.xl)
                }
            }
            .background(Slate.Palette.paper)
            .navigationTitle(model.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .onDisappear { model.stop() }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button(model.stage == .results ? "Done" : "Leave") { dismiss() }
        }
        if case .sitting = model.stage {
            ToolbarItem(placement: .principal) {
                if let remaining = model.remainingTime {
                    Text(format(remaining))
                        .font(Slate.Typography.footnote.monospacedDigit())
                        // Amber under two minutes, never red: a colour that reads as an
                        // emergency makes people rush the questions they could still get.
                        .foregroundStyle(remaining < 120
                            ? Slate.Palette.dueSoon : Slate.Palette.inkSecondary)
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Finish") { Task { await model.submit() } }
                    .disabled(model.answeredCount == 0)
            }
        }
    }

    private var sitting: some View {
        VStack(alignment: .leading, spacing: 0) {
            progressStrip
            ScrollView {
                VStack(alignment: .leading, spacing: Slate.Space.xl) {
                    if let item = model.current {
                        Text("Question \(model.index + 1) of \(model.items.count)")
                            .font(Slate.Typography.footnote)
                            .foregroundStyle(Slate.Palette.inkTertiary)

                        Text(item.question.prompt)
                            .font(Slate.Typography.title)
                            .foregroundStyle(Slate.Palette.ink)
                            .textSelection(.enabled)

                        TextField("Your answer", text: Binding(
                            get: { item.answer },
                            set: { model.setAnswer($0) }
                        ), axis: .vertical)
                            .textFieldStyle(.plain)
                            .font(Slate.Typography.mono)
                            .lineLimit(1...6)
                            .focused($answerFocused)
                            .padding(Slate.Space.m)
                            .slateSurface()

                        if item.isAnswered {
                            ConfidencePicker(
                                value: item.confidence,
                                set: { model.setConfidence($0) }
                            )
                        }
                    }
                }
                .padding(Slate.Space.xl)
                .frame(maxWidth: Slate.Layout.readableWidth, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            navigation
        }
        .onAppear { answerFocused = true }
    }

    private var progressStrip: some View {
        HStack(spacing: Slate.Space.xs) {
            ForEach(Array(model.items.enumerated()), id: \.element.id) { position, item in
                Button { model.go(to: position) } label: {
                    Capsule()
                        .fill(colour(for: item, at: position))
                        .frame(height: 4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Question \(position + 1), \(item.isAnswered ? "answered" : "not answered")")
            }
        }
        .padding(.horizontal, Slate.Space.xl)
        .padding(.vertical, Slate.Space.m)
    }

    private func colour(for item: TestSessionModel.Item, at position: Int) -> Color {
        if position == model.index { return Slate.Palette.tutor }
        if item.isFlagged { return Slate.Palette.partial }
        return item.isAnswered ? Slate.Palette.inkTertiary : Slate.Palette.hairline
    }

    private var navigation: some View {
        HStack {
            Button("Back") { model.previous() }
                .disabled(model.index == 0)
            Spacer()
            Button {
                model.toggleFlag()
            } label: {
                Label("Come back to this",
                      systemImage: model.current?.isFlagged == true ? "flag.fill" : "flag")
                    .labelStyle(.iconOnly)
            }
            Spacer()
            Button("Next") { model.next() }
                .disabled(model.index >= model.items.count - 1)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Slate.Palette.tutor)
        .padding(Slate.Space.xl)
    }

    private func format(_ interval: TimeInterval) -> String {
        let total = Int(interval.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// Asked after the answer, never before.
///
/// Three options, not a slider: a student asked to place their confidence to two
/// decimal places will stop answering honestly, and three buckets carry all the signal
/// the calibration analysis needs.
struct ConfidencePicker: View {
    let value: Double?
    let set: (Double) -> Void

    private let options: [(label: String, value: Double)] = [
        ("Guessing", 0.2), ("Fairly sure", 0.6), ("Confident", 0.9),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Slate.Space.s) {
            Text("How sure are you?")
                .font(Slate.Typography.footnote)
                .foregroundStyle(Slate.Palette.inkTertiary)
            HStack(spacing: Slate.Space.s) {
                ForEach(options, id: \.value) { option in
                    Button(option.label) { set(option.value) }
                        .font(Slate.Typography.footnote.weight(.medium))
                        .buttonStyle(.plain)
                        .padding(.horizontal, Slate.Space.m)
                        .padding(.vertical, Slate.Space.s)
                        .foregroundStyle(value == option.value
                            ? Slate.Palette.tutor : Slate.Palette.inkSecondary)
                        .background(
                            Capsule().fill(value == option.value
                                ? Slate.Palette.tutor.opacity(0.12) : .clear)
                        )
                        .overlay(Capsule().strokeBorder(Slate.Palette.hairline))
                        .accessibilityAddTraits(value == option.value ? .isSelected : [])
                }
            }
        }
    }
}
#endif
