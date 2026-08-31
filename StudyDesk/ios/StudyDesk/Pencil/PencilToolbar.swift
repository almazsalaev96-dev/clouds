import SwiftUI

/// The floating writing toolbar.
///
/// Vertical and against an edge, not a bar across the bottom: a student writing
/// on the lower half of a worksheet needs that space, and a right-handed hand
/// rests where a bottom bar would be. It can be dragged to the other side for
/// left-handed use, and it remembers which side.
struct PencilToolbar: View {

    @Bindable var toolState: PencilToolState
    let onSelectRegion: () -> Void
    let isRegionSelecting: Bool

    @AppStorage("toolbar.side") private var isTrailing = false
    @AppStorage("toolbar.offset") private var verticalOffset: Double = 0
    @State private var dragOffset: CGSize = .zero
    @State private var expandedTool: PencilToolState.Kind?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let toolOrder: [PencilToolState.Kind] = [.pen, .pencil, .highlighter, .marker, .eraser, .lasso]

    var body: some View {
        HStack {
            if isTrailing { Spacer() }
            toolbar
            if !isTrailing { Spacer() }
        }
        .padding(.horizontal, Theme.Space.l)
        .frame(maxHeight: .infinity, alignment: .center)
        .offset(y: verticalOffset + dragOffset.height)
        .allowsHitTesting(!isRegionSelecting)
        .opacity(isRegionSelecting ? 0.25 : 1)
        .animation(Theme.Motion.respecting(Theme.Motion.panel, reduceMotion: reduceMotion), value: isTrailing)
        .animation(Theme.Motion.respecting(Theme.Motion.fade, reduceMotion: reduceMotion), value: isRegionSelecting)
    }

    private var toolbar: some View {
        VStack(spacing: Theme.Space.xs) {
            grip

            ForEach(toolOrder, id: \.self) { kind in
                toolButton(kind)
            }

            Divider().frame(width: 24)

            Button {
                onSelectRegion()
            } label: {
                Image(systemName: "viewfinder")
                    .frame(width: 40, height: 40)
                    .foregroundStyle(Theme.Palette.tutor)
            }
            .accessibilityLabel("Select part of the page to ask about")

            Button {
                toolState.rulerActive.toggle()
            } label: {
                Image(systemName: "ruler")
                    .frame(width: 40, height: 40)
                    .foregroundStyle(toolState.rulerActive ? Theme.Palette.accent : Theme.Palette.textSecondary)
            }
            .accessibilityLabel("Ruler")
            .accessibilityValue(toolState.rulerActive ? "On" : "Off")
        }
        .padding(.vertical, Theme.Space.s)
        .padding(.horizontal, Theme.Space.xs)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                .strokeBorder(Theme.Palette.separator, lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(Theme.Elevation.floating.opacity), radius: Theme.Elevation.floating.radius, y: Theme.Elevation.floating.y)
        .popover(item: $expandedTool) { kind in
            ToolOptionsView(toolState: toolState, kind: kind)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var grip: some View {
        Image(systemName: "line.3.horizontal")
            .font(.caption)
            .foregroundStyle(Theme.Palette.textTertiary)
            .frame(width: 40, height: 26)
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { dragOffset = CGSize(width: 0, height: $0.translation.height) }
                    .onEnded { value in
                        verticalOffset = max(-260, min(260, verticalOffset + value.translation.height))
                        dragOffset = .zero
                        // A decisive sideways drag flips which edge it lives on.
                        if abs(value.translation.width) > 120 {
                            isTrailing = value.translation.width > 0
                        }
                    }
            )
            .accessibilityLabel("Move toolbar")
            .accessibilityHint("Drag up or down to reposition, or sideways to change edge")
    }

    private func toolButton(_ kind: PencilToolState.Kind) -> some View {
        let isSelected = toolState.kind == kind
        return Button {
            if isSelected && !kind.widths.isEmpty {
                // Tapping the selected tool opens its options — the same
                // gesture as tapping a selected tool in Notes.
                expandedTool = kind
            } else {
                toolState.kind = kind
            }
        } label: {
            ZStack {
                if isSelected {
                    RoundedRectangle(cornerRadius: Theme.Radius.small, style: .continuous)
                        .fill(Theme.Palette.accent.opacity(0.14))
                }
                Image(systemName: kind.symbolName)
                    .foregroundStyle(isSelected ? Theme.Palette.accent : Theme.Palette.textSecondary)
                if isSelected, kind.isInking {
                    Circle()
                        .fill(toolState.color)
                        .frame(width: 7, height: 7)
                        .offset(x: 12, y: 12)
                }
            }
            .frame(width: 40, height: 40)
        }
        .accessibilityLabel(kind.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Width and colour for the selected tool.
private struct ToolOptionsView: View {

    @Bindable var toolState: PencilToolState
    let kind: PencilToolState.Kind

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.l) {
            Text(kind.title).font(Theme.Text.section)

            if !kind.widths.isEmpty {
                VStack(alignment: .leading, spacing: Theme.Space.s) {
                    Text("Thickness").font(Theme.Text.label).foregroundStyle(Theme.Palette.textSecondary)
                    HStack(spacing: Theme.Space.m) {
                        ForEach(kind.widths, id: \.self) { width in
                            Button {
                                toolState.width = width
                            } label: {
                                Circle()
                                    .fill(toolState.width == width ? Theme.Palette.accent : Theme.Palette.textTertiary)
                                    .frame(width: min(26, 8 + width), height: min(26, 8 + width))
                                    .frame(width: 34, height: 34)
                                    .contentShape(Rectangle())
                            }
                            .accessibilityLabel("\(Int(width)) point")
                            .accessibilityAddTraits(toolState.width == width ? .isSelected : [])
                        }
                    }
                }
            }

            if kind.isInking {
                VStack(alignment: .leading, spacing: Theme.Space.s) {
                    Text("Colour").font(Theme.Text.label).foregroundStyle(Theme.Palette.textSecondary)
                    HStack(spacing: Theme.Space.m) {
                        let palette = InkPalette.colors(for: kind)
                        ForEach(Array(palette.enumerated()), id: \.element.id) { index, ink in
                            Button {
                                toolState.colorIndex = index
                            } label: {
                                Circle()
                                    .fill(ink.color)
                                    .frame(width: 26, height: 26)
                                    .overlay(
                                        Circle().strokeBorder(
                                            toolState.colorIndex == index ? Theme.Palette.textPrimary : Theme.Palette.separator,
                                            lineWidth: toolState.colorIndex == index ? 2 : 0.5
                                        )
                                    )
                            }
                            .accessibilityLabel(ink.name)
                            .accessibilityAddTraits(toolState.colorIndex == index ? .isSelected : [])
                        }
                    }
                }
            }

            if kind == .eraser {
                Toggle("Erase whole strokes", isOn: $toolState.erasesWholeStrokes)
                    .font(Theme.Text.caption)
            }
        }
        .padding(Theme.Space.l)
        .frame(width: 280)
    }
}
