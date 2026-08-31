import SwiftUI
import SwiftData

/// The app's frame: a sidebar of places, a detail area, and the reader
/// presented over the top of both.
///
/// The reader is a full-screen cover rather than a navigation push. That is a
/// deliberate choice — when a student is working on a worksheet, the worksheet
/// is the entire interface, and a sidebar peeking in from the left is one more
/// thing competing with the page.
struct RootView: View {

    enum Destination: Hashable {
        case desk
        case assignments
        case notes
        case progress
        case trash
        case subject(String)
    }

    @Environment(AppEnvironment.self) private var app
    @Environment(AppSettings.self) private var settings

    @State private var destination: Destination? = .desk
    @State private var openDocument: StudyDocument?
    @State private var isSearching = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(destination: $destination, isSearching: $isSearching)
        } detail: {
            NavigationStack {
                detailView
            }
        }
        .navigationSplitViewStyle(.balanced)
        .fullScreenCover(item: $openDocument) { document in
            ReaderScreen(document: document)
        }
        .sheet(isPresented: $isSearching) {
            GlobalSearchView { result in
                isSearching = false
                openDocument = result.document
            }
        }
        .sheet(isPresented: Binding(
            get: { !settings.hasCompletedOnboarding },
            set: { if !$0 { settings.hasCompletedOnboarding = true } }
        )) {
            OnboardingView { settings.hasCompletedOnboarding = true }
                .interactiveDismissDisabled()
        }
        .onReceive(NotificationCenter.default.publisher(for: .studyDeskCommand)) { note in
            guard let command = note.object as? StudyCommand else { return }
            if command == .search { isSearching = true }
        }
        .background(Theme.Palette.background)
    }

    @ViewBuilder
    private var detailView: some View {
        switch destination ?? .desk {
        case .desk:
            StudyDeskView(open: { openDocument = $0 })
        case .assignments:
            AssignmentsView(open: { openDocument = $0 })
        case .notes:
            NotesView()
        case .progress:
            StudyProgressView()
        case .trash:
            RecentlyDeletedView()
        case .subject(let name):
            SubjectLibraryView(subject: Subject(name), open: { openDocument = $0 })
        }
    }
}

/// The places a student can go. Short on purpose: everything else is reached
/// from the desk itself.
struct SidebarView: View {

    @Binding var destination: RootView.Destination?
    @Binding var isSearching: Bool

    @Environment(AppEnvironment.self) private var app
    @Query(filter: #Predicate<StudyDocument> { $0.deletedAt == nil })
    private var documents: [StudyDocument]

    private var subjects: [Subject] {
        let names = Set(documents.map(\.subjectName)).subtracting([Subject.unspecified.name])
        return names.map(Subject.init).sorted { $0.name < $1.name }
    }

    var body: some View {
        List(selection: $destination) {
            Section {
                label("Study Desk", "square.grid.2x2", .desk)
                label("Assignments", "checklist", .assignments)
                label("Notes", "note.text", .notes)
                label("Progress", "chart.bar", .progress)
            }

            if !subjects.isEmpty {
                Section("Subjects") {
                    ForEach(subjects) { subject in
                        Label(subject.name, systemImage: subject.symbolName)
                            .foregroundStyle(Theme.Palette.textPrimary)
                            .tag(RootView.Destination.subject(subject.name))
                    }
                }
            }

            Section {
                label("Recently Deleted", "trash", .trash)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Study Desk")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isSearching = true
                } label: {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .keyboardShortcut("f", modifiers: .command)
            }
        }
    }

    private func label(_ title: String, _ symbol: String, _ value: RootView.Destination) -> some View {
        Label(title, systemImage: symbol).tag(value)
    }
}
