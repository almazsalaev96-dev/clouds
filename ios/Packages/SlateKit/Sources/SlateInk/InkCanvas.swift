#if canImport(PencilKit) && canImport(SwiftUI)
import PencilKit
import SwiftUI
import UIKit
import SlateDocuments
import SlateFoundation

/// The writing surface.
///
/// Apple Pencil is a primary input, not an accessory, so this is a thin wrapper over
/// `PKCanvasView` rather than a custom renderer: nothing hand-written will match the
/// system's latency, prediction, palm rejection, or the way its ink behaves under tilt.
/// The job here is to stay out of the way and to persist what happens.
public struct InkCanvas: UIViewRepresentable {

    @Binding public var tool: InkTool
    public let page: Int
    public let initialDrawing: Data?
    public let isReadOnly: Bool
    /// Called on every committed change. Debounced by the coordinator, because
    /// journalling every intermediate stroke of a fast scribble would stall the pencil.
    public let onChange: (Data) -> Void
    /// Called when the student lifts the pencil and pauses, which is the only moment
    /// the tutor is allowed to consider saying anything unprompted.
    public let onSettled: (() -> Void)?

    public init(tool: Binding<InkTool>, page: Int, initialDrawing: Data?,
                isReadOnly: Bool = false, onChange: @escaping (Data) -> Void,
                onSettled: (() -> Void)? = nil) {
        _tool = tool
        self.page = page
        self.initialDrawing = initialDrawing
        self.isReadOnly = isReadOnly
        self.onChange = onChange
        self.onSettled = onSettled
    }

    public func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.delegate = context.coordinator
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        // Finger drawing off by default: on a worksheet the finger is for scrolling and
        // the pencil is for writing, and mixing them is the fastest way to put a stray
        // line through someone's answer.
        canvas.drawingPolicy = .pencilOnly
        canvas.alwaysBounceVertical = false
        canvas.tool = tool.pkTool
        canvas.isUserInteractionEnabled = !isReadOnly

        if let data = initialDrawing, let drawing = try? PKDrawing(data: data) {
            canvas.drawing = drawing
        }
        return canvas
    }

    public func updateUIView(_ canvas: PKCanvasView, context: Context) {
        if canvas.tool as? PKInkingTool != tool.pkTool as? PKInkingTool {
            canvas.tool = tool.pkTool
        }
        canvas.isUserInteractionEnabled = !isReadOnly
        context.coordinator.onChange = onChange
        context.coordinator.onSettled = onSettled
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onChange: onChange, onSettled: onSettled)
    }

    public final class Coordinator: NSObject, PKCanvasViewDelegate {
        var onChange: (Data) -> Void
        var onSettled: (() -> Void)?
        private var saveWork: DispatchWorkItem?
        private var settleWork: DispatchWorkItem?

        init(onChange: @escaping (Data) -> Void, onSettled: (() -> Void)?) {
            self.onChange = onChange
            self.onSettled = onSettled
        }

        public func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            let data = canvasView.drawing.dataRepresentation()

            // Persist shortly after the hand stops moving. Long enough that a fast
            // sequence of strokes is one write, short enough that a crash costs at
            // most a fraction of a second of work.
            saveWork?.cancel()
            let save = DispatchWorkItem { [onChange] in onChange(data) }
            saveWork = save
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: save)

            // A longer pause means they have stopped, not that they are mid-word.
            settleWork?.cancel()
            guard let onSettled else { return }
            let settle = DispatchWorkItem { onSettled() }
            settleWork = settle
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: settle)
        }
    }
}

/// The tools, and the defaults a student should never have to configure.
public struct InkTool: Equatable, Sendable {
    public enum Kind: String, CaseIterable, Sendable, Identifiable {
        case pen, pencil, highlighter, marker, eraser, lasso
        public var id: String { rawValue }

        public var label: String {
            switch self {
            case .pen: "Pen"
            case .pencil: "Pencil"
            case .highlighter: "Highlighter"
            case .marker: "Marker"
            case .eraser: "Eraser"
            case .lasso: "Select"
            }
        }

