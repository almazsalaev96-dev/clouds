#if canImport(SwiftUI) && canImport(PencilKit)
import SwiftUI
import SlateAI
import SlateDesign
import SlateDocuments
import SlateInk
import SlateModel

/// The workspace.
///
/// The page occupies the screen and the controls stay quiet at its edges. The tutor is
/// summoned to a place on the page and dismissed again; there is no permanent chat pane
/// competing with the worksheet for half the display.
public struct WorkspaceView: View {

    @ObservedObject var model: WorkspaceModel
    @ObservedObject var voice: VoiceController
    @StateObject private var tips = FirstRunTips()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pageSize: CGSize = .zero

    public init(model: WorkspaceModel, voice: VoiceController) {
        self.model = model
        self.voice = voice
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            Slate.Palette.paper.ignoresSafeArea()

            HStack(spacing: 0) {
                page
                if model.isTutorOpen && !model.isDistractionFree {
                    Divider().overlay(Slate.Palette.hairline)
                    TutorPanel(model: model, voice: voice)
                        .frame(width: Slate.Layout.tutorPanelWidth)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }

            if !model.isDistractionFree {
                InkToolbar(tool: $model.tool,
                           modes: model.contextualModes,
                           isThinking: model.isThinking,
                           onMode: { mode in Task { await model.ask(prompt(for: mode), mode: mode) } },
                           onTutor: { model.isTutorOpen.toggle() })
                    .padding(.bottom, Slate.Space.l)
            }
        }
        .overlay(alignment: .top) { notices }
        .animation(Slate.Motion.respectful(Slate.Motion.sheet, reduceMotion: reduceMotion),
                   value: model.isTutorOpen)
        .toolbar { toolbarContent }
        .onDisappear {
            model.flush()
            // Nothing should keep talking about a page the student has left.
            voice.stopIfSpeaking()
        }
    }

    private var page: some View {
        GeometryReader { proxy in
            ZStack {
                PDFPageView(documentURL: model.documentURL, page: model.page)
                    .background(Color.white)

                InkCanvas(
                    tool: $model.tool,
                    page: model.page,
                    initialDrawing: model.drawing(for: model.page),
                    onChange: { data in
                        model.inkChanged(data, page: model.page, pageSize: proxy.size)
                    },
                    // The one moment the tutor may speak unprompted: the pencil has
                    // been down and is now still. Even then it offers, it does not act.
                    onSettled: { tips.offer(.askTheTutor) }
                )
            }
            .onAppear {
                pageSize = proxy.size
                // On the page, the first time it is true, and never again.
                tips.offer(.writeAnywhere)
            }
            .onChange(of: proxy.size) { _, new in pageSize = new }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var notices: some View {
        VStack(spacing: Slate.Space.s) {
            if let notice = model.recoveryNotice {
                Banner(text: notice, tone: .reassuring) { model.dismissRecoveryNotice() }
            }
            if let problem = model.problem {
                Banner(text: problem, tone: .problem) { model.dismissProblem() }
            }
            if let tip = tips.showing {
                Banner(text: tip.text, tone: .reassuring) { tips.dismiss() }
            }
        }
        .padding(Slate.Space.l)
        .animation(Slate.Motion.respectful(Slate.Motion.standard, reduceMotion: reduceMotion),
                   value: model.problem)
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                model.toggleDistractionFree()
            } label: {
                Label(model.isDistractionFree ? "Show controls" : "Focus",
                      systemImage: model.isDistractionFree
                        ? "arrow.down.right.and.arrow.up.left"
                        : "arrow.up.left.and.arrow.down.right")
            }
        }
    }

    /// What tapping a mode actually asks. Written as a student would say it, so the
    /// conversation reads as one voice rather than as commands and replies.
    private func prompt(for mode: TutorReply.Mode) -> String {
        switch mode {
        case .nudge: "Point me at the bit to look at."
        case .hint: "Give me a hint."
        case .explain: "I do not understand this."
        case .steps: "Show me the steps."
        case .check: "Check this."
        case .solve: "Show me the full solution."
        case .teach: "Teach me this properly."
        case .simplify: "Explain that more simply."
        case .example: "Show me an example."
        case .quiz: "Ask me something on this."
        }
    }
}

/// The toolbar. Minimal by default; it grows only where the selection makes an action
/// obviously useful.
struct InkToolbar: View {
    @Binding var tool: InkTool
    let modes: [TutorReply.Mode]
    let isThinking: Bool
    let onMode: (TutorReply.Mode) -> Void
    let onTutor: () -> Void

    var body: some View {
        HStack(spacing: Slate.Space.s) {
            ForEach(InkTool.Kind.allCases) { kind in
                Button {
                    tool = InkTool.defaults[kind] ?? InkTool(kind: kind)
                } label: {
                    Image(systemName: kind.systemImage)
                        .imageScale(.medium)
                        .foregroundStyle(tool.kind == kind
                            ? Slate.Palette.tutor : Slate.Palette.inkSecondary)
                        .slateTapTarget()
                }
                .accessibilityLabel(kind.label)
                .accessibilityAddTraits(tool.kind == kind ? .isSelected : [])
            }

            Divider().frame(height: 22).overlay(Slate.Palette.hairline)

            ForEach(modes.prefix(3), id: \.self) { mode in
                Button(mode.label) { onMode(mode) }
                    .font(Slate.Typography.footnote.weight(.medium))
                    .buttonStyle(.plain)
                    .foregroundStyle(Slate.Palette.ink)
                    .padding(.horizontal, Slate.Space.s)
                    .slateTapTarget()
            }

            Button(action: onTutor) {
                HStack(spacing: Slate.Space.xs) {
                    if isThinking {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "sparkle")
                    }
                    Text("Tutor")
                }
                .font(Slate.Typography.footnote.weight(.medium))
                .padding(.horizontal, Slate.Space.m)
                .slateTapTarget()
            }
            .buttonStyle(.plain)
            .foregroundStyle(Slate.Palette.tutor)
            .accessibilityLabel(isThinking ? "Tutor, thinking" : "Tutor")
        }
        .padding(.horizontal, Slate.Space.m)
        .padding(.vertical, Slate.Space.xs)
        .slateSurface(raised: true, radius: Slate.Radius.large)
        .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
    }
}

struct Banner: View {
    enum Tone { case reassuring, problem }
    let text: String
    let tone: Tone
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: Slate.Space.m) {
            Image(systemName: tone == .reassuring ? "checkmark.circle" : "exclamationmark.circle")
                .foregroundStyle(tone == .reassuring ? Slate.Palette.correct : Slate.Palette.partial)
            Text(text)
                .font(Slate.Typography.caption)
                .foregroundStyle(Slate.Palette.ink)
            Spacer(minLength: Slate.Space.m)
            Button("Dismiss", action: dismiss)
                .font(Slate.Typography.footnote)
                .buttonStyle(.plain)
                .foregroundStyle(Slate.Palette.inkTertiary)
        }
        .padding(Slate.Space.m)
        .slateSurface(raised: true, radius: Slate.Radius.small)
        .frame(maxWidth: 520)
        .accessibilityElement(children: .combine)
    }
}
#endif
