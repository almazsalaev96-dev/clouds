import SwiftUI
import SlateAI
import SlateDocuments
import SlateFoundation
import SlateLearning
import SlateModel
import SlateUI
import SlateVoice

@main
struct SlateApp: App {
    @StateObject private var container = AppContainer()
    @State private var showOnboarding = !OnboardingState.isComplete()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            if let failure = container.startupFailure {
                StartupFailureView(message: failure)
            } else if showOnboarding {
                OnboardingView {
                    OnboardingState.markComplete()
                    showOnboarding = false
                }
            } else {
                RootView(
                    desk: container.desk,
                    library: container.library,
                    study: container.study,
                    mistakes: container.mistakes,
                    voice: container.voiceController,
                    makePractice: { container.practice(for: $0) },
                    makeTest: { container.test(for: $0) },
                    makeWorkspace: { container.workspace(for: $0) },
                    makeDiagnostic: { container.diagnostic(for: $0) },
                    settings: container.settings,
                    notes: container.notes,
                    assignments: container.assignments,
                    workspaceStore: container.store
                )
                .task { await container.start() }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Backgrounding is the last reliable moment before the process can be
            // killed, so everything in flight is flushed here rather than on a timer.
            if phase != .active { container.flush() }
        }
    }
}
