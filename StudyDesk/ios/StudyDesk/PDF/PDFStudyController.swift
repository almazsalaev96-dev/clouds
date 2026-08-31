import UIKit
import PDFKit
import PencilKit

@MainActor
protocol PDFStudyControllerDelegate: AnyObject {
    /// The visible page changed. Index is 0-based.
    func studyController(_ controller: PDFStudyController, didMoveToPage index: Int)
    /// Ink on a page changed. Called on every stroke — the receiver is expected
    /// to debounce before writing to disk.
    func studyController(_ controller: PDFStudyController, didChangeDrawing drawing: PKDrawing, onPage index: Int)
    /// The student finished dragging out a region to ask about.
    func studyController(_ controller: PDFStudyController, didSelectRegion rect: CGRect, onPage index: Int)
    /// The student selected printed text.
    func studyController(_ controller: PDFStudyController, didSelectText text: String?)
}

/// Hosts the PDF and the ink that sits on it.
///
/// ## Why an overlay provider rather than a canvas on top of the whole view
///
/// PDFKit's `PDFPageOverlayViewProvider` hands each page a view positioned in
/// that page's own coordinate space. PDFKit keeps owning scrolling, zooming and
/// page layout; PencilKit keeps owning the stroke pipeline, which is where the
/// low latency comes from. Nothing in this file does coordinate maths during a
/// gesture, and that is deliberate: hand-rolled transforms are exactly what
/// makes ink drift away from the page when you pinch.
///
/// It also means a stroke is stored against a *page*, not against a screen
/// position — so it survives rotation, Split View, Stage Manager, and a
/// different iPad entirely.
final class PDFStudyController: UIViewController {

    // MARK: Public

    let pdfView = PDFView()
    weak var delegate: PDFStudyControllerDelegate?

    /// Supplies saved ink for a page. Called on the main thread when a page
    /// scrolls into view, so it must be fast — the repository keeps decoded
    /// drawings in memory for the pages around the current one.
    var drawingProvider: (Int) -> PKDrawing = { _ in PKDrawing() }

    var toolState: PencilToolState {
        didSet { applyToolToAllCanvases() }
    }

    /// When true, the next drag selects a region instead of drawing.
    var isRegionSelectionActive = false {
        didSet {
            regionSelector.isHidden = !isRegionSelectionActive
            regionSelector.isUserInteractionEnabled = isRegionSelectionActive
            applyToolToAllCanvases()
        }
    }

    private(set) var currentPageIndex = 0

    // MARK: Private

    private var canvases: [Int: PKCanvasView] = [:]
    private let regionSelector = RegionSelectionView()
    private var pencilInteraction: UIPencilInteraction?
    private var previousToolKind: PencilToolState.Kind?
    private var hasRestoredInitialPage = false
    private var initialPageIndex = 0

    init(document: PDFDocument, toolState: PencilToolState, initialPageIndex: Int) {
        self.toolState = toolState
        self.initialPageIndex = initialPageIndex
        super.init(nibName: nil, bundle: nil)
        pdfView.document = document
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        configurePDFView()
        configureRegionSelector()
        configurePencilInteraction()
        observeNotifications()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // The first layout is the earliest point at which PDFKit can honour a
        // page jump; doing it in viewDidLoad silently does nothing.
        if !hasRestoredInitialPage, let page = pdfView.document?.page(at: initialPageIndex) {
            pdfView.go(to: page)
            hasRestoredInitialPage = true
        }
    }

