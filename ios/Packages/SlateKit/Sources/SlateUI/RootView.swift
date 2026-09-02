#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation

/// Four places, and the tutor everywhere.
///
/// Not five. Progress lives inside Study rather than as its own tab, because a student
/// who opens the app to see how they are doing is usually about to revise, and a
/// separate statistics tab invites checking the number instead of doing the work.
public struct RootView: View {

    public enum Tab: String, CaseIterable, Identifiable {
        case desk, work, study, knowledge
        public var id: String { rawValue }

        var label: String {
            switch self {
            case .desk: "Desk"
            case .work: "Work"
            case .study: "Study"
            case .knowledge: "Knowledge"
            }
        }

        var systemImage: String {
            switch self {
            case .desk: "square.on.square"
            case .work: "doc.text"
            case .study: "graduationcap"
            case .knowledge: "books.vertical"
            }
        }
    }

    @State private var tab: Tab = .desk
    private let desk: DeskModel

    public init(desk: DeskModel) { self.desk = desk }

    public var body: some View {
        TabView(selection: $tab) {
            ForEach(Tab.allCases) { item in
                NavigationStack {
                    content(for: item)
                        .navigationTitle(item == .desk ? "" : item.label)
                }
                .tabItem { Label(item.label, systemImage: item.systemImage) }
                .tag(item)
            }
        }
        .tint(Slate.Palette.tutor)
        .task { await desk.refresh() }
    }

    @ViewBuilder
    private func content(for tab: Tab) -> some View {
        switch tab {
        case .desk:
            DeskView(model: desk)
        case .work:
            EmptyStateView(
                icon: "tray.and.arrow.down",
                title: "Your documents live here",
                detail: "Worksheets, past papers, notes and scans, grouped by subject.",
                actionLabel: "Add something",
                action: desk.importDocument
            )
        case .study:
            EmptyStateView(
                icon: "graduationcap",
                title: "Practice and revision",
                detail: "Once you have marked some work, this is where the weak spots turn into short sessions."
            )
        case .knowledge:
            EmptyStateView(
                icon: "books.vertical",
                title: "Notes and mistakes",
                detail: "Everything you have written, and every mistake worth coming back to, in one searchable place."
            )
        }
    }
}
#endif
