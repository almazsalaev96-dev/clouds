#if canImport(SwiftUI) && canImport(PDFKit)
import PDFKit
import SwiftUI
import SlateDesign

/// The page itself.
///
/// `PDFView` handles paging, zoom and the large-document behaviour that a hand-rolled
/// renderer would take months to match. Everything else here exists to make it stop
/// looking like a PDF viewer: no shadows, no grey surround, no page-number chrome.
public struct PDFPageView: UIViewRepresentable {

    let documentURL: URL?
    let page: Int

    public init(documentURL: URL?, page: Int) {
        self.documentURL = documentURL
        self.page = page
    }

    public func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePage
        view.displayDirection = .horizontal
        view.pageShadowsEnabled = false
        view.backgroundColor = .clear
        // Writing must stay smooth on a five-hundred-page paper, so pages are drawn
        // one at a time rather than composited into a continuous scroll.
        view.usePageViewController(false)
        view.interpolationQuality = .high
        if let documentURL { view.document = PDFDocument(url: documentURL) }
        return view
    }

    public func updateUIView(_ view: PDFView, context: Context) {
        if let documentURL, view.document?.documentURL != documentURL {
            view.document = PDFDocument(url: documentURL)
        }
        if let target = view.document?.page(at: page), view.currentPage != target {
            view.go(to: target)
        }
    }
}
#endif
