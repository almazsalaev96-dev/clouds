#if canImport(SwiftUI)
import SwiftUI
import SlateAI
import SlateDesign
import SlateDocuments
import SlateFoundation
import SlateModel

/// Notes.
///
/// One list, searchable, with the tutor's drafts clearly marked as drafts until they
/// are kept. The rule that shapes this screen: nothing the student wrote is ever
/// replaced by something they did not ask for.
public struct NotesView: View {

    @ObservedObject public var model: NotesModel
    @State private var editing: Note?

    public init(model: NotesModel) { self.model = model }

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Slate.Space.m) {
                if model.notes.isEmpty && model.query.isEmpty {
                    EmptyStateView(
                        icon: "note.text",
                        title: "No notes yet",
                        detail: "Write one here, or ask the tutor to turn a page you have been working on into revision notes. You decide whether to keep what it drafts.",
                        actionLabel: "Write a note",
                        action: { editing = model.blankNote() }
                    )
                    .frame(minHeight: 300)
                } else if model.notes.isEmpty {
                    Text("Nothing matches “\(model.query)”.")
                        .font(Slate.Typography.body)
                        .foregroundStyle(Slate.Palette.inkSecondary)
                        .padding(.top, Slate.Space.xl)
                } else {
                    ForEach(model.notes) { note in
                        NoteRow(note: note) { editing = note }
                    }
                }
            }
            .padding(Slate.Space.xl)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Slate.Palette.paper)
        .searchable(text: $model.query, prompt: "Search your notes")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = model.blankNote() } label: {
                    Label("New note", systemImage: "square.and.pencil")
                }
            }
        }
        .sheet(item: $editing) { note in
            NoteEditor(note: note) { edited in
                model.save(edited)
                editing = nil
            } delete: {
                model.delete(note)
                editing = nil
            }
        }
        .task { model.refresh() }
    }
}

struct NoteRow: View {
    let note: Note
    let open: () -> Void

    var body: some View {
        SlateCard(action: open) {
            VStack(alignment: .leading, spacing: Slate.Space.xs) {
                HStack(spacing: Slate.Space.s) {
                    if note.isPinned {
                        Image(systemName: "pin.fill")
                            .imageScale(.small)
                            .foregroundStyle(Slate.Palette.inkTertiary)
                    }
                    Text(note.title.isEmpty ? "Untitled" : note.title)
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    Spacer(minLength: 0)
                    Text(note.origin.label)
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)
                }
                Text(note.preview)
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkSecondary)
                    .lineLimit(2)
                if !note.addedByTutor.isEmpty {
                    // Marked permanently, not just at the moment of accepting. A
                    // student revising in three weeks needs to know which lines came
                    // from their worksheet and which did not.
                    Label("\(note.addedByTutor.count) line\(note.addedByTutor.count == 1 ? "" : "s") the tutor added",
                          systemImage: "info.circle")
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.partial)
                }
            }
        }
    }
}

/// Editing a note. Typed only — handwriting lives on the page it was written on, and a
/// second ink surface here would be a worse version of the workspace.
struct NoteEditor: View {
    @State private var draft: Note
    @Environment(\.dismiss) private var dismiss
    let save: (Note) -> Void
    let delete: () -> Void

    init(note: Note, save: @escaping (Note) -> Void, delete: @escaping () -> Void) {
        _draft = State(initialValue: note)
        self.save = save
        self.delete = delete
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $draft.title)
                        .font(Slate.Typography.bodyEmphasis)
                }

                ForEach($draft.sections) { $section in
                    Section(section.heading) {
                        ForEach(section.points.indices, id: \.self) { index in
                            TextField("Point", text: $section.points[index], axis: .vertical)
                                .font(Slate.Typography.body)
                        }
                    }
                }

                Section("Your own notes") {
                    TextField("Anything you want to add", text: $draft.body, axis: .vertical)
                        .lineLimit(4...20)
                        .font(Slate.Typography.body)
                }

                if !draft.addedByTutor.isEmpty {
                    Section {
                        ForEach(draft.addedByTutor, id: \.self) { line in
                            Text(line)
                                .font(Slate.Typography.footnote)
                                .foregroundStyle(Slate.Palette.inkSecondary)
                        }
                    } header: {
                        Text("Added by the tutor")
                    } footer: {
                        Text("These were not in the material this note was made from.")
                    }
                }

                Section {
                    Toggle("Keep at the top", isOn: $draft.isPinned)
                    Button("Delete this note", role: .destructive, action: delete)
                }
            }
            .navigationTitle(draft.title.isEmpty ? "Note" : draft.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save(draft) }
                        .disabled(draft.isEmpty && draft.title.isEmpty)
                }
            }
        }
    }
}

@MainActor
public final class NotesModel: ObservableObject {

    @Published public private(set) var all: [Note] = []
    @Published public var query = "" { didSet { refresh() } }

    public var notes: [Note] {
        query.isEmpty ? all : store.search(query)
    }

    private let store: NoteStore
    private let clock: Clock

    public init(store: NoteStore, clock: Clock = SystemClock()) {
        self.store = store
        self.clock = clock
    }

    public func refresh() { all = store.sorted() }

    public func blankNote() -> Note {
        Note(title: "", createdAt: clock.now)
    }

    public func save(_ note: Note) {
        try? store.save(note)
        refresh()
    }

    public func delete(_ note: Note) {
        try? store.delete(note.id)
        refresh()
    }

    /// Keep a tutor draft. The only path from a draft to a note, and it always adds.
    public func accept(_ draft: RevisionNotes, from document: DocumentID?) {
        let note = Note(
            title: draft.title,
            sections: draft.sections.map { .init(heading: $0.heading, points: $0.points) },
            conceptIDs: draft.conceptIDs,
            origin: .draftedFrom(document: document, title: draft.title),
            addedByTutor: draft.addedBeyondTheSource,
            createdAt: clock.now
        )
        try? store.accept(draft: note)
        refresh()
    }
}
#endif
