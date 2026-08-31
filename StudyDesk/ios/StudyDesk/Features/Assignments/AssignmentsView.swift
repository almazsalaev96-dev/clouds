import SwiftUI
import SwiftData

/// Everything with a deadline, and the record of what was handed in.
struct AssignmentsView: View {

    let open: (StudyDocument) -> Void

    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Assignment.dueDate) private var assignments: [Assignment]

    @State private var filter: Filter = .open

    enum Filter: String, CaseIterable, Identifiable {
        case open = "To do"
        case submitted = "Submitted"
        case all = "All"
        var id: String { rawValue }
    }

    private var visible: [Assignment] {
        switch filter {
        case .open: assignments.filter { $0.status != .submitted }
        case .submitted: assignments.filter { $0.status == .submitted }
        case .all: assignments
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.l) {
                Picker("Show", selection: $filter) {
                    ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                if visible.isEmpty {
                    EmptyStateView(
                        icon: "checklist",
                        title: filter == .submitted ? "Nothing submitted yet" : "No assignments",
                        message: filter == .submitted
                            ? "When you finish a worksheet and send it, it'll be listed here with the exact file you sent."
                            : "Open a worksheet and tap Finish when you're done — Study Desk turns it into an assignment for you."
                    )
                } else {
                    ForEach(visible) { assignment in
                        NavigationLink {
                            AssignmentDetailView(assignment: assignment, open: open)
                        } label: {
                            AssignmentRow(assignment: assignment)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(Theme.Space.xl)
        }
        .background(Theme.Palette.background)
        .navigationTitle("Assignments")
    }
}

/// One assignment: its worksheet, its deadline, and its submission history.
struct AssignmentDetailView: View {

    @Bindable var assignment: Assignment
    let open: (StudyDocument) -> Void

    @Environment(AppEnvironment.self) private var app
    @Environment(\.modelContext) private var modelContext
    @State private var sharingURL: URL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.xl) {
                DeskCard {
                    VStack(alignment: .leading, spacing: Theme.Space.m) {
                        TextField("Title", text: $assignment.title)
                            .font(Theme.Text.title)
                            .textFieldStyle(.plain)

                        LabeledContent("Subject", value: assignment.subject.name)
                        LabeledContent("Status", value: assignment.status.title)

                        DatePicker(
                            "Due",
                            selection: Binding(
                                get: { assignment.dueDate ?? Date() },
                                set: { assignment.dueDate = $0 }
                            ),
                            displayedComponents: .date
                        )

                        TextField("Teacher (optional)", text: Binding(
                            get: { assignment.teacherName ?? "" },
                            set: { assignment.teacherName = $0.trimmedNonEmpty }
                        ))
                        .textFieldStyle(.roundedBorder)
                    }
                }

                if let document = assignment.document {
                    Button {
                        open(document)
                    } label: {
                        Label("Open worksheet", systemImage: "doc.text")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }

                if !assignment.submissions.isEmpty {
                    VStack(alignment: .leading, spacing: Theme.Space.m) {
                        SectionHeader(
                            title: "Submission history",
                            subtitle: "The exact files you sent, kept so you can check or resend."
                        )
                        ForEach(assignment.submissions.sorted { $0.exportedAt > $1.exportedAt }) { submission in
                            submissionRow(submission)
                        }
                    }
                }
            }
            .padding(Theme.Space.xl)
        }
        .background(Theme.Palette.background)
        .navigationTitle(assignment.title)
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { try? modelContext.save() }
        .sheet(item: Binding(
            get: { sharingURL.map(IdentifiableURL.init) },
            set: { sharingURL = $0?.url }
        )) { wrapper in
            ShareSheet(items: [wrapper.url])
        }
    }

    private func submissionRow(_ submission: Submission) -> some View {
        DeskCard(padding: Theme.Space.m) {
            HStack(spacing: Theme.Space.m) {
                Image(systemName: submission.sharedAt == nil ? "doc" : "paperplane.fill")
                    .foregroundStyle(submission.sharedAt == nil ? Theme.Palette.textSecondary : Theme.Palette.success)

                VStack(alignment: .leading, spacing: 2) {
                    Text(submission.displayName)
                        .font(Theme.Text.caption)
                        .lineLimit(1)
                    Text("\(submission.versionLabel) · \(submission.pageCount) pages · \(submission.formattedSize) · \(submission.exportedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(Theme.Text.label)
                        .foregroundStyle(Theme.Palette.textSecondary)
                }

                Spacer()

                Button {
                    let url = app.store.url(submission.storageName, in: .submissions)
                    guard FileManager.default.fileExists(atPath: url.path) else { return }
                    sharingURL = url
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Share again")
            }
        }
    }
}

/// `sheet(item:)` needs `Identifiable`, and `URL` isn't.
struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
