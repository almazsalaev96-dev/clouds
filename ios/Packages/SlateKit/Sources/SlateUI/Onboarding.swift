#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation

/// Four screens, then out of the way.
///
/// Onboarding is a tax on someone who came here to do their homework, so it says the
/// four things they could not work out alone and stops. No account, no permissions
/// request, no survey about their goals, and no tour of a product they have not seen
/// yet — the three things worth pointing at are pointed at later, on the page, at the
/// moment they matter.
public struct OnboardingView: View {

    @State private var page = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let finish: () -> Void

    public init(finish: @escaping () -> Void) { self.finish = finish }

    private struct Panel {
        let icon: String
        let title: String
        let body: String
    }

    private let panels: [Panel] = [
        Panel(icon: "doc.text",
              title: "Bring your work in",
              body: "Worksheets, past papers, notes, or a photo of a page. You can start writing on it straight away — nothing has to finish loading first."),
        Panel(icon: "pencil.tip",
              title: "Write on it with the Pencil",
              body: "It saves as you go. If the app ever closes on you, your writing will be there when you come back."),
        Panel(icon: "sparkle",
              title: "The tutor can see the page",
              body: "Ask about anything without explaining what you mean. It knows which question you are on and what you have written under it."),
        Panel(icon: "paperplane",
              title: "Finish and send",
              body: "Check it over, export a clean PDF with your handwriting on it, and send it however your school expects."),
    ]

    public var body: some View {
        VStack(spacing: Slate.Space.xl) {
            Spacer(minLength: 0)

            TabView(selection: $page) {
                ForEach(Array(panels.enumerated()), id: \.offset) { index, panel in
                    VStack(spacing: Slate.Space.l) {
                        Image(systemName: panel.icon)
                            .font(.system(size: 46, weight: .light))
                            .foregroundStyle(Slate.Palette.tutor)
                        Text(panel.title)
                            .font(Slate.Typography.display)
                            .foregroundStyle(Slate.Palette.ink)
                            .multilineTextAlignment(.center)
                        Text(panel.body)
                            .font(Slate.Typography.body)
                            .foregroundStyle(Slate.Palette.inkSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 420)
                    }
                    .padding(.horizontal, Slate.Space.xl)
                    .tag(index)
                    .accessibilityElement(children: .combine)
                }
            }
            .tabViewStyle(.page)
            .frame(maxHeight: 420)

            Spacer(minLength: 0)

            VStack(spacing: Slate.Space.m) {
                Button(page == panels.count - 1 ? "Start studying" : "Next") {
                    withAnimation(Slate.Motion.respectful(Slate.Motion.standard,
                                                          reduceMotion: reduceMotion)) {
                        if page == panels.count - 1 { finish() } else { page += 1 }
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Slate.Palette.tutor)
                .controlSize(.large)

                // Always available. Someone who wants to get on with it should not have
                // to tap through four screens to be allowed to.
                if page < panels.count - 1 {
                    Button("Skip", action: finish)
                        .buttonStyle(.plain)
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }
            }
            .padding(.bottom, Slate.Space.section)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Slate.Palette.paper)
    }
}

/// The three tips, shown once, on the page, at the moment each becomes true.
///
/// Not a tour. A tour teaches someone a product they have not used; these appear over
/// the student's own worksheet the first time each thing is possible, and never again.
@MainActor
public final class FirstRunTips: ObservableObject {

    public enum Tip: String, CaseIterable, Identifiable {
        case writeAnywhere, askTheTutor, selectToAsk
        public var id: String { rawValue }

        var text: String {
            switch self {
            case .writeAnywhere: "Write anywhere on the page. It saves as you go."
            case .askTheTutor: "Stuck? Tap Tutor. It can already see this question."
            case .selectToAsk: "Select anything on the page to ask about just that."
            }
        }
    }

    @Published public private(set) var showing: Tip?

    private let defaults: UserDefaults
    private static let key = "com.slate.tipsSeen"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private var seen: Set<String> {
        get { Set(defaults.stringArray(forKey: Self.key) ?? []) }
        set { defaults.set(Array(newValue).sorted(), forKey: Self.key) }
    }

    public func offer(_ tip: Tip) {
        guard !seen.contains(tip.rawValue), showing == nil else { return }
        showing = tip
    }

    /// Dismissal is permanent. A tip that comes back is not a tip, it is an
    /// interruption with a schedule.
    public func dismiss() {
        guard let tip = showing else { return }
        seen.insert(tip.rawValue)
        showing = nil
    }

    public var allSeen: Bool { seen.count >= Tip.allCases.count }

    public func reset() {
        defaults.removeObject(forKey: Self.key)
        showing = nil
    }
}

/// Whether onboarding has been done. One flag, one place.
public struct OnboardingState {
    private static let key = "com.slate.onboardingComplete"

    public static func isComplete(_ defaults: UserDefaults = .standard) -> Bool {
        defaults.bool(forKey: key)
    }

    public static func markComplete(_ defaults: UserDefaults = .standard) {
        defaults.set(true, forKey: key)
    }

    public static func reset(_ defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: key)
    }
}
#endif
