import SwiftUI
import PDFKit
import PencilKit

/// SwiftUI wrapper around `PDFStudyController`.
///
/// Kept thin on purpose. All the behaviour lives in the controller, because
/// PDFKit and PencilKit are UIKit components with lifecycles SwiftUI would
/// otherwise churn — recreating a `PDFView` on a state change would throw away
/// the scroll position and every live canvas.
struct PDFStudyView: UIViewControllerRepresentable {

    let pdf: PDFDocument
    let toolState: PencilToolState
    let initialPageIndex: Int
    let isRegionSelectionActive: Bool

    let drawingProvider: (Int) -> PKDrawing
    let onPageChange: (Int) -> Void
    let onDrawingChange: (PKDrawing, Int) -> Void
    let onRegionSelected: (CGRect, Int) -> Void
    let onTextSelected: (String?) -> Void
    /// Handed back so the reader can drive page jumps and read the undo manager.
    let onReady: (PDFStudyController) -> Void

    func makeUIViewController(context: Context) -> PDFStudyController {
        let controller = PDFStudyController(
            document: pdf,
            toolState: toolState,
            initialPageIndex: initialPageIndex
        )
        controller.delegate = context.coordinator
        controller.drawingProvider = drawingProvider
        controller.isRegionSelectionActive = isRegionSelectionActive
        // Deferred: `onReady` usually stores the controller in @State, and
        // mutating state during view construction is a runtime warning.
        DispatchQueue.main.async { onReady(controller) }
        return controller
    }

    func updateUIViewController(_ controller: PDFStudyController, context: Context) {
        context.coordinator.parent = self
        controller.drawingProvider = drawingProvider
        if controller.isRegionSelectionActive != isRegionSelectionActive {
            controller.isRegionSelectionActive = isRegionSelectionActive
        }
        // The tool object is shared and mutated in place, so this is what
        // actually propagates a pen change to every visible canvas.
        controller.refreshTools()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    @MainActor
    final class Coordinator: PDFStudyControllerDelegate {
        var parent: PDFStudyView

        init(parent: PDFStudyView) {
            self.parent = parent
        }

        func studyController(_ controller: PDFStudyController, didMoveToPage index: Int) {
            parent.onPageChange(index)
        }

        func studyController(_ controller: PDFStudyController, didChangeDrawing drawing: PKDrawing, onPage index: Int) {
            parent.onDrawingChange(drawing, index)
        }

        func studyController(_ controller: PDFStudyController, didSelectRegion rect: CGRect, onPage index: Int) {
            parent.onRegionSelected(rect, index)
        }

        func studyController(_ controller: PDFStudyController, didSelectText text: String?) {
            parent.onTextSelected(text)
        }
    }
}
