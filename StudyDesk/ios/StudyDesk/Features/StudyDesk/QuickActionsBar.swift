import SwiftUI

/// The four ways work gets into the app.
///
/// Four, not six: "New notebook" and "Ask AI" were in the original sketch and
/// are gone. A blank notebook is a `Note`, reachable from the sidebar, and the
/// tutor without a worksheet in front of it is a chatbot — which is precisely
/// what this app is not.
struct QuickActionsBar: View {

    let importPDF: () -> Void
    let scan: () -> Void
    let addImage: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let actions = [
            Action(title: "Import PDF", symbol: "doc.badge.plus", action: importPDF),
            Action(title: "Scan Worksheet", symbol: "doc.viewfinder", action: scan),
            Action(title: "Add Photo", symbol: "photo.badge.plus", action: addImage)
        ]

        HStack(spacing: Theme.Space.m) {
            ForEach(actions) { action in
                Button(action: action.action) {
                    HStack(spacing: Theme.Space.s) {
                        Image(systemName: action.symbol)
                            .font(.title3)
                            .foregroundStyle(Theme.Palette.accent)
                        if sizeClass != .compact {
                            Text(action.title)
                                .font(Theme.Text.bodyEmphasis)
                                .foregroundStyle(Theme.Palette.textPrimary)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous)
                            .strokeBorder(Theme.Palette.separator, lineWidth: 0.5)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(action.title)
            }
        }
    }

    private struct Action: Identifiable {
        let title: String
        let symbol: String
        let action: () -> Void
        var id: String { title }
    }
}
