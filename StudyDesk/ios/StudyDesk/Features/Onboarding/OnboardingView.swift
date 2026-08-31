import SwiftUI

/// Four screens, then out of the way.
///
/// Onboarding earns its place only if it tells a student something they
/// wouldn't guess. "Tap to open a document" is not that. "You can circle any
/// part of the page and ask about it" is.
struct OnboardingView: View {

    let onFinish: () -> Void

    @State private var page = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let pages: [Page] = [
        Page(
            symbol: "sparkles",
            title: "A tutor that can see your worksheet",
            body: "Ask a question and it already knows which one you're on — the printed question, and what you've written underneath it."
        ),
        Page(
            symbol: "pencil.tip",
            title: "Write like it's paper",
            body: "Apple Pencil writes, your fingers scroll and zoom. Everything saves itself as you go."
        ),
        Page(
            symbol: "viewfinder",
            title: "Ask about any part of the page",
            body: "Drag a box around a diagram, an equation or a question and ask about just that."
        ),
        Page(
            symbol: "paperplane",
            title: "Finish and send it",
            body: "One tap turns your worksheet and handwriting into a clean PDF for your teacher. Your original is never changed."
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, content in
                    VStack(spacing: Theme.Space.xl) {
                        Spacer()
                        Image(systemName: content.symbol)
                            .font(.system(size: 56, weight: .light))
                            .foregroundStyle(Theme.Palette.tutor)
                        VStack(spacing: Theme.Space.m) {
                            Text(content.title)
                                .font(Theme.Text.display)
                                .multilineTextAlignment(.center)
                            Text(content.body)
                                .font(Theme.Text.body)
                                .foregroundStyle(Theme.Palette.textSecondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 420)
                        }
                        Spacer()
                    }
                    .padding(Theme.Space.xxl)
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            VStack(spacing: Theme.Space.m) {
                Button(page == pages.count - 1 ? "Start studying" : "Next") {
                    if page == pages.count - 1 {
                        onFinish()
                    } else {
                        withAnimation(Theme.Motion.respecting(Theme.Motion.panel, reduceMotion: reduceMotion)) {
                            page += 1
                        }
                    }
                }
                .buttonStyle(PrimaryButtonStyle(tint: Theme.Palette.tutor))

                if page < pages.count - 1 {
                    Button("Skip", action: onFinish)
                        .font(Theme.Text.label)
                        .foregroundStyle(Theme.Palette.textSecondary)
                }
            }
            .padding(.bottom, Theme.Space.xxl)
        }
        .background(Theme.Palette.background)
    }

    private struct Page {
        let symbol: String
        let title: String
        let body: String
    }
}

/// The three tips shown on the first worksheet a student opens, one at a time,
/// then never again.
struct ReaderTipsOverlay: View {

    @Binding var isPresented: Bool
    @State private var step = 0

    private let tips = [
        ("pencil.tip", "Write anywhere with Apple Pencil."),
        ("sparkles", "Stuck? Tap the tutor button."),
        ("viewfinder", "Drag a box around anything to ask about it.")
    ]

    var body: some View {
        if isPresented, step < tips.count {
            VStack {
                Spacer()
                HStack(spacing: Theme.Space.m) {
                    Image(systemName: tips[step].0)
                        .foregroundStyle(Theme.Palette.tutor)
                    Text(tips[step].1)
                        .font(Theme.Text.caption)
                    Spacer()
                    Button(step == tips.count - 1 ? "Got it" : "Next") {
                        withAnimation(Theme.Motion.fade) {
                            step += 1
                            if step >= tips.count { isPresented = false }
                        }
                    }
                    .font(Theme.Text.label.weight(.semibold))
                }
                .padding(Theme.Space.l)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous))
                .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
                .padding(Theme.Space.xl)
                .padding(.bottom, 80)
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}
