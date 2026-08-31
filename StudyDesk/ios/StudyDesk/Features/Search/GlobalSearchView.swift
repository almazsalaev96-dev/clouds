import SwiftUI
import SwiftData

/// Search across everything a student has: worksheet text, their own
/// handwriting where it has been recognised, notes, and past tutor answers.
///
/// The last of those is the one people don't expect and then rely on — "what
/// did the tutor say about photosynthesis last week" is a real question, and
/// the answer is already on the device.
struct GlobalSearchView: View {

    let onOpen: (SearchEngine.Result) -> Void

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [SearchEngine.Result] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            Group {
                if query.trimmedNonEmpty == nil {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Search your library",
                        message: "Worksheet text, your handwriting, your notes, and everything your tutor has explained."
                    )
                } else if results.isEmpty && !isSearching {
                    EmptyStateView(
                        icon: "questionmark.folder",
                        title: "No matches",
                        message: "Nothing in your library mentions “\(query)”."
                    )
                } else {
                    List(results) { result in
                        Button {
                            onOpen(result)
                        } label: {
                            resultRow(result)
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "photosynthesis, quadratic, page 12…")
        .onChange(of: query) { _, value in
            // Debounced: searching on every keystroke across a large library
            // makes the field feel laggy for no benefit.
            searchTask?.cancel()
            guard value.trimmedNonEmpty != nil else {
                results = []
                return
            }
            isSearching = true
            searchTask = Task {
                try? await Task.sleep(for: .milliseconds(220))
                guard !Task.isCancelled else { return }
                let engine = SearchEngine(context: modelContext)
                results = engine.search(value)
                isSearching = false
            }
        }
    }

    private func resultRow(_ result: SearchEngine.Result) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
            HStack(spacing: Theme.Space.xs) {
                Image(systemName: result.kind.symbolName)
                    .font(.caption)
                    .foregroundStyle(Theme.Palette.accent)
                Text(result.title)
                    .font(Theme.Text.bodyEmphasis)
                Spacer()
                Text(result.kind.label)
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.textTertiary)
            }
            Text(result.snippet)
                .font(Theme.Text.caption)
                .foregroundStyle(Theme.Palette.textSecondary)
                .lineLimit(2)
        }
        .padding(.vertical, Theme.Space.xs)
    }
}
