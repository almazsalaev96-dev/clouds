import SwiftUI

/// The only permanent chrome over the page.
///
/// Everything on it earns its place: leaving, knowing where you are, undoing a
/// mistake, and finishing. Anything else lives behind the ellipsis or isn't in
/// the app.
struct ReaderTopBar: View {

    let title: String
    let pageIndex: Int
    let pageCount: Int
    @Binding var isExamMode: Bool
    @Binding var showsThumbnails: Bool

    let onClose: () -> Void
    let onFinish: () -> Void
    let onUndo: () -> Void
    let onRedo: () -> Void
    let canUndo: Bool
    let canRedo: Bool

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        HStack(spacing: Theme.Space.m) {
            Button(action: onClose) {
                Label("Done", systemImage: "chevron.left")
                    .labelStyle(.iconOnly)
                    .font(.body.weight(.semibold))
                    .frame(width: 34, height: 34)
            }
            .accessibilityLabel("Close worksheet")

            Button {
                showsThumbnails.toggle()
            } label: {
                Image(systemName: showsThumbnails ? "sidebar.left" : "square.grid.2x2")
                    .frame(width: 34, height: 34)
            }
            .accessibilityLabel(showsThumbnails ? "Hide page thumbnails" : "Show page thumbnails")

            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(Theme.Text.bodyEmphasis)
                    .lineLimit(1)
                Text("Page \(pageIndex + 1) of \(max(pageCount, 1))")
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.textSecondary)
            }
            .frame(maxWidth: sizeClass == .compact ? 140 : 320, alignment: .leading)

            Spacer(minLength: Theme.Space.s)

            HStack(spacing: Theme.Space.xs) {
                Button(action: onUndo) {
                    Image(systemName: "arrow.uturn.backward").frame(width: 34, height: 34)
                }
                .disabled(!canUndo)
                .accessibilityLabel("Undo")
                .keyboardShortcut("z", modifiers: .command)

                Button(action: onRedo) {
                    Image(systemName: "arrow.uturn.forward").frame(width: 34, height: 34)
                }
                .disabled(!canRedo)
                .accessibilityLabel("Redo")
                .keyboardShortcut("z", modifiers: [.command, .shift])
            }

            Menu {
                Toggle(isOn: $isExamMode) {
                    Label("Exam Mode", systemImage: "timer")
                }
                Divider()
                Button {
                    onFinish()
                } label: {
                    Label("Finish assignment", systemImage: "checkmark.seal")
                }
            } label: {
                Image(systemName: "ellipsis.circle").frame(width: 34, height: 34)
            }
            .accessibilityLabel("More options")

            Button(action: onFinish) {
                Text("Finish")
            }
            .buttonStyle(PrimaryButtonStyle())
            .controlSize(.small)
        }
        .padding(.horizontal, Theme.Space.l)
        .padding(.vertical, Theme.Space.s)
        .background(.regularMaterial)
        .overlay(alignment: .bottom) {
            Divider()
        }
        .overlay(alignment: .leading) {
            if isExamMode {
                // A quiet marker rather than a banner. The student knows they
                // turned it on; they don't need reminding across the whole page.
                Rectangle()
                    .fill(Theme.Palette.warning)
                    .frame(width: 3)
                    .accessibilityLabel("Exam Mode is on")
            }
        }
    }
}
