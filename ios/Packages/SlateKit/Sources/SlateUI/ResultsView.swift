#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation
import SlateLearning
import SlateModel

/// What the test meant.
///
/// The score is the least interesting thing on this screen and gets one line. Everything
/// below it answers the four questions a number cannot: what went wrong, why, what to
/// study, and what to do next. A results screen that stops at a percentage has measured
/// a student without telling them anything.
public struct ResultsView: View {

    let report: TestReport
    @ObservedObject var model: TestSessionModel
    public var onFix: ((ConceptID) -> Void)?

    public init(report: TestReport, model: TestSessionModel,
                onFix: ((ConceptID) -> Void)? = nil) {
        self.report = report
        self.model = model
        self.onFix = onFix
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Slate.Space.section) {
                score
                if let calibration = report.calibration { self.calibration(calibration) }
                topics
                questions
                nextStep
            }
            .padding(Slate.Space.xl)
            .frame(maxWidth: Slate.Layout.readableWidth, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }

    private var score: some View {
        VStack(alignment: .leading, spacing: Slate.Space.s) {
            HStack(alignment: .firstTextBaseline, spacing: Slate.Space.s) {
                Text("\(report.marksAwarded)")
                    .font(Slate.Typography.display.monospacedDigit())
                Text("/ \(report.marksAvailable)")
                    .font(Slate.Typography.title)
                    .foregroundStyle(Slate.Palette.inkTertiary)
                Spacer()
                Text(duration)
                    .font(Slate.Typography.footnote.monospacedDigit())
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
            .foregroundStyle(Slate.Palette.ink)

            // The one sentence a student cannot work out for themselves. It goes
            // directly under the number, because that is where their eye already is.
            Text(report.headline)
                .font(Slate.Typography.body)
                .foregroundStyle(Slate.Palette.inkSecondary)
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func calibration(_ calibration: TestReport.Calibration) -> some View {
        if !calibration.confidentlyWrong.isEmpty || calibration.verdict != .wellCalibrated {
            SlateCard {
                VStack(alignment: .leading, spacing: Slate.Space.s) {
                    Text(calibrationHeadline(calibration))
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    Text(calibrationDetail(calibration))
                        .font(Slate.Typography.caption)
                        .foregroundStyle(Slate.Palette.inkSecondary)
                }
            }
        }
    }

    private func calibrationHeadline(_ c: TestReport.Calibration) -> String {
        if !c.confidentlyWrong.isEmpty {
            let n = c.confidentlyWrong.count
            return "You were sure about \(n) \(n == 1 ? "answer" : "answers") that did not work out."
        }
        return c.verdict == .underconfident
            ? "You did better than you expected."
            : "You expected to do better than you did."
    }

    private func calibrationDetail(_ c: TestReport.Calibration) -> String {
        if !c.confidentlyWrong.isEmpty {
            // The whole reason confidence is collected. Being sure and wrong is a
            // different problem from not knowing, and it needs a different fix.
            return "Being confident and wrong usually means something you believe is not quite true, rather than something you have not met. Those are worth going back to first."
        }
        return c.verdict == .underconfident
            ? "Worth noticing before an exam: second-guessing costs marks on questions you can actually do."
            : "Nothing alarming — but the gap is worth watching."
    }

    private var topics: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            SectionHeader("By topic")
            ForEach(report.byConcept) { breakdown in
                HStack(spacing: Slate.Space.m) {
                    Text(breakdown.name)
                        .font(Slate.Typography.body)
                        .foregroundStyle(Slate.Palette.ink)
                    Spacer(minLength: Slate.Space.m)
                    Capsule()
                        .fill(Slate.Palette.hairline)
                        .frame(width: 90, height: 5)
                        .overlay(alignment: .leading) {
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(tint(for: breakdown.percentage))
                                    .frame(width: proxy.size.width * breakdown.percentage / 100)
                            }
                        }
                    Text("\(Int(breakdown.percentage))%")
                        .font(Slate.Typography.footnote.monospacedDigit())
                        .foregroundStyle(Slate.Palette.inkSecondary)
                        .frame(width: 44, alignment: .trailing)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(breakdown.name), \(Int(breakdown.percentage)) percent")
            }
        }
    }

    private var questions: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            SectionHeader("Question by question")
            ForEach(model.items) { item in
                SlateCard {
                    VStack(alignment: .leading, spacing: Slate.Space.s) {
                        HStack(spacing: Slate.Space.s) {
                            if let outcome = item.outcome {
                                VerdictChip(outcome: outcome, isCertain: true)
                            }
                            Spacer(minLength: 0)
                            if item.secondsSpent > 0 {
                                Text("\(Int(item.secondsSpent))s")
                                    .font(Slate.Typography.footnote.monospacedDigit())
                                    .foregroundStyle(Slate.Palette.inkTertiary)
                            }
                        }
                        Text(item.question.prompt)
                            .font(Slate.Typography.body)
                            .foregroundStyle(Slate.Palette.ink)
                        if item.isAnswered {
                            Text("You wrote: \(item.answer)")
                                .font(Slate.Typography.mono)
                                .foregroundStyle(Slate.Palette.inkSecondary)
                        } else {
                            Text("Left blank")
                                .font(Slate.Typography.footnote)
                                .foregroundStyle(Slate.Palette.inkTertiary)
                        }
                        if let error = item.errorType, item.outcome != .correct {
                            Text(error.studentFacingName.capitalisedFirst)
                                .font(Slate.Typography.footnote)
                                .foregroundStyle(Slate.Palette.inkTertiary)
                        }
                        if item.outcome != .correct {
                            DisclosureGroup("How it should go") {
                                VStack(alignment: .leading, spacing: Slate.Space.xs) {
                                    ForEach(Array(item.question.workedSolution.enumerated()),
                                            id: \.offset) { position, line in
                                        Text("\(position + 1). \(line)")
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
                }
            }
        }
    }

    @ViewBuilder
    private var nextStep: some View {
        // The rule the whole assessment layer exists to satisfy: a test that changes
        // nothing about what happens next is only a number.
        if let step = report.nextStep {
            SlateCard {
                VStack(alignment: .leading, spacing: Slate.Space.m) {
                    Text("What to do about it")
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                    Text(step.title)
                        .font(Slate.Typography.title)
                        .foregroundStyle(Slate.Palette.ink)
                    Text(step.reason)
                        .font(Slate.Typography.body)
                        .foregroundStyle(Slate.Palette.inkSecondary)
                    HStack(spacing: Slate.Space.m) {
                        Button("Start · \(Int(step.minutes)) min") {
                            if let concept = step.conceptIDs.first { onFix?(concept) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Slate.Palette.tutor)
                        .disabled(step.conceptIDs.isEmpty)
                        Text("It will come back in a few days to check it stuck.")
                            .font(Slate.Typography.footnote)
                            .foregroundStyle(Slate.Palette.inkTertiary)
                    }
                }
            }
        } else if report.weaknesses.isEmpty {
            Text("Nothing here needs fixing. Come back to these topics in a week or so and see if they have held.")
                .font(Slate.Typography.body)
                .foregroundStyle(Slate.Palette.inkSecondary)
        }
    }

    private var duration: String {
        let minutes = Int(report.seconds / 60)
        return minutes < 1 ? "under a minute" : "\(minutes) min"
    }

    private func tint(for percentage: Double) -> Color {
        if percentage >= 80 { return Slate.Palette.correct }
        if percentage >= 60 { return Slate.Palette.partial }
        return Slate.Palette.incorrect
    }
}
#endif