        public var systemImage: String {
            switch self {
            case .pen: "pencil.tip"
            case .pencil: "pencil"
            case .highlighter: "highlighter"
            case .marker: "paintbrush.pointed"
            case .eraser: "eraser"
            case .lasso: "lasso"
            }
        }
    }

    public var kind: Kind
    public var colour: Color
    public var width: CGFloat

    public init(kind: Kind = .pen, colour: Color = .primaryInk, width: CGFloat = 3) {
        self.kind = kind
        self.colour = colour
        self.width = width
    }

    /// Widths chosen so that writing at a natural size on a worksheet looks like a pen
    /// on paper rather than a marker on a whiteboard.
    public static let defaults: [Kind: InkTool] = [
        .pen: InkTool(kind: .pen, colour: .primaryInk, width: 3),
        .pencil: InkTool(kind: .pencil, colour: .primaryInk, width: 4),
        .highlighter: InkTool(kind: .highlighter, colour: .highlightYellow, width: 20),
        .marker: InkTool(kind: .marker, colour: .primaryInk, width: 8),
        .eraser: InkTool(kind: .eraser, colour: .primaryInk, width: 12),
        .lasso: InkTool(kind: .lasso, colour: .primaryInk, width: 1),
    ]

    var pkTool: PKTool {
        switch kind {
        case .pen:
            return PKInkingTool(.pen, color: UIColor(colour), width: width)
        case .pencil:
            return PKInkingTool(.pencil, color: UIColor(colour), width: width)
        case .highlighter:
            return PKInkingTool(.marker, color: UIColor(colour).withAlphaComponent(0.4),
                                width: width)
        case .marker:
            return PKInkingTool(.marker, color: UIColor(colour), width: width)
        case .eraser:
            // Vector erasing removes whole strokes, which is what a student means when
            // they rub out a wrong digit; bitmap erasing leaves fragments behind.
            return PKEraserTool(.vector)
        case .lasso:
            return PKLassoTool()
        }
    }
}

public extension Color {
    /// Not pure black: on a white worksheet, a very dark grey reads as ink rather than
    /// as printing, which keeps the student's writing visually distinct from the page.
    static let primaryInk = Color(red: 0.11, green: 0.12, blue: 0.14)
    static let highlightYellow = Color(red: 1.0, green: 0.86, blue: 0.28)
}

/// Turn a drawing into the bounds the answer-detection code reasons about.
public enum StrokeAnalysis {
    public static func summarise(_ data: Data, page: Int, pageSize: CGSize)
        -> AnswerDetection.StrokeSummary? {
        guard let drawing = try? PKDrawing(data: data), !drawing.strokes.isEmpty else { return nil }
        let bounds = drawing.bounds
        guard pageSize.width > 0, pageSize.height > 0, !bounds.isNull else { return nil }
        return AnswerDetection.StrokeSummary(
            bounds: NormalisedRect(
                x: bounds.minX / pageSize.width,
                y: bounds.minY / pageSize.height,
                width: bounds.width / pageSize.width,
                height: bounds.height / pageSize.height
            ),
            strokeCount: drawing.strokes.count,
            page: page
        )
    }

    /// The strokes inside one region, rendered for the tutor to look at.
    ///
    /// Only the answer area is sent, never the whole page: it is a smaller image, a
    /// cheaper request, and a smaller amount of a child's work leaving the device.
    public static func image(from data: Data, region: NormalisedRect,
                             pageSize: CGSize, scale: CGFloat = 2) -> UIImage? {
        guard let drawing = try? PKDrawing(data: data) else { return nil }
        let rect = CGRect(
            x: region.x * pageSize.width, y: region.y * pageSize.height,
            width: region.width * pageSize.width, height: region.height * pageSize.height
        )
        guard rect.width > 1, rect.height > 1 else { return nil }
        return drawing.image(from: rect, scale: scale)
    }
}
#endif
