#if canImport(SwiftUI)
import SwiftUI
import SlateDesign

/// Knowledge: what you wrote down, and what you got wrong.
///
/// Two halves of the same thing. Notes are what you decided was worth keeping; mistakes
/// are what the work decided for you. Keeping them one tab apart rather than one tab
/// each is the whole point — revision starts in one and ends in the other.
public struct KnowledgeView: View {

    public enum Half: String, CaseIterable, Identifiable {
        case notes, mistakes
        public var id: String { rawValue }
        var label: String { self == .notes ? "Notes" : "Mistakes" }
    }

    @State private var half: Half = .notes
    @ObservedObject private var notes: NotesModel
    @ObservedObject private var mistakes: MistakesModel

    public init(notes: NotesModel, mistakes: MistakesModel) {
        _notes = ObservedObject(wrappedValue: notes)
        _mistakes = ObservedObject(wrappedValue: mistakes)
    }

    public var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $half) {
                ForEach(Half.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Slate.Space.xl)
            .padding(.vertical, Slate.Space.m)

            switch half {
            case .notes: NotesView(model: notes)
            case .mistakes: MistakesView(model: mistakes)
            }
        }
        .background(Slate.Palette.paper)
    }
}
#endif

#if canImport(SwiftUI)
/// Work: what is due, and everything you have.
public struct WorkView: View {

    public enum Half: String, CaseIterable, Identifiable {
        case due, library
        public var id: String { rawValue }
        var label: String { self == .due ? "Due" : "Library" }
    }

    @State private var half: Half = .due
    @ObservedObject private var library: LibraryModel
    @ObservedObject private var assignments: AssignmentsModel

    public init(library: LibraryModel, assignments: AssignmentsModel) {
        _library = ObservedObject(wrappedValue: library)
        _assignments = ObservedObject(wrappedValue: assignments)
    }

    public var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $half) {
                ForEach(Half.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Slate.Space.xl)
            .padding(.vertical, Slate.Space.m)

            switch half {
            case .due: AssignmentsView(model: assignments)
            case .library: LibraryView(model: library)
            }
        }
        .background(Slate.Palette.paper)
        // Land on the library when nothing is due: an empty deadline list is not the
        // first thing someone opening Work wants to see.
        .onAppear { if assignments.assignments.isEmpty { half = .library } }
    }
}
#endif
