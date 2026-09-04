#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation
import SlateLearning
import SlateModel

/// The Desk: the answer to "what should I do next?", and almost nothing else.
///
/// Not a dashboard. A dashboard shows a student everything at once and leaves the
/// deciding to them, which is the part they find hardest at nine at night with four
/// subjects due. This screen makes one recommendation, explains it in a sentence, and
/// gets out of the way.
public struct DeskView: View {

    @ObservedObject public var model: DeskModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(model: DeskModel) { self.model = model }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Slate.Space.xl) {
                greeting

                if let next = model.nextAction {
                    NextActionCard(recommendation: next,
                                   onStart: { model.start(next) },
                                   onDismiss: { model.dismiss(next) })
                        .transition(.opacity)
                }

                if !model.continueItems.isEmpty {
                    section("Continue") {
                        ForEach(model.continueItems) { item in
                            ContinueRow(item: item) { model.open(item) }
                        }
                    }
                }

                if !model.dueSoon.isEmpty {
                    section("Due soon", trailing: "\(model.dueSoon.count)") {
                        ForEach(model.dueSoon) { item in
                            AssignmentRow(item: item) { model.openAssignment(item) }
                        }
                    }
                }

                if !model.recentPattern.isEmpty {
                    section("Worth a look") {
                        ForEach(model.recentPattern) { pattern in
                            PatternRow(pattern: pattern) { model.practise(pattern) }
                        }
                    }
                }

                if model.isEmpty {
                    EmptyStateView(
                        icon: "tray.and.arrow.down",
                        title: "Nothing here yet",
                        detail: "Bring in a worksheet, a past paper, or a photo of a page and start writing on it.",
                        actionLabel: "Add something",
                        action: model.importDocument
                    )
                    .frame(minHeight: 320)
                }
            }
            .padding(Slate.Space.xl)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Slate.Palette.paper)
        .animation(Slate.Motion.respectful(Slate.Motion.standard, reduceMotion: reduceMotion),
                   value: model.nextAction)
        .refreshable { await model.refresh() }
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: Slate.Space.xs) {
            Text(model.greeting)
                .font(Slate.Typography.display)
                .foregroundStyle(Slate.Palette.ink)
            if let subtitle = model.subtitle {
                Text(subtitle)
                    .font(Slate.Typography.caption)
                    .foregroundStyle(Slate.Palette.inkSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func section<Content: View>(_ title: String, trailing: String? = nil,
                                        @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            SectionHeader(title, trailing: trailing)
            content()
        }
    }
}

/// The single most useful next thing, with the reason it was chosen.
///
/// The reason is not decoration. A recommendation a student cannot check is a
/// recommendation they will eventually stop trusting, so the card always says what
/// evidence produced it and can always be waved away.
struct NextActionCard: View {
    let recommendation: NextAction.Recommendation
    let onStart: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        SlateCard {
            VStack(alignment: .leading, spacing: Slate.Space.m) {
                HStack(spacing: Slate.Space.s) {
                    Image(systemName: icon)
                        .foregroundStyle(Slate.Palette.tutor)
                    Text(recommendation.title)
                        .font(Slate.Typography.title)
                        .foregroundStyle(Slate.Palette.ink)
                    Spacer(minLength: 0)
                    Text("\(Int(recommendation.minutes)) min")
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }

                Text(recommendation.reason)
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.inkSecondary)

                HStack(spacing: Slate.Space.m) {
                    Button(actionLabel, action: onStart)
                        .buttonStyle(.borderedProminent)
                        .tint(Slate.Palette.tutor)
                    Button("Not now", action: onDismiss)
                        .buttonStyle(.plain)
                        .font(Slate.Typography.caption)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Suggested next: \(recommendation.title). \(recommendation.reason)")
    }

    private var icon: String {
        switch recommendation.kind {
        case .fixWeakness: "target"
        case .retrievalReview: "arrow.clockwise"
        case .transferProbe: "arrow.triangle.branch"
        case .finishAssignment: "doc.text"
        case .diagnostic: "questionmark.circle"
        case .rest: "cup.and.saucer"
        }
    }

    private var actionLabel: String {
        switch recommendation.kind {
        case .fixWeakness: "Start"
        case .retrievalReview: "Quick recall"
        case .transferProbe: "Try one"
        case .finishAssignment: "Continue"
        case .diagnostic: "Begin"
        case .rest: "Alright"
        }
    }
}

struct ContinueRow: View {
    let item: DeskModel.ContinueItem
    let open: () -> Void

    var body: some View {
        SlateCard(action: open) {
            HStack(spacing: Slate.Space.m) {
                VStack(alignment: .leading, spacing: Slate.Space.xs) {
                    Text(item.title)
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    Text(item.detail)
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkSecondary)
                }
                Spacer(minLength: 0)
                if let progress = item.progress {
                    Text("\(progress.done)/\(progress.total)")
                        .font(Slate.Typography.footnote.monospacedDigit())
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }
                Image(systemName: "chevron.right")
                    .font(.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
    }
}

struct AssignmentRow: View {
    let item: DeskModel.AssignmentItem
    let open: () -> Void

    var body: some View {
        SlateCard(action: open) {
            HStack(spacing: Slate.Space.m) {
                VStack(alignment: .leading, spacing: Slate.Space.xs) {
                    Text(item.title)
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    Text(item.dueDescription)
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(item.isUrgent
                            ? Slate.Palette.dueSoon : Slate.Palette.inkSecondary)
                }
                Spacer(minLength: 0)
                Text("\(item.remaining) left")
                    .font(Slate.Typography.footnote.monospacedDigit())
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
    }
}

struct PatternRow: View {
    let pattern: Misconceptions.Pattern
    let practise: () -> Void

    var body: some View {
        SlateCard {
            VStack(alignment: .leading, spacing: Slate.Space.s) {
                Text(pattern.headline)
                    .font(Slate.Typography.body)
                    .foregroundStyle(Slate.Palette.ink)
                Button("Practise this", action: practise)
                    .font(Slate.Typography.footnote.weight(.medium))
                    .buttonStyle(.plain)
                    .foregroundStyle(Slate.Palette.tutor)
            }
        }
    }
}
#endif
