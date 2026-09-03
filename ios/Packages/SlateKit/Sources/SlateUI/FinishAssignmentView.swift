#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateDocuments
import SlateFoundation
import SlateModel

/// Finishing: review, export, send, done.
///
/// The whole flow is four steps and every one of them is reversible until the last.
/// Nothing is altered on the student's behalf at any point — the review reports and the
/// student decides, because this is their assignment and their handwriting.
public struct FinishAssignmentView: View {

    @ObservedObject var model: FinishModel
    @Environment(\.dismiss) private var dismiss

    public init(model: FinishModel) { self.model = model }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Slate.Space.xl) {
                    summary
                    review
                    filename
                    destination
                }
                .padding(Slate.Space.xl)
                .frame(maxWidth: Slate.Layout.readableWidth)
                .frame(maxWidth: .infinity)
            }
            .background(Slate.Palette.paper)
            .navigationTitle("Finish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { Task { await model.send() } }
                        .disabled(!model.canSend)
                }
            }
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: Slate.Space.s) {
            Text(model.title)
                .font(Slate.Typography.title)
                .foregroundStyle(Slate.Palette.ink)
            Text(model.progressDescription)
                .font(Slate.Typography.body)
                .foregroundStyle(Slate.Palette.inkSecondary)
        }
    }

    @ViewBuilder
    private var review: some View {
        VStack(alignment: .leading, spacing: Slate.Space.m) {
            SectionHeader("Before you send", trailing: model.isReviewing ? "checking…" : nil)

            Text(model.review.headline)
                .font(Slate.Typography.body)
                .foregroundStyle(Slate.Palette.ink)

            ForEach(model.review.findings) { finding in
                SlateCard(action: { model.jump(to: finding) }) {
                    HStack(alignment: .top, spacing: Slate.Space.m) {
                        Image(systemName: icon(for: finding.kind))
                            .foregroundStyle(finding.certain
                                ? Slate.Palette.partial : Slate.Palette.inkTertiary)
                        VStack(alignment: .leading, spacing: Slate.Space.xs) {
                            Text(finding.detail)
                                .font(Slate.Typography.body)
                                .foregroundStyle(Slate.Palette.ink)
                            if !finding.certain {
                                Text("Might be nothing — worth a glance.")
                                    .font(Slate.Typography.footnote)
                                    .foregroundStyle(Slate.Palette.inkTertiary)
                            }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.footnote)
                            .foregroundStyle(Slate.Palette.inkTertiary)
                    }
                }
            }

            // Deliberately absent: a "fix these for me" button. Silently altering a
            // student's submitted work is the one thing this screen must never do.
            if !model.review.isClear {
                Text("Nothing here has been changed. Go and look, then come back.")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
    }

    private var filename: some View {
        VStack(alignment: .leading, spacing: Slate.Space.s) {
            SectionHeader("File name")
            TextField("File name", text: $model.filename)
                .textFieldStyle(.plain)
                .font(Slate.Typography.mono)
                .padding(Slate.Space.m)
                .slateSurface()
            Text("\(model.pageCount) pages · \(model.sizeDescription)")
                .font(Slate.Typography.footnote)
                .foregroundStyle(Slate.Palette.inkTertiary)
        }
    }

    private var destination: some View {
        VStack(alignment: .leading, spacing: Slate.Space.s) {
            SectionHeader("Where it goes")
            Text("The iPad share sheet opens next. Mail, Files, AirDrop, or whatever your school uses.")
                .font(Slate.Typography.caption)
                .foregroundStyle(Slate.Palette.inkSecondary)
            if let error = model.problem {
                ProblemBanner(message: error) { Task { await model.prepare() } }
            }
        }
    }

    private func icon(for kind: FinalReview.Finding.Kind) -> String {
        switch kind {
        case .blankAnswer: "square.dashed"
        case .partialAnswer: "ellipsis"
        case .unreadable: "eye.slash"
        case .strayMark: "scribble"
        case .pageOutOfOrder: "arrow.up.arrow.down"
        case .missingPage: "doc.badge.plus"
        case .workingOffPage: "arrow.right.to.line"
        case .duplicatePage: "doc.on.doc"
        }
    }
}

/// State for finishing.
@MainActor
public final class FinishModel: ObservableObject, Identifiable {

    public nonisolated let id = UUID()

    @Published public var filename: String
    @Published public private(set) var review = FinalReview(findings: [])
    @Published public private(set) var isReviewing = false
    @Published public private(set) var exportedData: Data?
    @Published public private(set) var problem: String?

    public let title: String
    public let pageCount: Int
    private let map: QuestionMap
    private let store: DocumentStore
    private let meta: DocumentMeta
    private let clock: Clock

    public var onShare: ((Data, String) -> Void)?
    public var onJump: ((Int) -> Void)?
    /// Called with what was actually sent, so the assignment can keep the record.
    public var onSubmitted: ((Assignment.SubmissionRecord) -> Void)?

    /// Supplied by the workspace, which owns the ink and annotation layers. Keeping the
    /// compositing out of here means this screen cannot accidentally acquire the
    /// ability to change what it is about to send.
    private let composite: () async throws -> Data

    public var canSend: Bool { exportedData != nil && !isReviewing }

    public var progressDescription: String {
        let progress = map.progress
        guard progress.total > 0 else { return "\(pageCount) pages" }
        return progress.done == progress.total
            ? "All \(progress.total) questions have something written."
            : "\(progress.done) of \(progress.total) questions have something written."
    }

    public var sizeDescription: String {
        guard let bytes = exportedData?.count else { return "preparing…" }
        return ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }

    public init(meta: DocumentMeta, map: QuestionMap, store: DocumentStore,
                studentName: String?, clock: Clock = SystemClock(),
                composite: @escaping () async throws -> Data) {
        self.composite = composite
        self.meta = meta
        self.map = map
        self.store = store
        self.clock = clock
        title = meta.title
        pageCount = meta.pageCount
        filename = Exporter.suggestedFilename(
            subject: meta.subject, title: meta.title, studentName: studentName
        )
    }

    public func prepare() async {
        isReviewing = true
        problem = nil
        defer { isReviewing = false }

        // Checked before export. If the source has changed underneath us, the student's
        // answers may no longer line up with the pages, and they need to know before a
        // teacher sees it rather than after.
        do {
            try store.verifyOriginal(meta.id)
        } catch {
            problem = (error as? LocalizedError)?.errorDescription
                ?? "The original document could not be verified."
            return
        }

        review = FinalReview.local(map: map, strokeSummaries: [], pageCount: pageCount)

        do {
            exportedData = try await composite()
        } catch {
            exportedData = nil
            problem = (error as? LocalizedError)?.errorDescription
                ?? "The finished document could not be produced."
        }
    }

    public func send() async {
        guard let data = exportedData else { return }
        // A snapshot of exactly what was sent, so "what did I actually submit?" is
        // answerable months later without regenerating anything. Compositing the
        // handwriting again next year would not necessarily produce the same file.
        let version = try? store.snapshot(meta.id, kind: .submitted,
                                          label: filename, pdfData: data)
        if let version {
            onSubmitted?(Assignment.SubmissionRecord(
                at: clock.now, filename: filename, byteCount: data.count,
                pageCount: pageCount, fileURL: version.fileURL
            ))
        }
        onShare?(data, filename)
    }

    public func jump(to finding: FinalReview.Finding) { onJump?(finding.page) }
}
#endif