    private func configurePDFView() {
        pdfView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pdfView)
        NSLayoutConstraint.activate([
            pdfView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pdfView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pdfView.topAnchor.constraint(equalTo: view.topAnchor),
            pdfView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.autoScales = true
        pdfView.usePageViewController(false)
        pdfView.pageShadowsEnabled = true
        pdfView.backgroundColor = UIColor(Theme.Palette.background)
        // Ink and page must scale together, so the canvas has to be a page
        // overlay rather than a sibling view.
        pdfView.pageOverlayViewProvider = self
        pdfView.maxScaleFactor = 6
        pdfView.minScaleFactor = 0.25
    }

    private func configureRegionSelector() {
        regionSelector.translatesAutoresizingMaskIntoConstraints = false
        regionSelector.isHidden = true
        regionSelector.isUserInteractionEnabled = false
        regionSelector.onSelection = { [weak self] rect in
            self?.handleRegionSelection(rect)
        }
        regionSelector.onCancel = { [weak self] in
            self?.isRegionSelectionActive = false
        }
        view.addSubview(regionSelector)
        NSLayoutConstraint.activate([
            regionSelector.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            regionSelector.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            regionSelector.topAnchor.constraint(equalTo: view.topAnchor),
            regionSelector.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func configurePencilInteraction() {
        let interaction = UIPencilInteraction()
        interaction.delegate = self
        view.addInteraction(interaction)
        pencilInteraction = interaction
    }

    private func observeNotifications() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(pageChanged),
            name: .PDFViewPageChanged, object: pdfView
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(selectionChanged),
            name: .PDFViewSelectionChanged, object: pdfView
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(scaleChanged),
            name: .PDFViewScaleChanged, object: pdfView
        )
    }

    @objc private func pageChanged() {
        guard let page = pdfView.currentPage,
              let index = pdfView.document?.index(for: page) else { return }
        currentPageIndex = index
        delegate?.studyController(self, didMoveToPage: index)
    }

    @objc private func selectionChanged() {
        let text = pdfView.currentSelection?.string
        delegate?.studyController(self, didSelectText: text?.isEmpty == true ? nil : text)
    }

    @objc private func scaleChanged() {
        // PencilKit rasterises finished strokes; without this, ink laid down at
        // 1× looks soft once the student zooms in to check a fraction. Bumping
        // the canvas's scale factor makes it re-render at the new resolution.
        let scale = min(pdfView.scaleFactor, 4)
        for canvas in canvases.values {
            canvas.contentScaleFactor = UIScreen.main.scale * max(1, scale)
        }
    }

    // MARK: Navigation

    func go(toPage index: Int) {
        guard let page = pdfView.document?.page(at: index) else { return }
        pdfView.go(to: page)
    }

    var pageCount: Int { pdfView.document?.pageCount ?? 0 }

    // MARK: Ink

    /// The drawing currently on a page, live from the canvas if it is on
    /// screen, otherwise from the repository.
    func drawing(onPage index: Int) -> PKDrawing {
        canvases[index]?.drawing ?? drawingProvider(index)
    }

    /// Replaces a page's ink. Used by undo of a tutor suggestion and by revert.
    func setDrawing(_ drawing: PKDrawing, onPage index: Int) {
        canvases[index]?.drawing = drawing
    }

    /// The undo manager for the page being written on. PencilKit registers
    /// stroke undo with the canvas's own manager, so this is what ⌘Z must talk
    /// to — the view controller's own manager knows nothing about strokes.
    var activeUndoManager: UndoManager? {
        canvases[currentPageIndex]?.undoManager
    }

    private func applyToolToAllCanvases() {
        for canvas in canvases.values { apply(to: canvas) }
    }

    private func apply(to canvas: PKCanvasView) {
        canvas.tool = toolState.tool
        canvas.isRulerActive = toolState.rulerActive
        // While a region is being selected, ink must not land on the page.
        canvas.drawingPolicy = isRegionSelectionActive
            ? .pencilOnly
            : (toolState.pencilOnlyDrawing ? .pencilOnly : .anyInput)
        canvas.isUserInteractionEnabled = !isRegionSelectionActive
        canvas.drawingGestureRecognizer.isEnabled = !isRegionSelectionActive
    }

    /// `toolState` is a reference type, so mutating the selected pen does not
    /// trip `didSet`. SwiftUI calls this from `updateUIViewController` whenever
    /// the observable state changes.
    func refreshTools() {
        applyToolToAllCanvases()
    }

    // MARK: Region selection

    private func handleRegionSelection(_ rectInView: CGRect) {
        defer { isRegionSelectionActive = false }
        guard let page = pdfView.page(for: rectInView.origin, nearest: true),
              let index = pdfView.document?.index(for: page) else { return }

        // Convert the drag rectangle into the page's own space, then normalise
        // it, so the region means the same thing at any zoom or on any device.
        let bounds = page.bounds(for: .mediaBox)
        let topLeft = pdfView.convert(CGPoint(x: rectInView.minX, y: rectInView.minY), to: page)
        let bottomRight = pdfView.convert(CGPoint(x: rectInView.maxX, y: rectInView.maxY), to: page)

        // PDF page space has a bottom-left origin; the app speaks top-left.
        let minX = min(topLeft.x, bottomRight.x)
        let maxX = max(topLeft.x, bottomRight.x)
        let minY = min(topLeft.y, bottomRight.y)
        let maxY = max(topLeft.y, bottomRight.y)

        guard bounds.width > 0, bounds.height > 0 else { return }
        let normalised = CGRect(
            x: (minX - bounds.minX) / bounds.width,
            y: 1 - (maxY - bounds.minY) / bounds.height,
            width: (maxX - minX) / bounds.width,
            height: (maxY - minY) / bounds.height
        ).intersection(CGRect(x: 0, y: 0, width: 1, height: 1))

        guard normalised.width > 0.02, normalised.height > 0.01 else { return }
        delegate?.studyController(self, didSelectRegion: normalised, onPage: index)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - Page overlays

extension PDFStudyController: PDFPageOverlayViewProvider {

    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        guard let index = view.document?.index(for: page) else { return nil }

        if let existing = canvases[index] { return existing }

        let canvas = PKCanvasView()
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        // The canvas is a scroll view. Left scrollable, it fights PDFKit for
        // the pan gesture and the page stops moving under the student's finger.
        canvas.isScrollEnabled = false
        canvas.bounces = false
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1
        canvas.overrideUserInterfaceStyle = .light // keep ink colours true on a white page
        canvas.drawing = drawingProvider(index)
        canvas.delegate = self
        canvas.contentScaleFactor = UIScreen.main.scale * max(1, min(view.scaleFactor, 4))
        apply(to: canvas)

        canvases[index] = canvas
        return canvas
    }

    func pdfView(_ pdfView: PDFView, willDisplayOverlayView overlayView: UIView, for page: PDFPage) {
        guard let canvas = overlayView as? PKCanvasView,
              let index = pdfView.document?.index(for: page) else { return }
        // A page can be recycled while off screen; make sure it is showing the
        // right ink before it appears.
        let stored = drawingProvider(index)
        if canvas.drawing.strokes.isEmpty && !stored.strokes.isEmpty {
            canvas.drawing = stored
        }
        apply(to: canvas)
    }

    func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) {
        guard let canvas = overlayView as? PKCanvasView,
              let index = pdfView.document?.index(for: page) else { return }
        // Flush before the page goes away, so ink laid down on a page the
        // student immediately scrolls past is still saved.
        delegate?.studyController(self, didChangeDrawing: canvas.drawing, onPage: index)
        canvases.removeValue(forKey: index)
    }
}

// MARK: - Ink changes

extension PDFStudyController: PKCanvasViewDelegate {

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard let index = canvases.first(where: { $0.value === canvasView })?.key else { return }
        delegate?.studyController(self, didChangeDrawing: canvasView.drawing, onPage: index)
    }
}

// MARK: - Apple Pencil double tap

extension PDFStudyController: UIPencilInteractionDelegate {

    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        let preference = UIPencilInteraction.preferredTapAction
        toolState.handlePencilDoubleTap(preference: preference, previousKind: &previousToolKind)
        applyToolToAllCanvases()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
