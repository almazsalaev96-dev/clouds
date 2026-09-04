#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateDocuments
import SlateFoundation
import SlateLearning
import SlateModel

/// Work with deadlines, and what has already been sent.
///
/// Sorted by what is urgent rather than by what was created, because a list a student
/// has to scan to find Friday's worksheet is a list that has failed at its one job.
public struct AssignmentsView: View {

    @ObservedObject public var model: AssignmentsModel
    @State private var editing: Assignment?
    @State private var showingHistory = false

    public init(model: AssignmentsModel) { self.model = model }

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Slate.Space.xl) {
                if model.assignments.isEmpty {
                    EmptyStateView(
                        icon: "calendar",
                        title: "No deadlines yet",
                        detail: "Add one and Slate can weigh it against everything else — a worksheet due tomorrow should beat optional revision, and it cannot know that on its own.",
                        actionLabel: "Add an assignment",
                        action: { editing = model.blank() }
                    )
                    .frame(minHeight: 300)
                } else {
                    ForEach(model.groups, id: \.title) { group in
                        VStack(alignment: .leading, spacing: Slate.Space.m) {
                            SectionHeader(group.title, trailing: "\(group.assignments.count)")
                            ForEach(group.assignments) { assignment in
                                AssignmentCard(
                                    assignment: assignment,
                                    progress: model.progress(for: assignment),
                                    now: model.now
                                ) { editing = assignment }
                            }
                        }
                    }
                }

                if model.hasSubmissions {
                    Button {
                        showingHistory = true
                    } label: {
                        Label("What you have already sent", systemImage: "paperplane")
                            .font(Slate.Typography.footnote.weight(.medium))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Slate.Palette.tutor)
                }
            }
            .padding(Slate.Space.xl)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Slate.Palette.paper)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = model.blank() } label: {
                    Label("Add", systemImage: "plus")
                }
            }
        }
        .sheet(item: $editing) { assignment in
            AssignmentEditor(assignment: assignment, documents: model.documents) { edited in
                model.save(edited)
                editing = nil
            } delete: {
                model.delete(assignment)
                editing = nil
            }
        }
        .sheet(isPresented: $showingHistory) {
            SubmissionHistoryView(entries: model.submissionHistory)
        }
        .task { model.refresh() }
    }
}

struct AssignmentCard: View {
    let assignment: Assignment
    let progress: (done: Int, total: Int)
    let now: Date
    let open: () -> Void

