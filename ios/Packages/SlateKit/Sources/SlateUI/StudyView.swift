#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation
import SlateLearning
import SlateModel

/// Study: what to revise, and how long you have.
///
/// The time control is the important part. "I have twenty minutes" produces a different
/// plan from "I have two hours", and neither pads to fill the time — if the highest
/// value work takes eleven minutes of a stated thirty, the plan is eleven minutes long.
public struct StudyView: View {

    @ObservedObject public var model: StudyModel

    public init(model: StudyModel) { self.model = model }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Slate.Space.xl) {
                timeControl

                if model.plan.isEmpty {
                    EmptyStateView(
                        icon: "checkmark.circle",
                        title: "Nothing needs you right now",
                        detail: "Nothing is due for review and no weak spots have shown up yet. Mark some work and this fills in."
                    )
                    .frame(minHeight: 260)
                } else {
                    session
                }

                if !model.needsReview.isEmpty {
                    VStack(alignment: .leading, spacing: Slate.Space.m) {
                        SectionHeader("Fading", trailing: "\(model.needsReview.count)")
                        Text("You knew these. Recall has dropped far enough that a couple of minutes each would bring them back.")
                            .font(Slate.Typography.footnote)
                            .foregroundStyle(Slate.Palette.inkSecondary)
                        ForEach(model.needsReview) { concept in
                            ConceptRow(concept: concept) { model.start(concept) }
                        }
                    }
                }

                if !model.weakest.isEmpty {
                    VStack(alignment: .leading, spacing: Slate.Space.m) {
                        SectionHeader("Where the marks are going")
                        ForEach(model.weakest) { concept in
                            ConceptRow(concept: concept) { model.start(concept) }
                        }
                    }
                }
            }
            .padding(Slate.Space.xl)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Slate.Palette.paper)
        .task { await model.refresh() }
        .refreshable { await model.refresh() }
    }

    private var timeControl: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            Text("How long have you got?")
                .font(Slate.Typography.heading)
                .foregroundStyle(Slate.Palette.ink)

            Picker("How long have you got?", selection: $model.availableMinutes) {
                ForEach(StudyModel.timeOptions, id: \.self) { minutes in
                    Text(minutes >= 60 ? "\(minutes / 60)h" : "\(minutes) min").tag(minutes)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: model.availableMinutes) { _, _ in
                Task { await model.refresh() }
            }
        }
    }

    private var session: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            SectionHeader("This session", trailing: model.planDescription)
            ForEach(Array(model.plan.enumerated()), id: \.offset) { _, item in
                SlateCard(action: { model.start(item) }) {
                    HStack(spacing: Slate.Space.m) {
                        VStack(alignment: .leading, spacing: Slate.Space.xs) {
                            Text(item.title)
                                .font(Slate.Typography.bodyEmphasis)
                                .foregroundStyle(Slate.Palette.ink)
                            Text(item.reason)
                                .font(Slate.Typography.footnote)
                                .foregroundStyle(Slate.Palette.inkSecondary)
                        }
                        Spacer(minLength: 0)
                        Text("\(Int(item.minutes)) min")
                            .font(Slate.Typography.footnote.monospacedDigit())
                            .foregroundStyle(Slate.Palette.inkTertiary)
                    }
                }
            }
            // Said plainly, because a plan shorter than the time offered looks like a
            // bug until someone explains that it is the point.
            if model.planMinutes < Double(model.availableMinutes) - 4 {
                Text("That is all that is worth doing right now. Filling the rest of the time would not help.")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
    }
}

struct ConceptRow: View {
    let concept: Projection.ConceptView
    let start: () -> Void

    var body: some View {
        SlateCard(action: start) {
            HStack(spacing: Slate.Space.m) {
                VStack(alignment: .leading, spacing: Slate.Space.xs) {
                    Text(concept.name)
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    MasteryBadge(state: concept.state, needsReview: concept.needsReview)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
    }
}

/// State for Study.
@MainActor
public final class StudyModel: ObservableObject {

    public static let timeOptions = [10, 20, 30, 60, 120]

    @Published public var availableMinutes = 20
    @Published public private(set) var plan: [NextAction.Recommendation] = []
    @Published public private(set) var needsReview: [Projection.ConceptView] = []
    @Published public private(set) var weakest: [Projection.ConceptView] = []
    @Published public private(set) var isLoading = false

    public var planMinutes: Double { plan.reduce(0) { $0 + $1.minutes } }

    public var planDescription: String {
        plan.isEmpty ? "" : "\(Int(planMinutes)) min"
    }

    public var onStart: ((ConceptID) -> Void)?

    private let events: EventStore
    private let concepts: [Concept]
    private let clock: Clock

    public init(events: EventStore, concepts: [Concept], clock: Clock = SystemClock()) {
        self.events = events
        self.concepts = concepts
        self.clock = clock
    }

    public func refresh() async {
        isLoading = true
        defer { isLoading = false }

        let attempts = (try? events.liveAttempts()) ?? []
        let projection = LearningEngine.project(
            attempts: attempts, concepts: concepts, assignments: [],
            context: .init(now: clock.now, availableMinutes: Double(availableMinutes))
        )
        plan = projection.plan
        // Faded but known: a recall problem, kept apart from genuine gaps because the
        // two need completely different sessions.
        needsReview = projection.concepts.filter(\.needsReview)
        weakest = projection.weakest.filter { $0.freshState < .reliable }.prefix(5).map { $0 }
    }

    public func start(_ recommendation: NextAction.Recommendation) {
        guard let concept = recommendation.conceptIDs.first else { return }
        onStart?(concept)
    }

    public func start(_ concept: Projection.ConceptView) {
        onStart?(concept.conceptID)
    }
}
#endif
