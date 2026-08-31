import SwiftUI
import VisionKit
import PhotosUI

/// The system document scanner.
///
/// `VNDocumentCameraViewController` already does edge detection, perspective
/// correction and multi-page capture better than a hand-rolled camera would,
/// and students already know how it behaves from Notes and Files. Wrapping it
/// is the right amount of work here.
struct DocumentScannerView: UIViewControllerRepresentable {

    let onComplete: ([UIImage]) -> Void
    let onCancel: () -> Void

    static var isSupported: Bool { VNDocumentCameraViewController.isSupported }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onComplete: onComplete, onCancel: onCancel)
    }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        private let onComplete: ([UIImage]) -> Void
        private let onCancel: () -> Void

        init(onComplete: @escaping ([UIImage]) -> Void, onCancel: @escaping () -> Void) {
            self.onComplete = onComplete
            self.onCancel = onCancel
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            let images = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
            onComplete(images)
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            onCancel()
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            Log.app.error("Scan failed: \(error.localizedDescription, privacy: .public)")
            onCancel()
        }
    }
}

// MARK: - Photo import

extension View {
    /// Photo picker that hands back decoded images.
    ///
    /// `PhotosPicker` is used rather than a custom picker because it runs out
    /// of process — the app never gets access to the whole photo library, only
    /// to the images the student chose. That is a real privacy difference, not
    /// just less code.
    func photoImport(isPresented: Binding<Bool>, onSelect: @escaping ([UIImage]) -> Void) -> some View {
        modifier(PhotoImportModifier(isPresented: isPresented, onSelect: onSelect))
    }
}

private struct PhotoImportModifier: ViewModifier {

    @Binding var isPresented: Bool
    let onSelect: ([UIImage]) -> Void

    @State private var selection: [PhotosPickerItem] = []

    func body(content: Content) -> some View {
        content
            .photosPicker(
                isPresented: $isPresented,
                selection: $selection,
                maxSelectionCount: 20,
                matching: .images
            )
            .onChange(of: selection) { _, items in
                guard !items.isEmpty else { return }
                Task {
                    var images: [UIImage] = []
                    for item in items {
                        if let data = try? await item.loadTransferable(type: Data.self),
                           let image = UIImage(data: data) {
                            images.append(image)
                        }
                    }
                    selection = []
                    onSelect(images)
                }
            }
    }
}

// MARK: - Sharing

/// The system share sheet.
///
/// Deliberately not replaced with an in-app "send to teacher" flow: schools use
/// Teams, Classroom, Firefly, email and half a dozen others, and the share sheet
/// already reaches all of them. Building a proprietary channel would reach none.
struct ShareSheet: UIViewControllerRepresentable {

    let items: [Any]
    var onComplete: ((Bool) -> Void)?

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in
            onComplete?(completed)
        }
        return controller
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
