import SwiftUI
import SwiftData

/// The private study record.
///
/// Written to be useful and then to get out of the way. There is no streak, no
/// daily goal, no red number. The one thing it does celebrate is asking for a
/// hint rather than an answer, because that is the behaviour that actually
/// leads to marks.
struct StudyProgressView: View {

    @Environment(AppEnvironment.self) private var app
    @Environment(AppSettings.self) private var settings
    @State private var window: Window = .week

    /// Named `Window` rather than `Range` so it doesn't shadow the standard
    /// library type inside this file.
    enum Window: String, CaseIterable, Identifiable {
        case week = "7 days"
        case month = "30 days"
        var id: String { rawValue }

        var since: Date {
            let days = self == .week ? -7 : -30
            return Calendar.current.date(byAdding: .day, value: days, to: Date()) ?? Date()
        }
    }

    private var summary: StudyAnalytics.Summary {
        app.analytics.summary(since: window.since)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.xl) {
                Picker("Range", selection: $window) {
                    ForEach(Window.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                let summary = summary

                if summary.sessionCount == 0 {
                    EmptyStateView(
                        icon: "chart.bar",
                        title: "Nothing recorded yet",
                        message: "Open a worksheet and start writing — your study time is recorded on this iPad and shared with nobody."
                    )
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: Theme.Space.m)], spacing: Theme.Space.m) {
                        stat("Studied", Self.duration(summary.totalTime), "clock")
                        stat("Sessions", "\(summary.sessionCount)", "book")
                        stat("Pages", "\(summary.pagesWorked)", "doc.text")
                        stat("Tutor asks", "\(summary.tutorRequests)", "sparkles")
                    }

                    if summary.tutorRequests > 0 {
                        DeskCard {
                            VStack(alignment: .leading, spacing: Theme.Space.s) {
                                Text("Hints rather than answers")
                                    .font(Theme.Text.section)
                                ProgressBar(value: summary.hintRatio, tint: Theme.Palette.success, height: 8)
                                Text("\(summary.hintsTaken) of \(summary.tutorRequests) times you took a hint and worked it out yourself.")
                                    .font(Theme.Text.caption)
                                    .foregroundStyle(Theme.Palette.textSecondary)
                            }
                        }
                    }

                    if !summary.bySubject.isEmpty {
                        VStack(alignment: .leading, spacing: Theme.Space.m) {
                            SectionHeader(title: "By subject")
                            ForEach(summary.bySubject, id: \.subject.id) { entry in
                                HStack(spacing: Theme.Space.m) {
                                    Image(systemName: entry.subject.symbolName)
                                        .foregroundStyle(entry.subject.tint)
                                        .frame(width: 24)
                                    Text(entry.subject.name).font(Theme.Text.caption)
                                    Spacer()
                                    Text(Self.duration(entry.time))
                                        .font(Theme.Text.numeric)
                                        .foregroundStyle(Theme.Palette.textSecondary)
                                }
                            }
                        }
                    }
                }

                if settings.remembersWeakTopics, app.memory.storedTopicCount > 0 {
                    DeskCard {
                        VStack(alignment: .leading, spacing: Theme.Space.s) {
                            Text("Worth another look").font(Theme.Text.section)
                            Text("\(app.memory.storedTopicCount) topics you've asked about more than once. Study Desk offers a refresher when one comes up again.")
                                .font(Theme.Text.caption)
                                .foregroundStyle(Theme.Palette.textSecondary)
                            Button("Forget these") { app.memory.forgetEverything() }
                                .font(Theme.Text.label)
                                .foregroundStyle(Theme.Palette.danger)
                        }
                    }
                }
            }
            .padding(Theme.Space.xl)
        }
        .background(Theme.Palette.background)
        .navigationTitle("Progress")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink { SettingsView() } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("Settings")
            }
        }
    }

    private func stat(_ title: String, _ value: String, _ symbol: String) -> some View {
        DeskCard(padding: Theme.Space.m) {
            VStack(alignment: .leading, spacing: Theme.Space.xs) {
                Image(systemName: symbol)
                    .font(.footnote)
                    .foregroundStyle(Theme.Palette.accent)
                Text(value).font(Theme.Text.title)
                Text(title)
                    .font(Theme.Text.label)
                    .foregroundStyle(Theme.Palette.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    static func duration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval / 60)
        if minutes < 60 { return "\(minutes)m" }
        return "\(minutes / 60)h \(minutes % 60)m"
    }
}
