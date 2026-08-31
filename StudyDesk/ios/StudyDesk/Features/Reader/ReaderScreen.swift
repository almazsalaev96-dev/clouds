import SwiftUI
import SwiftData
import PDFKit
import PencilKit

/// The study view.
///
/// Layout priority, top to bottom:
/// 1. the page — it gets the whole screen and nothing overlaps it permanently
/// 2. the Pencil toolbar — floating, movable, out of the way
/// 3. the tutor — a small button until asked for, then a panel that can be
///    dragged anywhere and never covers the page it is talking about
///
/// If any of those three ever fight, the page wins.
struct ReaderScreen: View {

    let document: StudyDocument

    @Environment(AppEnvironment.self) private var app
    @Environment(AppSettings.self) private var settings
    @Environment(PencilToolState.self) private var toolState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var model: ReaderModel?
    @State private var toast: Toast?
    @State private var showsTips = false

    var body: some View {
        Group {
            if let model {
                content(model)
            } else {
                loading
            }
        }
        .background(Theme.Palette.background)
        .task { await prepare() }
        .onDisappear { model?.close() }
        .toast($toast)
    }

    private var loading: some View {
        VStack(spacing: Theme.Space.l) {
            ProgressView()
            Text("Opening \(document.title)…")
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func content(_ model: ReaderModel) -> some View {
        @Bindable var model = model

        ZStack(alignment: .topLeading) {
            PDFStudyView(
                pdf: model.pdf,
                toolState: toolState,
                initialPageIndex: document.lastPageIndex,
                isRegionSelectionActive: model.isSelectingRegion,
                drawingProvider: { model.drawings.drawing(forPage: $0) },
                onPageChange: { model.pageChanged(to: $0) },
                onDrawingChange: { drawing, page in model.drawingChanged(drawing, page: page) },
                onRegionSelected: { rect, page in model.regionSelected(rect, page: page) },
                onTextSelected: { model.selectedText = $0 },
                onReady: { model.attach(controller: $0) }
            )
            .ignoresSafeArea(edges: .bottom)

            ReaderTopBar(
                title: document.title,
                pageIndex: model.pageIndex,
                pageCount: model.pdf.pageCount,
                isExamMode: $model.examMode,
                showsThumbnails: $model.showsThumbnails,
                onClose: { close(model) },
                onFinish: { model.isFinishing = true },
                onUndo: { model.undo() },
                onRedo: { model.redo() },
                canUndo: model.canUndo,
                canRedo: model.canRedo
            )

            if model.showsThumbnails {
                ThumbnailStrip(
                    pdf: model.pdf,
                    currentPage: model.pageIndex,
                    hasInk: { model.drawings.drawing(forPage: $0).strokes.isEmpty == false },
                    onSelect: { model.go(to: $0) }
                )
                .transition(.move(edge: .leading).combined(with: .opacity))
            }

            PencilToolbar(
                toolState: toolState,
                onSelectRegion: { model.beginRegionSelection() },
                isRegionSelecting: model.isSelectingRegion
            )

            TutorLayer(model: model)

            ReaderTipsOverlay(isPresented: $showsTips)
        }
        .animation(Theme.Motion.respecting(Theme.Motion.panel, reduceMotion: reduceMotion), value: model.showsThumbnails)
        .sheet(isPresented: $model.isFinishing) {
            FinishAssignmentView(document: document, drawings: model.currentDrawings())
        }
        .onReceive(NotificationCenter.default.publisher(for: .studyDeskShouldFlush)) { _ in
            model.flush()
        }
        .onReceive(NotificationCenter.default.publisher(for: .studyDeskCommand)) { note in
            switch note.object as? StudyCommand {
            case .toggleTutor: model.tutorPresentation.toggle()
            case .askAboutSelection: model.askAboutSelection()
            case .nextPage: model.go(to: model.pageIndex + 1)
            case .previousPage: model.go(to: model.pageIndex - 1)
            default: break
            }
        }
    }

    // MARK: Lifecycle

    private func prepare() async {
        guard model == nil else { return }
        guard let pdf = app.store.loadPDF(document.storageName) else {
            toast = Toast(kind: .warning, message: "That worksheet couldn't be opened.")
            return
        }
        model = ReaderModel(
            document: document,
            pdf: pdf,
            app: app,
            settings: settings,
            modelContext: modelContext
        )

        // The three first-worksheet tips, once ever.
        if !settings.hasSeenReaderTips {
            showsTips = true
            settings.hasSeenReaderTips = true
        }
    }

    private func close(_ model: ReaderModel) {
        model.close()
        dismiss()
    }
}
