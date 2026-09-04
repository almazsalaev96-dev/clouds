#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation
import SlateLearning
import SlateModel

/// The mistake book.
///
/// Not a list of things you got wrong — that is a punishment, and students stop opening
/// it. It is a list of *patterns*, each one already turned into something to do about
/// it. A mistake leaves this screen when the evidence says it is fixed, not when the
/// student ticks it off.
public struct MistakesView: View {

    @ObservedObject public var model: MistakesModel

    public init(model: MistakesModel) { self.model = model }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Slate.Space.xl) {
                if model.patterns.isEmpty && model.resolved.isEmpty {
                    EmptyStateView(
                        icon: "books.vertical",
                        title: "No patterns yet",
                        detail: "When the same kind of mistake turns up more than once, it appears here with something to do about it."
                    )
                    .frame(minHeight: 300)
                }

                if !model.patterns.isEmpty {
                    VStack(alignment: .leading, spacing: Slate.Space.m) {
                        SectionHeader("Worth fixing", trailing: "\(model.patterns.count)")
                        ForEach(model.patterns) { pattern in
                            SlateCard {
                                VStack(alignment: .leading, spacing: Slate.Space.m) {
                                    Text(pattern.headline)
                                        .font(Slate.Typography.body)
                                        .foregroundStyle(Slate.Palette.ink)
                                    if let last = pattern.lastSeen {
                                        Text("Last seen \(model.describe(last))")
                                            .font(Slate.Typography.footnote)
                                            .foregroundStyle(Slate.Palette.inkTertiary)
                                    }
                                    Button("Fix this") { model.fix(pattern) }
                                        .font(Slate.Typography.footnote.weight(.medium))
                                        .buttonStyle(.plain)
                                        .foregroundStyle(Slate.Palette.tutor)
                                }
                            }
                        }
                    }
                }

                if !model.resolved.isEmpty {
                    VStack(alignment: .leading, spacing: Slate.Space.m) {
                        SectionHeader("Sorted", trailing: "\(model.resolved.count)")
                        // Kept, and quietly. Seeing what you used to get wrong and no
                        // longer do is the only progress metric in this product that is
                        // both true and worth looking at.
                        ForEach(model.resolved) { concept in
                            HStack(spacing: Slate.Space.m) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Slate.Palette.correct)
                                Text(concept.name)
                                    .font(Slate.Typography.body)
                                    .foregroundStyle(Slate.Palette.inkSecondary)
                                Spacer(minLength: 0)
                                MasteryBadge(state: concept.state)
                            }
                            .padding(.vertical, Slate.Space.xs)
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
    }
}

@MainActor
public final class MistakesModel: ObservableObject {

    @Published public private(set) var patterns: [Misconceptions.Pattern] = []
    @Published public private(set) var resolved: [Projection.ConceptView] = []

    public var onFix: ((ConceptID) -> Void)?

    private let events: EventStore
    private let concepts: [Concept]
    private let clock: Clock

    public init(events: EventStore, concepts: [Concept], clock: Clock = SystemClock()) {
        self.events = events
        self.concepts = concepts
        self.clock = clock
    }

    public func refresh() async {
        let attempts = (try? events.liveAttempts()) ?? []
        let projection = LearningEngine.project(
            attempts: attempts, concepts: concepts,
            context: .init(now: clock.now)
        )
        patterns = projection.patterns
        // A mistake is sorted when the evidence says so — reliable when fresh, and not
        // currently faded — never because someone ticked it off a list.
        resolved = projection.concepts.filter {
            $0.freshState >= .reliable && !$0.needsReview
        }
    }

    public func fix(_ pattern: Misconceptions.Pattern) {
        guard let concept = pattern.conceptIDs.first else { return }
        onFix?(concept)
    }

    public func describe(_ date: Date) -> String {
        let days = Int(clock.now.days(since: date))
        if days <= 0 { return "today" }
        if days == 1 { return "yesterday" }
        if days < 14 { return "\(days) days ago" }
        return "\(days / 7) weeks ago"
    }
}
#endif
