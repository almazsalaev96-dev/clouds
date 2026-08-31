import SwiftUI
import PencilKit

/// The currently selected writing tool, shared by every page canvas.
///
/// Preferences persist: a student who writes in 0.4mm blue ink should never
/// have to choose it twice. Stored in `UserDefaults` rather than the database
/// because it is a setting, not work.
@MainActor
@Observable
final class PencilToolState {

    enum Kind: String, CaseIterable, Identifiable, Codable {
        case pen
        case pencil
        case marker
        case highlighter
        case eraser
        case lasso

        var id: String { rawValue }

        var title: String {
            switch self {
            case .pen: "Pen"
            case .pencil: "Pencil"
            case .marker: "Marker"
            case .highlighter: "Highlighter"
            case .eraser: "Eraser"
            case .lasso: "Select"
            }
        }

        var symbolName: String {
            switch self {
            case .pen: "pencil.tip"
            case .pencil: "pencil"
            case .marker: "paintbrush.pointed"
            case .highlighter: "highlighter"
            case .eraser: "eraser"
            case .lasso: "lasso"
            }
        }

        var inkType: PKInk.InkType? {
            switch self {
            case .pen: .pen
            case .pencil: .pencil
            case .marker: .marker
            case .highlighter: .marker
            case .eraser, .lasso: nil
            }
        }

        /// Widths offered for this tool, in points. Different tools want very
        /// different ranges — a 20pt pen is a marker, a 2pt highlighter is
        /// useless.
        var widths: [CGFloat] {
            switch self {
            case .pen: [1, 2, 3.5, 6]
            case .pencil: [1.5, 3, 5, 8]
            case .marker: [4, 8, 14, 22]
            case .highlighter: [12, 18, 26, 34]
            case .eraser: [8, 16, 28, 44]
            case .lasso: []
            }
        }

        var isInking: Bool { inkType != nil }
    }

    // MARK: Selection

    var kind: Kind = .pen { didSet { persist() } }
    /// One remembered width per tool.
    var widths: [Kind: CGFloat] = [:] { didSet { persist() } }
    var colorIndex: Int = 0 { didSet { persist() } }
    /// Eraser that removes whole strokes rather than nibbling pixels. Stroke
    /// erasing is what students expect from paper; bitmap erasing surprises them.
    var erasesWholeStrokes: Bool = true { didSet { persist() } }
    /// When true, only Apple Pencil draws and fingers pan/zoom the document.
    /// Turned off automatically on devices with no Pencil paired.
    var pencilOnlyDrawing: Bool = true { didSet { persist() } }
    var rulerActive: Bool = false

    // Note: PencilKit exposes no public API for shape straightening — that
    // lives inside the system `PKToolPicker`, which this app replaces with its
    // own toolbar. Rather than ship a switch that does nothing, there isn't
    // one. See docs/pencil-and-pdf.md.

    // MARK: Derived

    var width: CGFloat {
        get { widths[kind] ?? kind.widths.dropFirst().first ?? 3 }
        set { widths[kind] = newValue }
    }

    /// Highlighters have their own, lighter palette, so the index is resolved
    /// against whichever set belongs to the current tool.
    var color: Color {
        let palette = InkPalette.colors(for: kind)
        return palette[safe: colorIndex]?.color ?? palette[0].color
    }

    /// A value that changes whenever the selected tool changes.
    ///
    /// `PencilToolState` is a class, so passing it to `PDFStudyView` does not
    /// tell SwiftUI that anything changed when the toolbar mutates it. The
    /// reader reads this in its body, which registers a dependency on each
    /// property below and guarantees `updateUIViewController` runs.
    var signature: String {
        "\(kind.rawValue)|\(width)|\(colorIndex)|\(erasesWholeStrokes)|\(pencilOnlyDrawing)|\(rulerActive)"
    }

    /// The PencilKit tool this state describes.
    var tool: PKTool {
        switch kind {
        case .eraser:
            return PKEraserTool(erasesWholeStrokes ? .vector : .bitmap, width: width)
        case .lasso:
            return PKLassoTool()
        case .highlighter:
            // A highlighter must sit *under* what it marks and not stack to
            // opacity on overlap, which is what `.marker` with a translucent
            // colour gives you.
            let ink = PKInk(.marker, color: UIColor(color).withAlphaComponent(0.32))
            return PKInkingTool(ink: ink, width: width)
        default:
            let inkType = kind.inkType ?? .pen
            return PKInkingTool(ink: PKInk(inkType, color: UIColor(color)), width: width)
        }
    }

    // MARK: Persistence

    private static let defaultsKey = "pencil.toolState.v1"

    private struct Stored: Codable {
        var kind: Kind
        var widths: [String: Double]
        var colorIndex: Int
        var erasesWholeStrokes: Bool
        var pencilOnlyDrawing: Bool
    }

    private var isLoading = false

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    private let defaults: UserDefaults

    private func load() {
        isLoading = true
        defer { isLoading = false }
        guard let data = defaults.data(forKey: Self.defaultsKey),
              let stored = try? JSONDecoder().decode(Stored.self, from: data) else { return }
        kind = stored.kind
        widths = stored.widths.reduce(into: [:]) { result, pair in
            if let kind = Kind(rawValue: pair.key) { result[kind] = CGFloat(pair.value) }
        }
        colorIndex = stored.colorIndex
        erasesWholeStrokes = stored.erasesWholeStrokes
        pencilOnlyDrawing = stored.pencilOnlyDrawing
    }

    private func persist() {
        guard !isLoading else { return }
        let stored = Stored(
            kind: kind,
            widths: widths.reduce(into: [:]) { $0[$1.key.rawValue] = Double($1.value) },
            colorIndex: colorIndex,
            erasesWholeStrokes: erasesWholeStrokes,
            pencilOnlyDrawing: pencilOnlyDrawing
        )
        if let data = try? JSONEncoder().encode(stored) {
            defaults.set(data, forKey: Self.defaultsKey)
        }
    }

    /// Apple Pencil's double-tap. The system reports the student's chosen
    /// preference; honouring it is why the gesture feels native rather than
    /// hijacked.
    func handlePencilDoubleTap(preference: UIPencilPreferredAction, previousKind: inout Kind?) {
        switch preference {
        case .switchEraser:
            if kind == .eraser {
                kind = previousKind ?? .pen
                previousKind = nil
            } else {
                previousKind = kind
                kind = .eraser
            }
        case .switchPrevious:
            let current = kind
            kind = previousKind ?? .eraser
            previousKind = current
        case .ignore:
            break
        @unknown default:
            // Newer preferences (showing the colour palette, ink attributes)
            // belong to the system tool picker, which this app replaces.
            break
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
