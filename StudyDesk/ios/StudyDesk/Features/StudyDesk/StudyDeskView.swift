import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// The home screen.
///
/// Ordered by what a student actually opens the app to do: carry on with the
/// thing they were doing, deal with what's due, then everything else.
struct StudyDeskView: View {

    let open: (StudyDocument) -> Void

    @Environment(AppEnvironment.self) private var app
    @Environment(\.modelContext) private var modelContext

    @Query(
        filter: #Predicate<StudyDocument> { $0.deletedAt == nil && $0.lastOpenedAt != nil },
        sort: \StudyDocument.lastOpenedAt, order: .reverse
    )
    private var recentlyOpened: [StudyDocument]

    @Query(
        filter: #Predicate<StudyDocument> { $0.deletedAt == nil },
        sort: \StudyDocument.createdAt, order: .reverse
    )
    private var allDocuments: [StudyDocument]

    @Query(
        filter: #Predicate<Assignment> { $0.statusRaw != "submitted" },
        sort: \Assignment.dueDate
    )
    private var openAssignments: [Assignment]

    @State private var isImporting = false
    @State private var isScanning = false
    @State private var isPickingPhoto = false
    @State private var toast: Toast?
    @State private var errorMessage: String?

    private var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 220, maximum: 300), spacing: Theme.Space.l)]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.xxl) {
                if let warning = app.launchWarning {
                    recoveryBanner(warning)
                }

                QuickActionsBar(
                    importPDF: { isImporting = true },
                    scan: {
                        // The scanner needs a camera. On a device without one
                        // the action explains itself rather than presenting an
                        // empty screen.
                        if DocumentScannerView.isSupported {
                            isScanning = true
                        } else {
                            errorMessage = StudyDeskError.scanUnavailable.errorDescription
                        }
                    },
                    addImage: { isPickingPhoto = true }
                )

                if !dueSoon.isEmpty {
                    dueSoonSection
                }

                if !recentlyOpened.isEmpty {
                    continueSection
                }

                librarySection
            }
            .padding(Theme.Space.xl)
        }
        .background(Theme.Palette.background)
        .navigationTitle("Study Desk")
        .navigationBarTitleDisplayMode(.large)
        .toast($toast)
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: DocumentImporter.supportedTypes,
            allowsMultipleSelection: true
        ) { result in
            handleImport(result)
        }
        .fullScreenCover(isPresented: $isScanning) {
            DocumentScannerView { images in
                isScanning = false
                guard !images.isEmpty else { return }
                importScanned(images)
            } onCancel: {
                isScanning = false
            }
        }
        .photoImport(isPresented: $isPickingPhoto) { images in
            guard !images.isEmpty else { return }
            importScanned(images)
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .onReceive(NotificationCenter.default.publisher(for: .studyDeskCommand)) { note in
            switch note.object as? StudyCommand {
            case .importPDF: isImporting = true
            case .scan: isScanning = true
            default: break
            }
        }
    }

    // MARK: Sections

    private var dueSoon: [Assignment] {
        let horizon = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
        return openAssignments
            .filter { assignment in
                guard let due = assignment.dueDate else { return false }
                return due <= horizon
            }
            .prefix(3)
            .map { $0 }
    }

    private var dueSoonSection: some View {
        VStack(alignment: .leading, spacing: Theme.Space.m) {
            SectionHeader(title: "Due soon")
            ForEach(dueSoon) { assignment in
                Button {
                    if let document = assignment.document { openReader(document) }
                } label: {
                    AssignmentRow(assignment: assignment)
                }
                .buttonStyle(.plain)
                .disabled(assignment.document == nil)
            }
        }
    }

    private var continueSection: some View {
        VStack(alignment: .leading, spacing: Theme.Space.m) {
            SectionHeader(title: "Continue studying")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Space.l) {
                    ForEach(recentlyOpened.prefix(6)) { document in
                        ContinueCard(document: document) { openReader(document) }
                    }
                }
                .padding(.vertical, Theme.Space.xs)
                .padding(.horizontal, 2) // room for the card shadow
            }
            // Horizontal scrolling inside a vertical scroll view needs the
            // content to be able to overflow the safe area cleanly.
            .scrollClipDisabled()
        }
    }

    private var librarySection: some View {
        VStack(alignment: .leading, spacing: Theme.Space.m) {
            SectionHeader(
                title: "All documents",
                subtitle: allDocuments.isEmpty ? nil : "\(allDocuments.count) in your library"
            )

            if allDocuments.isEmpty {
                EmptyStateView(
                    icon: "doc.text",
                    title: "Nothing here yet",
                    message: "Import a worksheet or scan one with the camera, then start writing on it with Apple Pencil.",
                    actionTitle: "Import a PDF",
                    action: { isImporting = true }
                )
            } else {
                LazyVGrid(columns: columns, spacing: Theme.Space.l) {
                    ForEach(allDocuments) { document in
                        DocumentCard(document: document) { openReader(document) }
                            .contextMenu { contextMenu(for: document) }
                    }
                }
            }
        }
    }

    private func recoveryBanner(_ message: String) -> some View {
        DeskCard {
            HStack(alignment: .top, spacing: Theme.Space.m) {
                Image(systemName: "checkmark.shield")
                    .foregroundStyle(Theme.Palette.success)
                Text(message)
                    .font(Theme.Text.caption)
                Spacer()
                Button("Dismiss") { app.dismissLaunchWarning() }
                    .font(Theme.Text.label)
            }
        }
    }

    @ViewBuilder
    private func contextMenu(for document: StudyDocument) -> some View {
        Button {
            document.isFavorite.toggle()
            try? modelContext.save()
        } label: {
            Label(document.isFavorite ? "Remove from Favourites" : "Add to Favourites",
                  systemImage: document.isFavorite ? "star.slash" : "star")
        }

        Menu("Subject") {
            ForEach(Subject.builtIn) { subject in
                Button(subject.name) {
                    document.subject = subject
                    try? modelContext.save()
                }
            }
        }

        Button(role: .destructive) {
            // Soft delete. The file stays on disk and in Recently Deleted for
            // 30 days, because "I deleted the wrong worksheet" happens.
            document.deletedAt = Date()
            try? modelContext.save()
            toast = Toast(kind: .info, message: "Moved to Recently Deleted")
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    // MARK: Actions

    private func openReader(_ document: StudyDocument) {
        document.lastOpenedAt = Date()
        try? modelContext.save()
        open(document)
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            var imported = 0
            for url in urls {
                do {
                    _ = try app.importer().importPDF(at: url)
                    imported += 1
                } catch {
                    errorMessage = (error as? StudyDeskError)?.errorDescription
                        ?? StudyDeskError.importFailed.errorDescription
                }
            }
            if imported > 0 {
                toast = Toast(kind: .success, message: imported == 1 ? "Worksheet added" : "\(imported) documents added")
            }
        case .failure:
            errorMessage = StudyDeskError.importFailed.errorDescription
        }
    }

    private func importScanned(_ images: [UIImage]) {
        do {
            let title = "Scan \(Date().formatted(date: .abbreviated, time: .shortened))"
            let document = try app.importer().importImages(images, title: title)
            toast = Toast(kind: .success, message: "Scanned \(images.count) page\(images.count == 1 ? "" : "s")")
            openReader(document)
        } catch {
            errorMessage = (error as? StudyDeskError)?.errorDescription
                ?? StudyDeskError.importFailed.errorDescription
        }
    }
}
