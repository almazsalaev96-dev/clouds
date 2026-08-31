import UIKit

/// The drag-a-box layer used by "Ask about this part of the page".
///
/// It is a plain overlay rather than a PencilKit lasso because the region has
/// to be usable with a finger — a student holding the Pencil in one hand still
/// wants to circle a diagram with the other. When it isn't active it is hidden
/// and hit-testing passes straight through to the page.
final class RegionSelectionView: UIView {

    var onSelection: ((CGRect) -> Void)?
    var onCancel: (() -> Void)?

    private var startPoint: CGPoint?
    private let selectionLayer = CAShapeLayer()
    private let hintLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor.black.withAlphaComponent(0.12)

        selectionLayer.fillColor = UIColor.clear.cgColor
        selectionLayer.strokeColor = UIColor(Theme.Palette.accent).cgColor
        selectionLayer.lineWidth = 2
        selectionLayer.lineDashPattern = [6, 4]
        layer.addSublayer(selectionLayer)

        hintLabel.text = "Drag a box around what you want to ask about"
        hintLabel.font = .preferredFont(forTextStyle: .footnote)
        hintLabel.adjustsFontForContentSizeCategory = true
        hintLabel.textColor = .white
        hintLabel.backgroundColor = UIColor.black.withAlphaComponent(0.62)
        hintLabel.textAlignment = .center
        hintLabel.layer.cornerRadius = 14
        hintLabel.layer.cornerCurve = .continuous
        hintLabel.clipsToBounds = true
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(hintLabel)
        NSLayoutConstraint.activate([
            hintLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            hintLabel.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 16),
            hintLabel.heightAnchor.constraint(equalToConstant: 32),
            hintLabel.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, constant: -32)
        ])
        hintLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan))
        addGestureRecognizer(pan)
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        addGestureRecognizer(tap)

        isAccessibilityElement = true
        accessibilityLabel = "Select a region of the page"
        accessibilityHint = "Drag to choose an area, or double tap to cancel"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        hintLabel.layoutIfNeeded()
        // Give the pill some breathing room around its text.
        hintLabel.frame = hintLabel.frame.insetBy(dx: -12, dy: 0)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let point = gesture.location(in: self)
        switch gesture.state {
        case .began:
            startPoint = point
            hintLabel.isHidden = true
        case .changed:
            guard let startPoint else { return }
            draw(rect(from: startPoint, to: point))
        case .ended:
            guard let startPoint else { return }
            let selected = rect(from: startPoint, to: point)
            reset()
            // Ignore an accidental flick; a real selection has area.
            if selected.width > 24, selected.height > 16 {
                onSelection?(selected)
            }
        case .cancelled, .failed:
            reset()
        default:
            break
        }
    }

    @objc private func handleTap() {
        // A tap with no drag means "never mind".
        reset()
        onCancel?()
    }

    private func reset() {
        startPoint = nil
        selectionLayer.path = nil
        hintLabel.isHidden = false
    }

    private func rect(from a: CGPoint, to b: CGPoint) -> CGRect {
        CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
    }

    private func draw(_ rect: CGRect) {
        selectionLayer.path = UIBezierPath(roundedRect: rect, cornerRadius: 6).cgPath
    }
}
