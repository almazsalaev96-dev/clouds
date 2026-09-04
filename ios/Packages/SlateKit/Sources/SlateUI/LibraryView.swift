#if canImport(SwiftUI)
import SwiftUI
import UniformTypeIdentifiers
import SlateAI
import SlateDesign
import SlateDocuments
import SlateFoundation
import SlateModel

/// Work: everything the student has brought in.
///
/// Importing is the first thing anyone does and the thing they do most, so it is one
/// tap and the document opens immediately. Analysis happens behind them while they are
/// already writing — a progress bar between a student and their worksheet is a
/// progress bar they will learn to resent.
public struct LibraryView: View {

    @ObservedObject public var model: LibraryModel
    @State private var isPicking = false

    public init(model: LibraryModel) { self.model = model }

    public var body: some View {
        Group {
            if model.documents.isEmpty {
                EmptyStateView(
                    icon: "tray.and.arrow.down",
                    title: "Nothing here yet",
                    detail: "Bring in a worksheet, a past paper, or a photo of a page. You can start writing on it straight away.",
                    actionLabel: "Add something",
                    action: { isPicking = true }
                )
            } else {
                list
            }
        }
        .background(Slate.Palette.paper)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { isPicking = true } label: { Label("Add", systemImage: "plus") }
            }
        }
        .fileImporter(isPresented: $isPicking,
                      allowedContentTypes: [.pdf, .image],
                      allowsMultipleSelection: true) { result in
            Task { await model.handle(result) }
        }
        .task { await model.refresh() }
        .refreshable { await model.refresh() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Slate.Space.xl) {
                if let problem = model.problem {
                    ProblemBanner(message: problem) { model.dismissProblem() }
                }
                ForEach(model.subjects, id: \.name) { subject in
                    VStack(alignment: .leading, spacing: Slate.Space.m) {
                        SectionHeader(subject.name, trailing: "\(subject.documents.count)")
                        ForEach(subject.documents) { document in
                            DocumentRow(
                                document: document,
                                status: model.status(for: document.id),
                                open: { model.open(document) },
                                trash: { Task { await model.trash(document) } }
                            )
                        }
                    }
                }
            }
            .padding(Slate.Space.xl)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }
}

struct DocumentRow: View {
    let document: DocumentMeta
    let status: LibraryModel.AnalysisStatus
    let open: () -> Void
    let trash: () -> Void

    var body: some View {
        SlateCard(action: open) {
            HStack(spacing: Slate.Space.m) {
                VStack(alignment: .leading, spacing: Slate.Space.xs) {
                    Text(document.title)
                        .font(Slate.Typography.bodyEmphasis)
                        .foregroundStyle(Slate.Palette.ink)
                    HStack(spacing: Slate.Space.s) {
                        Text("\(document.pageCount) pages")
                        if case .analysing = status {
                            // Stated quietly and never blocking. The document is
                            // already open and writable while this runs.
                            Text("· reading the questions")
                        }
                        if case .failed = status {
                            Text("· questions not detected")
                        }
                    }
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
                }
                Spacer(minLength: 0)
                if case .analysing = status {
                    ProgressView().controlSize(.small)
                }
                Image(systemName: "chevron.right")
                    .font(.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }
        }
        .swipeActions(edge: .trailing) {
            // Reversible for thirty days. A mistap must never destroy a term's work.
            Button("Move to trash", role: .destructive, action: trash)
        }
    }
}

@MainActor
public final class LibraryModel: ObservableObject {

    public enum AnalysisStatus: Equatable {
        case none, analysing, done, failed
    }

    public struct Subject: Hashable {
        public let name: String
        public let documents: [DocumentMeta]
    }

    @Published public private(set) var documents: [DocumentMeta] = []
    @Published public private(set) var statuses: [DocumentID: AnalysisStatus] = [:]
    @Published public private(set) var problem: String?

    public var onOpen: ((DocumentMeta) -> Void)?

    private let store: DocumentStore
    private let tutorService: TutorService
    private let analyse: (DocumentMeta) async throws -> QuestionMap

    public init(store: DocumentStore, tutorService: TutorService,
                analyse: @escaping (DocumentMeta) async throws -> QuestionMap) {
        self.store = store
        self.tutorService = tutorService
        self.analyse = analyse
    }

    public var subjects: [Subject] {
        Dictionary(grouping: documents) { $0.subject.isEmpty ? "Unsorted" : $0.subject }
            .map { Subject(name: $0.key, documents: $0.value) }
            .sorted { $0.name == "Unsorted" ? false : $0.name < $1.name }
    }

    public func status(for id: DocumentID) -> AnalysisStatus { statuses[id] ?? .none }

    public func refresh() async {
        documents = (try? store.allDocuments()) ?? []
    }

    public func handle(_ result: Result<[URL], Error>) async {
        switch result {
        case .failure:
            problem = "That file could not be opened. Nothing has changed."
        case .success(let urls):
            for url in urls { await importOne(url) }
            await refresh()
        }
    }

    private func importOne(_ url: URL) async {
        do {
            let pageCount = PDFText.pageCount(of: url)
            let meta = try store.importDocument(from: url, pageCount: max(pageCount, 1))
            documents.insert(meta, at: 0)
            // Opened immediately. Analysis is a background nicety, not a gate: a
            // student who has just imported a worksheet wants to write on it.
            onOpen?(meta)
            startAnalysis(for: meta)
        } catch {
            problem = (error as? LocalizedError)?.errorDescription
                ?? "That could not be imported."
        }
    }

    /// Detached and best-effort. A failure here costs the question map, which affects
    /// how well "check this" resolves — it never costs the document or the writing.
    public func startAnalysis(for meta: DocumentMeta) {
        statuses[meta.id] = .analysing
        Task { [weak self] in
            guard let self else { return }
            do {
                let map = try await self.analyse(meta)
                let url = self.store.paths(for: meta.id).questions
                let existing = (try? Data(contentsOf: url))
                    .flatMap { try? JSONDecoder().decode(QuestionMap.self, from: $0) }
                let merged = existing.map { QuestionMapBuilder.merge(map, into: $0) } ?? map
                try JSONEncoder().encode(merged).write(to: url, options: .atomic)
                self.statuses[meta.id] = .done
            } catch {
                self.statuses[meta.id] = .failed
            }
        }
    }

    public func open(_ document: DocumentMeta) { onOpen?(document) }

    public func trash(_ document: DocumentMeta) async {
        try? store.trash(document.id)
        await refresh()
    }

    public func dismissProblem() { problem = nil }
}
#endif
