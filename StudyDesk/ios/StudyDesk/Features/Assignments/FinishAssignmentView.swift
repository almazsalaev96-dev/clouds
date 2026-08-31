import SwiftUI
import SwiftData
import PencilKit

/// Finishing a worksheet: review, export, share, and a record of what was sent.
///
/// The flow exists because "my work is in the app" is not the same as "my
/// teacher has my work", and every step between those two is where a student
/// loses marks. Each stage is reversible and nothing is sent until the student
/// has seen exactly what they're sending.
struct FinishAssignmentView: View {

    let document: StudyDocument
    let drawings: [Int: PKDrawing]

    @Environment(AppEnvironment.self) private var app
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var stage: Stage = .review
    @State private var studentName = UserDefaults.standard.string(forKey: "student.name") ?? ""
    @State private var fileName = ""
    @State private var includeHeader = true
    @State private var exported: ExportedFile?
    @State private var isExporting = false
    @State private var isSharing = false
    @State private var errorMessage: String?

    enum Stage {
        case review
        case ready
    }

    struct ExportedFile: Identifiable {
        let id = UUID()
        let url: URL
        let storageName: String
        let pageCount: Int
        let byteCount: Int
    }

    var body: some View {
        NavigationStack {
            Group {
                switch stage {
                case .review: reviewStage
                case .ready: readyStage
                }
            }
            .background(Theme.Palette.background)
            .navigationTitle(stage == .review ? "Final review" : "Ready to send")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .sheet(isPresented: $isSharing) {
            if let file = exported {
                ShareSheet(items: [file.url]) { completed in
                    isSharing = false
                    if completed { recordShared(file) }
                }
            }
        }
        .alert("Couldn't finish", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .onAppear {
            fileName = PDFExporter.suggestedFileName(
                subject: document.subject.name,
                title: document.title,
                studentName: studentName.trimmedNonEmpty
            )
        }
    }

    // MARK: Review

    private var checks: [Check] {
        let worked = drawings.filter { !$0.value.strokes.isEmpty }.count
        let blank = max(0, document.pageCount - worked)
        return [
            Check(
                passed: blank == 0,
                title: blank == 0 ? "Every page has your writing on it" : "\(blank) page\(blank == 1 ? "" : "s") with nothing written",
                detail: blank == 0 ? nil : "That's fine if they're question sheets — worth a look if they're not."
            ),
            Check(passed: true, title: "Your work is saved", detail: nil),
            Check(
                passed: document.pageCount > 0,
                title: "\(document.pageCount) page\(document.pageCount == 1 ? "" : "s") will be exported",
                detail: "Handwriting, highlights and the original worksheet, in one PDF."
            )
        ]
    }

    private var reviewStage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.xl) {
                DeskCard {
                    VStack(alignment: .leading, spacing: Theme.Space.m) {
                        Text(document.title).font(Theme.Text.title)
                        Text(document.subject.name)
                            .font(Theme.Text.caption)
                            .foregroundStyle(Theme.Palette.textSecondary)
                        ProgressBar(value: document.progress, tint: document.subject.tint)
                        Text("\(drawings.filter { !$0.value.strokes.isEmpty }.count) of \(document.pageCount) pages worked on")
                            .font(Theme.Text.numeric)
                            .foregroundStyle(Theme.Palette.textSecondary)
                    }
                }

                VStack(alignment: .leading, spacing: Theme.Space.m) {
                    SectionHeader(title: "Before you send")
                    ForEach(checks) { check in
                        HStack(alignment: .top, spacing: Theme.Space.m) {
                            Image(systemName: check.passed ? "checkmark.circle.fill" : "exclamationmark.circle")
                                .foregroundStyle(check.passed ? Theme.Palette.success : Theme.Palette.warning)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(check.title).font(Theme.Text.caption)
                                if let detail = check.detail {
                                    Text(detail)
                                        .font(Theme.Text.label)
                                        .foregroundStyle(Theme.Palette.textSecondary)
                                }
                            }
                            Spacer()
                        }
                    }
                }

                VStack(alignment: .leading, spacing: Theme.Space.m) {
                    SectionHeader(title: "Your name on the page", subtitle: "Optional — printed small, top right of page one.")
                    TextField("Name", text: $studentName)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: studentName) { _, name in
                            UserDefaults.standard.set(name, forKey: "student.name")
                            fileName = PDFExporter.suggestedFileName(
                                subject: document.subject.name,
                                title: document.title,
                                studentName: name.trimmedNonEmpty
                            )
                        }
                    Toggle("Add name and date to the first page", isOn: $includeHeader)
                        .font(Theme.Text.caption)
                }

