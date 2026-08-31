import SwiftUI
import SwiftData

/// One subject's documents.
struct SubjectLibraryView: View {

    let subject: Subject
    let open: (StudyDocument) -> Void

    @Environment(\.modelContext) private var modelContext
    @Query(filter: #Predicate<StudyDocument> { $0.deletedAt == nil })
    private var allDocuments: [StudyDocument]

    private var documents: [StudyDocument] {
        allDocuments
            .filter { $0.subjectName == subject.name }
            .sorted { ($0.lastOpenedAt ?? $0.createdAt) > ($1.lastOpenedAt ?? $1.createdAt) }
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 220, maximum: 300), spacing: Theme.Space.l)], spacing: Theme.Space.l) {
                ForEach(documents) { document in
                    DocumentCard(document: document) {
                        document.lastOpenedAt = Date()
                        try? modelContext.save()
                        open(document)
                    }
                }
            }
            .padding(Theme.Space.xl)
        }
        .background(Theme.Palette.background)
        .navigationTitle(subject.name)
    }
}

/// Deleted work, recoverable for 30 days.
///
/// Nothing here is gone: the PDF is still on disk and the ink is still in the
/// database. A student who deletes the wrong worksheet the night before it's
/// due gets it back.
struct RecentlyDeletedView: View {

    @Environment(AppEnvironment.self) private var app
    @Environment(\.modelContext) private var modelContext
    @Query(filter: #Predicate<StudyDocument> { $0.deletedAt != nil },
           sort: \StudyDocument.deletedAt, order: .reverse)
    private var documents: [StudyDocument]

    var body: some View {
        Group {
            if documents.isEmpty {
                EmptyStateView(
                    icon: "trash",
                    title: "Nothing deleted",
                    message: "Documents you delete stay here for 30 days before they're removed for good."
                )
            } else {
                List {
                    Section {
                        ForEach(documents) { document in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(document.title).font(Theme.Text.bodyEmphasis)
                                    if let deletedAt = document.deletedAt {
                                        Text("Deleted \(deletedAt.formatted(date: .abbreviated, time: .omitted)) · removed in \(daysRemaining(from: deletedAt)) days")
                                            .font(Theme.Text.label)
                                            .foregroundStyle(Theme.Palette.textSecondary)
                                    }
                                }
                                Spacer()
                                Button("Restore") {
                                    document.deletedAt = nil
                                    try? modelContext.save()
                                }
                                .font(Theme.Text.label)
                            }
                            .swipeActions {
                                Button("Delete now", role: .destructive) {
                                    app.store.delete(document.storageName, in: .originals)
                                    modelContext.delete(document)
                                    try? modelContext.save()
                                }
                            }
                        }
                    } footer: {
                        Text("Your handwriting is restored with the document.")
                    }
                }
            }
        }
        .navigationTitle("Recently Deleted")
    }

    private func daysRemaining(from deletedAt: Date) -> Int {
        let expiry = Calendar.current.date(byAdding: .day, value: 30, to: deletedAt) ?? deletedAt
        return max(0, Calendar.current.dateComponents([.day], from: Date(), to: expiry).day ?? 0)
    }
}

/// Typed and handwritten notes, optionally linked to a worksheet page.
struct NotesView: View {

    @Environment(\.modelContext) private var modelContext
    @Query(sort: \StudyNote.updatedAt, order: .reverse) private var notes: [StudyNote]
    @State private var selected: StudyNote?

    var body: some View {
        Group {
            if notes.isEmpty {
                EmptyStateView(
                    icon: "note.text",
                    title: "No notes yet",
                    message: "Notes are for the things worth keeping after the worksheet is handed in — a method, a definition, a mistake you don't want to make twice.",
                    actionTitle: "New note",
                    action: newNote
                )
            } else {
                List(notes) { note in
                    Button {
                        selected = note
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(note.title.isEmpty ? "Untitled note" : note.title)
                                .font(Theme.Text.bodyEmphasis)
                            Text(note.body.isEmpty ? note.subject.name : note.body)
                                .font(Theme.Text.caption)
                                .foregroundStyle(Theme.Palette.textSecondary)
                                .lineLimit(2)
                        }
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Notes")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: newNote) { Image(systemName: "square.and.pencil") }
                    .accessibilityLabel("New note")
            }
        }
        .sheet(item: $selected) { note in
            NoteEditorView(note: note)
        }
    }

    private func newNote() {
        let note = StudyNote(title: "")
        modelContext.insert(note)
        try? modelContext.save()
        selected = note
    }
}

struct NoteEditorView: View {

    @Bindable var note: StudyNote
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $note.title)
                Picker("Subject", selection: Binding(
                    get: { note.subject.name },
                    set: { note.subjectName = $0 }
                )) {
                    ForEach(Subject.builtIn) { Text($0.name).tag($0.name) }
                    Text(Subject.unspecified.name).tag(Subject.unspecified.name)
                }
                Section("Note") {
                    TextEditor(text: $note.body)
                        .frame(minHeight: 240)
                }
            }
            .navigationTitle("Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        note.updatedAt = Date()
                        try? modelContext.save()
                        dismiss()
                    }
                }
            }
        }
    }
}
