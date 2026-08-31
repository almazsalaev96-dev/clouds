import SwiftUI

/// The wide card in "Continue studying". Shows enough to decide whether this is
/// the thing you meant to carry on with: what it is, how far you got, and when.
struct ContinueCard: View {

    let document: StudyDocument
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            DeskCard(padding: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    thumbnail
                    VStack(alignment: .leading, spacing: Theme.Space.s) {
                        HStack(spacing: Theme.Space.xs) {
                            Image(systemName: document.subject.symbolName)
                                .font(.caption2)
                                .foregroundStyle(document.subject.tint)
                            Text(document.subject.name)
                                .font(Theme.Text.label)
                                .foregroundStyle(Theme.Palette.textSecondary)
                        }

                        Text(document.title)
                            .font(Theme.Text.bodyEmphasis)
                            .foregroundStyle(Theme.Palette.textPrimary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)

                        ProgressBar(value: document.progress, tint: document.subject.tint)

                        HStack {
                            Text("Page \(document.lastPageIndex + 1) of \(max(document.pageCount, 1))")
                            Spacer()
                            Text("\(Int(document.progress * 100))%")
                        }
                        .font(Theme.Text.numeric)
                        .foregroundStyle(Theme.Palette.textSecondary)
                    }
                    .padding(Theme.Space.l)
                }
            }
            .frame(width: 260)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(document.title), \(document.subject.name)")
        .accessibilityValue("Page \(document.lastPageIndex + 1) of \(document.pageCount), \(Int(document.progress * 100)) percent")
        .accessibilityHint("Opens the worksheet")
    }

    private var thumbnail: some View {
        ZStack {
            Theme.Palette.page
            if let data = document.thumbnailData, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Image(systemName: "doc.text")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(Theme.Palette.textTertiary)
            }
        }
        .frame(height: 132)
        .clipped()
        .overlay(alignment: .topTrailing) {
            if document.isFavorite {
                Image(systemName: "star.fill")
                    .font(.caption)
                    .foregroundStyle(.white)
                    .padding(6)
                    .background(.black.opacity(0.35), in: Circle())
                    .padding(Theme.Space.s)
            }
        }
    }
}

/// The library grid card. Denser than `ContinueCard` — a student scanning
/// thirty documents needs the title and the subject, not a progress bar.
struct DocumentCard: View {

    let document: StudyDocument
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            DeskCard(padding: Theme.Space.m) {
                VStack(alignment: .leading, spacing: Theme.Space.m) {
                    ZStack {
                        Theme.Palette.page
                        if let data = document.thumbnailData, let image = UIImage(data: data) {
                            Image(uiImage: image)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        } else {
                            Image(systemName: "doc.text")
                                .font(.system(size: 24, weight: .light))
                                .foregroundStyle(Theme.Palette.textTertiary)
                        }
                    }
                    .frame(height: 150)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.small, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.small, style: .continuous)
                            .strokeBorder(Theme.Palette.separator, lineWidth: 0.5)
                    )

                    VStack(alignment: .leading, spacing: Theme.Space.xs) {
                        Text(document.title)
                            .font(Theme.Text.bodyEmphasis)
                            .foregroundStyle(Theme.Palette.textPrimary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: Theme.Space.xs) {
                            Image(systemName: document.subject.symbolName)
                                .font(.caption2)
                            Text(document.subject.name)
                            Spacer()
                            Text("\(document.pageCount) pp.")
                        }
                        .font(Theme.Text.label)
                        .foregroundStyle(Theme.Palette.textSecondary)
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(document.title), \(document.subject.name), \(document.pageCount) pages")
    }
}

/// A row in "Due soon" and in Assignments.
struct AssignmentRow: View {

    let assignment: Assignment

    var body: some View {
        DeskCard(padding: Theme.Space.m) {
            HStack(spacing: Theme.Space.m) {
                Image(systemName: assignment.status.symbolName)
                    .font(.title3)
                    .foregroundStyle(assignment.status == .submitted ? Theme.Palette.success : assignment.subject.tint)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(assignment.title)
                        .font(Theme.Text.bodyEmphasis)
                        .foregroundStyle(Theme.Palette.textPrimary)
                        .lineLimit(1)
                    HStack(spacing: Theme.Space.xs) {
                        Text(assignment.subject.name)
                        if let teacher = assignment.teacherName?.trimmedNonEmpty {
                            Text("·")
                            Text(teacher)
                        }
                    }
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.textSecondary)
                    .lineLimit(1)
                }

                Spacer(minLength: Theme.Space.s)

                VStack(alignment: .trailing, spacing: 2) {
                    if let due = assignment.dueDate {
                        Text(DueDateFormatter.describe(due))
                            .font(Theme.Text.label)
                            .foregroundStyle(assignment.isOverdue ? Theme.Palette.danger : Theme.Palette.textSecondary)
                    }
                    Text(assignment.status.title)
                        .font(Theme.Text.label)
                        .foregroundStyle(Theme.Palette.textTertiary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// "Tomorrow", "In 3 days", "2 days ago" — the phrasing a student would use,
/// rather than a date they then have to work out.
enum DueDateFormatter {

    static func describe(_ date: Date, now: Date = Date()) -> String {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let startOfDue = calendar.startOfDay(for: date)
        let days = calendar.dateComponents([.day], from: startOfToday, to: startOfDue).day ?? 0

        switch days {
        case 0: return "Due today"
        case 1: return "Due tomorrow"
        case 2...6: return "Due in \(days) days"
        case -1: return "1 day late"
        case ..<(-1): return "\(-days) days late"
        default: return "Due \(date.formatted(date: .abbreviated, time: .omitted))"
        }
    }
}