                Button(action: exportNow) {
                    if isExporting {
                        ProgressView().tint(.white)
                    } else {
                        Text("Create the PDF")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isExporting)
                .frame(maxWidth: .infinity)
            }
            .padding(Theme.Space.xl)
        }
    }

    // MARK: Ready

    @ViewBuilder
    private var readyStage: some View {
        if let exported {
            ScrollView {
                VStack(spacing: Theme.Space.xl) {
                    VStack(spacing: Theme.Space.s) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(Theme.Palette.success)
                        Text("Your PDF is ready")
                            .font(Theme.Text.title)
                        Text("Nothing has been sent yet.")
                            .font(Theme.Text.caption)
                            .foregroundStyle(Theme.Palette.textSecondary)
                    }
                    .padding(.top, Theme.Space.l)

                    DeskCard {
                        VStack(alignment: .leading, spacing: Theme.Space.m) {
                            SectionHeader(title: "What you're sending")
                            LabeledContent("File name") {
                                TextField("File name", text: $fileName)
                                    .multilineTextAlignment(.trailing)
                                    .font(Theme.Text.caption)
                            }
                            LabeledContent("Pages", value: "\(exported.pageCount)")
                            LabeledContent("Size", value: ByteCountFormatter.string(fromByteCount: Int64(exported.byteCount), countStyle: .file))
                            LabeledContent("Subject", value: document.subject.name)
                        }
                    }

                    VStack(spacing: Theme.Space.m) {
                        Button {
                            isSharing = true
                        } label: {
                            Label("Send to teacher", systemImage: "paperplane.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())

                        Button("Back to my worksheet") { dismiss() }
                            .buttonStyle(SecondaryButtonStyle())
                            .frame(maxWidth: .infinity)
                    }

                    Text("Your original worksheet is untouched. This PDF is a separate copy, kept in Submitted.")
                        .font(Theme.Text.label)
                        .foregroundStyle(Theme.Palette.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .padding(Theme.Space.xl)
            }
        }
    }

    // MARK: Actions

    private func exportNow() {
        isExporting = true
        defer { isExporting = false }

        guard let pdf = app.store.loadPDF(document.storageName) else {
            errorMessage = StudyDeskError.exportFailed.errorDescription
            return
        }

        do {
            let options = PDFExporter.Options(
                studentName: includeHeader ? studentName.trimmedNonEmpty : nil,
                subject: includeHeader ? document.subject.name : nil,
                assignmentTitle: includeHeader ? document.title : nil,
                date: includeHeader ? Date() : nil
            )
            let result = try PDFExporter.export(pdf: pdf, drawings: drawings, options: options)

            // Kept in the store, not just handed to the share sheet: a student
            // must be able to answer "what exactly did I hand in?" next term.
            let storageName = try app.store.write(
                result.data,
                named: DocumentStore.sanitize(fileName),
                into: .submissions
            )
            let url = app.store.url(storageName, in: .submissions)

            recordSubmission(storageName: storageName, result: result)

            exported = ExportedFile(
                url: url,
                storageName: storageName,
                pageCount: result.pageCount,
                byteCount: result.data.count
            )
            stage = .ready
        } catch {
            errorMessage = (error as? StudyDeskError)?.errorDescription
                ?? StudyDeskError.exportFailed.errorDescription
        }
    }

    @discardableResult
    private func recordSubmission(storageName: String, result: PDFExporter.Result) -> Submission {
        let assignment = document.assignment ?? {
            let created = Assignment(title: document.title, subject: document.subject)
            created.document = document
            modelContext.insert(created)
            document.assignment = created
            return created
        }()

        let version = "Version \(assignment.submissions.count + 1)"
        let submission = Submission(
            storageName: storageName,
            displayName: fileName,
            pageCount: result.pageCount,
            byteCount: result.data.count,
            versionLabel: version
        )
        submission.assignment = assignment
        modelContext.insert(submission)
        assignment.submissions.append(submission)
        assignment.status = .completed
        assignment.completedAt = Date()
        try? modelContext.save()
        return submission
    }

    /// Only once the share sheet actually completes does the assignment become
    /// "Submitted". Opening the sheet and backing out is not submitting.
    private func recordShared(_ file: ExportedFile) {
        guard let assignment = document.assignment else { return }
        if let submission = assignment.submissions.first(where: { $0.storageName == file.storageName }) {
            submission.sharedAt = Date()
        }
        assignment.status = .submitted
        try? modelContext.save()
        dismiss()
    }

    private struct Check: Identifiable {
        let passed: Bool
        let title: String
        let detail: String?
        var id: String { title }
    }
}
