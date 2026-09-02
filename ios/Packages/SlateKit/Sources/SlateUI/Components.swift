#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateModel

/// Shared pieces. Small, quiet, and reused everywhere so the product reads as one
/// thing rather than as a set of screens built in different weeks.

/// The one card style.
public struct SlateCard<Content: View>: View {
    private let content: Content
    private let action: (() -> Void)?

    public init(action: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.content = content()
        self.action = action
    }

    public var body: some View {
        Group {
            if let action {
                Button(action: action) { inner }.buttonStyle(.plain)
            } else {
                inner
            }
        }
    }

    private var inner: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Slate.Space.l)
            .slateSurface()
    }
}

/// An empty state that tells the student what to do, not that something is missing.
public struct EmptyStateView: View {
    let icon: String
    let title: String
    let detail: String
    let actionLabel: String?
    let action: (() -> Void)?

    public init(icon: String, title: String, detail: String,
                actionLabel: String? = nil, action: (() -> Void)? = nil) {
        self.icon = icon; self.title = title; self.detail = detail
        self.actionLabel = actionLabel; self.action = action
    }

    public var body: some View {
        VStack(spacing: Slate.Space.m) {
            Image(systemName: icon)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Slate.Palette.inkTertiary)
            Text(title)
                .font(Slate.Typography.heading)
                .foregroundStyle(Slate.Palette.ink)
            Text(detail)
                .font(Slate.Typography.caption)
                .foregroundStyle(Slate.Palette.inkSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
            if let actionLabel, let action {
                Button(actionLabel, action: action)
                    .buttonStyle(.borderedProminent)
                    .tint(Slate.Palette.tutor)
                    .padding(.top, Slate.Space.xs)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Slate.Space.xl)
        .accessibilityElement(children: .combine)
    }
}

/// Mastery, shown as a word and a short bar rather than a percentage.
///
/// A percentage invites a student to optimise the number. A phrase like "you can do
/// this on your own" describes what they can actually do, which is the thing worth
/// knowing.
public struct MasteryBadge: View {
    let state: MasteryState
    let needsReview: Bool

    public init(state: MasteryState, needsReview: Bool = false) {
        self.state = state
        self.needsReview = needsReview
    }

    public var body: some View {
        HStack(spacing: Slate.Space.s) {
            Capsule()
                .fill(tint.opacity(0.22))
                .overlay(alignment: .leading) {
                    GeometryReader { proxy in
                        Capsule().fill(tint)
                            .frame(width: proxy.size.width * fraction)
                    }
                }
                .frame(width: 44, height: 5)
            Text(needsReview ? "Needs a refresh" : state.studentFacingLabel)
                .font(Slate.Typography.footnote)
                .foregroundStyle(Slate.Palette.inkSecondary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(needsReview
            ? "\(state.studentFacingLabel), needs a refresh"
            : state.studentFacingLabel)
    }

    private var fraction: Double {
        Double(state.rank) / Double(MasteryState.mastered.rank)
    }

    private var tint: Color {
        switch state {
        case .unseen, .introduced: Slate.Palette.inkTertiary
        case .practicing, .developing: Slate.Palette.partial
        case .reliable, .transferable, .mastered: Slate.Palette.correct
        }
    }
}

/// A verdict, stated plainly, with the source of the judgement made explicit.
public struct VerdictChip: View {
    let outcome: Outcome
    /// True when arithmetic settled it rather than a model's opinion. Shown, because it
    /// changes whether a student should argue with the result.
    let isCertain: Bool

    public init(outcome: Outcome, isCertain: Bool) {
        self.outcome = outcome
        self.isCertain = isCertain
    }

    public var body: some View {
        HStack(spacing: Slate.Space.xs) {
            Image(systemName: symbol).imageScale(.small)
            Text(label).font(Slate.Typography.footnote.weight(.medium))
            if !isCertain {
                Text("· not certain")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
        .padding(.horizontal, Slate.Space.s)
        .padding(.vertical, Slate.Space.xs)
        .foregroundStyle(tint)
        .background(tint.opacity(0.12), in: Capsule())
        .accessibilityLabel(isCertain ? label : "\(label), not certain")
    }

    private var label: String {
        switch outcome {
        case .correct: "Correct"
        case .partial: "Nearly"
        case .incorrect: "Not yet"
        }
    }

    private var symbol: String {
        switch outcome {
        case .correct: "checkmark"
        case .partial: "minus"
        case .incorrect: "arrow.uturn.backward"
        }
    }

    private var tint: Color {
        switch outcome {
        case .correct: Slate.Palette.correct
        case .partial: Slate.Palette.partial
        case .incorrect: Slate.Palette.incorrect
        }
    }
}

/// A failure, worded for a student, with the reassurance that matters most.
public struct ProblemBanner: View {
    let message: String
    let retry: (() -> Void)?

    public init(message: String, retry: (() -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Slate.Space.m) {
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(Slate.Palette.partial)
            VStack(alignment: .leading, spacing: Slate.Space.xs) {
                Text(message)
                    .font(Slate.Typography.caption)
                    .foregroundStyle(Slate.Palette.ink)
                if let retry {
                    Button("Try again", action: retry)
                        .font(Slate.Typography.footnote.weight(.medium))
                        .buttonStyle(.plain)
                        .foregroundStyle(Slate.Palette.tutor)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(Slate.Space.m)
        .slateSurface(raised: true, radius: Slate.Radius.small)
        .accessibilityElement(children: .combine)
    }
}

/// A small, quiet section header.
public struct SectionHeader: View {
    let title: String
    let trailing: String?

    public init(_ title: String, trailing: String? = nil) {
        self.title = title
        self.trailing = trailing
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(Slate.Typography.heading)
                .foregroundStyle(Slate.Palette.ink)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
        .accessibilityAddTraits(.isHeader)
    }
}
#endif
