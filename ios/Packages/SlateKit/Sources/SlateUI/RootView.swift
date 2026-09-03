#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateDocuments
import SlateVoice
import SlateFoundation
import SlateModel

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
    @State private var practising: PracticeModel?
    @State private var sitting: TestSessionModel?
    @State private var working: WorkspaceModel?
    @State private var diagnosing: DiagnosticModel?

    private let desk: DeskModel
    private let library: LibraryModel
    private let study: StudyModel
    private let mistakes: MistakesModel
    /// Supplied by the container, which owns the services these sessions need.
    private let makePractice: (ConceptID) -> PracticeModel?
    private let makeTest: ([Concept]) -> TestSessionModel
    private let makeWorkspace: (DocumentMeta) -> WorkspaceModel?
    private let makeDiagnostic: ([Concept]) -> DiagnosticModel
    private let settings: SettingsModel
    private let notes: NotesModel
    /// One voice for the whole app, so starting a new utterance anywhere stops the one
    /// already speaking. Two controllers would mean two voices talking over each other.
    @ObservedObject private var voice: VoiceController

    public init(desk: DeskModel, library: LibraryModel,
                study: StudyModel, mistakes: MistakesModel, voice: VoiceController,
                makePractice: @escaping (ConceptID) -> PracticeModel?,
                makeTest: @escaping ([Concept]) -> TestSessionModel,
                makeWorkspace: @escaping (DocumentMeta) -> WorkspaceModel?,
                makeDiagnostic: @escaping ([Concept]) -> DiagnosticModel,
                settings: SettingsModel, notes: NotesModel) {
        self.desk = desk
        self.library = library
        self.study = study
        self.mistakes = mistakes
        _voice = ObservedObject(wrappedValue: voice)
        self.makePractice = makePractice
        self.makeTest = makeTest
        self.makeWorkspace = makeWorkspace
        self.makeDiagnostic = makeDiagnostic
        self.settings = settings
        self.notes = notes
    }

    public var body: some View {
        TabView(selection: $tab) {
            ForEach(Tab.allCases) { item in
                NavigationStack {
                    content(for: item)
                        .navigationTitle(item == .desk ? "" : item.label)
                        .toolbar {
                            // One entry point, on the Desk only. Settings on every tab
                            // is four buttons for a screen nobody should need often.
                            if item == .desk {
                                ToolbarItem(placement: .primaryAction) {
                                    NavigationLink {
                                        SettingsView(model: settings, voice: voice)
                                    } label: {
                                        Label("Settings", systemImage: "gearshape")
                                    }
                                }
                            }
                        }
                }
                .tabItem { Label(item.label, systemImage: item.systemImage) }
                .tag(item)
            }
        }
        .tint(Slate.Palette.tutor)
        .task { await desk.refresh() }
        // One presentation for every route into practice, so starting a session from
        // the desk, from Study, from a mistake pattern, or from a test result all land
        // in the same place.
        .sheet(item: $practising) { PracticeView(model: $0, voice: voice) }
        .sheet(item: $sitting) { model in
            TestSessionView(model: model) { concept in
                // Test result to intervention without leaving the flow. A test that
                // does not change what happens next is only a number.
                sitting = nil
                practising = makePractice(concept)
            }
            .task { await model.start() }
        }
        // The workspace takes the whole screen. A worksheet in a sheet with a
        // navigation bar above it is a worksheet with less page on it.
        .fullScreenCover(item: $working) { model in
            NavigationStack {
                WorkspaceView(model: model, voice: voice) { draft in
                    // A kept draft lands in the same store the Knowledge tab reads,
                    // so it is there the moment the student goes looking.
                    notes.accept(draft, from: model.meta.id)
                }
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Library") {
                                model.flush()
                                voice.stopIfSpeaking()
                                working = nil
                            }
                        }
                    }
            }
        }
        .sheet(item: $diagnosing) { model in
            DiagnosticView(model: model)
        }
        .onAppear(perform: connect)
    }

    /// Routes into a session, wired once so every entry point behaves identically.
    private func connect() {
        let practise: (ConceptID) -> Void = { concept in
            practising = makePractice(concept)
        }
        desk.onStartAction = { recommendation in
            // The one action that is not an intervention: when the model does not know
            // what is wrong, it asks rather than teaching the wrong thing.
            if recommendation.kind == .diagnostic {
                let model = makeDiagnostic([])
                model.onFix = practise
                diagnosing = model
                return
            }
            guard let concept = recommendation.conceptIDs.first else { return }
            practise(concept)
        }
        study.onStart = practise
        mistakes.onFix = practise
        study.onSitTest = { concepts in sitting = makeTest(concepts) }
        study.onDiagnose = { concepts in
            let model = makeDiagnostic(concepts)
            model.onFix = practise
            diagnosing = model
        }

        let open: (DocumentMeta) -> Void = { meta in
            working = makeWorkspace(meta)
        }
        library.onOpen = open
        desk.onOpenDocument = { _ in
            // The desk holds identifiers; the library holds the metadata, so opening
            // from a "continue" card goes through the same path as opening from Work.
            tab = .work
        }
        desk.onImport = { tab = .work }
    }

    @ViewBuilder
    private func content(for tab: Tab) -> some View {
        switch tab {
        case .desk:
            DeskView(model: desk)
        case .work:
            LibraryView(model: library)
        case .study:
            StudyView(model: study)
        case .knowledge:
            KnowledgeView(notes: notes, mistakes: mistakes)
        }
    }
}
#endif
