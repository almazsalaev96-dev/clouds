import SwiftUI
import SwiftData

@main
struct StudyDeskApp: App {

    @State private var environment = AppEnvironment()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(environment.settings)
                .environment(environment.toolState)
                .modelContainer(environment.persistence.container)
                .tint(Theme.Palette.accent)
        }
        .onChange(of: scenePhase) { _, phase in
            // The single most important line for not losing a student's work:
            // anything still buffered is written before iPadOS takes the app
            // away. Individual readers also flush on close and on page change.
            if phase != .active {
                NotificationCenter.default.post(name: .studyDeskShouldFlush, object: nil)
            }
        }
        .commands { StudyDeskCommands() }
    }
}

extension Notification.Name {
    /// Broadcast when work must be committed now — backgrounding, or a
    /// termination warning.
    static let studyDeskShouldFlush = Notification.Name("studyDesk.shouldFlush")
}

/// Hardware keyboard support. An iPad with a Magic Keyboard is a laptop, and a
/// student using one should not have to reach for the screen to undo.
struct StudyDeskCommands: Commands {

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("Import PDF…") { post(.importPDF) }
                .keyboardShortcut("i", modifiers: .command)
            Button("New Note") { post(.newNote) }
                .keyboardShortcut("n", modifiers: .command)
            Button("Scan Worksheet") { post(.scan) }
                .keyboardShortcut("n", modifiers: [.command, .shift])
        }
        CommandMenu("Study") {
            Button("Ask Tutor") { post(.toggleTutor) }
                .keyboardShortcut("k", modifiers: .command)
            Button("Ask About Selection") { post(.askAboutSelection) }
                .keyboardShortcut("k", modifiers: [.command, .shift])
            Divider()
            Button("Next Page") { post(.nextPage) }
                .keyboardShortcut(.downArrow, modifiers: .command)
            Button("Previous Page") { post(.previousPage) }
                .keyboardShortcut(.upArrow, modifiers: .command)
            Divider()
            Button("Search") { post(.search) }
                .keyboardShortcut("f", modifiers: .command)
        }
    }

    private func post(_ command: StudyCommand) {
        NotificationCenter.default.post(name: .studyDeskCommand, object: command)
    }
}

enum StudyCommand: String {
    case importPDF, newNote, scan, toggleTutor, askAboutSelection, nextPage, previousPage, search
}

extension Notification.Name {
    static let studyDeskCommand = Notification.Name("studyDesk.command")
}