    var body: some View {
        SlateCard(action: open) {
            VStack(alignment: .leading, spacing: Slate.Space.s) {
                HStack(spacing: Slate.Space.s) {
                    Text(assignment.title.isEmpty ? "Untitled" : assignment.title)
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    Spacer(minLength: 0)
                    Text(assignment.dueDescription(now: now))
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(tint)
                }

                HStack(spacing: Slate.Space.s) {
                    if !assignment.subject.isEmpty {
                        Text(assignment.subject)
                    }
                    if let teacher = assignment.teacher, !teacher.isEmpty {
                        Text("· \(teacher)")
                    }
                    if progress.total > 0 {
                        Text("· \(progress.done)/\(progress.total) questions")
                    }
                }
                .font(Slate.Typography.footnote)
                .foregroundStyle(Slate.Palette.inkTertiary)

                if progress.total > 0 {
                    Capsule()
                        .fill(Slate.Palette.hairline)
                        .frame(height: 4)
                        .overlay(alignment: .leading) {
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(Slate.Palette.tutor)
                                    .frame(width: proxy.size.width
                                        * Double(progress.done) / Double(max(1, progress.total)))
                            }
                        }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(assignment.title), \(assignment.dueDescription(now: now))")
    }

    private var tint: Color {
        if assignment.isOverdue { return Slate.Palette.incorrect }
        guard let due = assignment.dueAt else { return Slate.Palette.inkTertiary }
        return due.timeIntervalSince(now) < 36 * 3600
            ? Slate.Palette.dueSoon : Slate.Palette.inkSecondary
    }
}

struct AssignmentEditor: View {
    @State private var draft: Assignment
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @Environment(\.dismiss) private var dismiss

    let documents: [DocumentMeta]
    let save: (Assignment) -> Void
    let delete: () -> Void

    init(assignment: Assignment, documents: [DocumentMeta],
         save: @escaping (Assignment) -> Void, delete: @escaping () -> Void) {
        _draft = State(initialValue: assignment)
        _hasDueDate = State(initialValue: assignment.dueAt != nil)
        // Default to tomorrow evening rather than now: an assignment due in zero
        // seconds is nobody's intention and would read as overdue immediately.
        _dueDate = State(initialValue: assignment.dueAt
            ?? Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date())
        self.documents = documents
        self.save = save
        self.delete = delete
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $draft.title)
                    TextField("Subject", text: $draft.subject)
                    TextField("Teacher (optional)", text: Binding(
                        get: { draft.teacher ?? "" },
                        set: { draft.teacher = $0.isEmpty ? nil : $0 }
                    ))
                }

                Section {
                    Toggle("Has a due date", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker("Due", selection: $dueDate)
                    }
                } footer: {
                    // Said plainly, because the effect is invisible otherwise and it is
                    // the main reason to bother filling this in.
                    Text("With a due date, Slate can put this ahead of optional revision as the deadline gets close. Without one, it cannot tell.")
                }

                if !documents.isEmpty {
                    Section("Pages") {
                        ForEach(documents) { document in
                            Button {
                                toggle(document.id)
                            } label: {
                                HStack {
                                    Text(document.title)
                                        .foregroundStyle(Slate.Palette.ink)
                                    Spacer()
                                    if draft.documentIDs.contains(document.id) {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(Slate.Palette.tutor)
                                    }
                                }
                            }
                        }
                    }
                }

                Section("Status") {
                    Picker("Status", selection: Binding(
                        get: { draft.declaredStatus },
                        set: { draft.declaredStatus = $0 }
                    )) {
                        Text("Work it out from my pages").tag(Assignment.Status?.none)
                        ForEach(Assignment.Status.allCases, id: \.self) { status in
                            Text(status.label).tag(Assignment.Status?.some(status))
                        }
                    }
                }

                if !draft.submissions.isEmpty {
                    Section("Sent") {
                        ForEach(draft.submissions) { record in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.filename)
                                    .font(Slate.Typography.footnote)
                                Text(record.at.formatted(date: .abbreviated, time: .shortened))
                                    .font(Slate.Typography.footnote)
                                    .foregroundStyle(Slate.Palette.inkTertiary)
                            }
                        }
                    }
                }

                Section {
                    Button("Delete this assignment", role: .destructive, action: delete)
                }
            }
            .navigationTitle(draft.title.isEmpty ? "Assignment" : draft.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        draft.dueAt = hasDueDate ? dueDate : nil
                        save(draft)
                    }
                    .disabled(draft.title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func toggle(_ id: DocumentID) {
        if let index = draft.documentIDs.firstIndex(of: id) {
            draft.documentIDs.remove(at: index)
        } else {
            draft.documentIDs.append(id)
        }
    }
}

/// What was actually sent, kept because regenerating it would not be the same file.
struct SubmissionHistoryView: View {
    let entries: [(assignment: Assignment, record: Assignment.SubmissionRecord)]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(entries, id: \.record.id) { entry in
                    VStack(alignment: .leading, spacing: Slate.Space.xs) {
                        Text(entry.assignment.title)
                            .font(Slate.Typography.bodyEmphasis)
                            .foregroundStyle(Slate.Palette.ink)
                        Text(entry.record.filename)
                            .font(Slate.Typography.mono)
                            .foregroundStyle(Slate.Palette.inkSecondary)
                        HStack(spacing: Slate.Space.s) {
                            Text(entry.record.at.formatted(date: .abbreviated, time: .shortened))
                            Text("· \(entry.record.pageCount) pages")
                            Text("· \(ByteCountFormatter.string(fromByteCount: Int64(entry.record.byteCount), countStyle: .file))")
                            if let destination = entry.record.destination {
                                Text("· \(destination)")
                            }
                        }
                        .font(Slate.Typography.footnote)
                        .foregroundStyle(Slate.Palette.inkTertiary)

                        // The exact bytes, not a regeneration. Handwriting composited
                        // today would not necessarily match what the teacher opened.
                        ShareLink(item: entry.record.fileURL) {
                            Label("Open what was sent", systemImage: "doc")
                                .font(Slate.Typography.footnote.weight(.medium))
                        }
                    }
                    .padding(.vertical, Slate.Space.xs)
                }
            }
            .navigationTitle("Sent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
#endif
