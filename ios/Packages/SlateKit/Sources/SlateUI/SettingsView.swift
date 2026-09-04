#if canImport(SwiftUI)
import SwiftUI
import SlateDesign
import SlateFoundation

/// Settings, and the part of it that matters: what Slate holds and how to get rid of it.
///
/// Short on purpose. Every default is already the one most students should have, so
/// this screen is mostly here to be honest about what is stored rather than to be
/// configured.
public struct SettingsView: View {

    @ObservedObject var model: SettingsModel
    @ObservedObject var voice: VoiceController
    @State private var exportURL: URL?

    public init(model: SettingsModel, voice: VoiceController) {
        self.model = model
        self.voice = voice
    }

    public var body: some View {
        Form {
            Section("What Slate holds") {
                Text(model.usageDescription)
                    .font(Slate.Typography.caption)
                    .foregroundStyle(Slate.Palette.inkSecondary)
                Text("All of it is on this iPad. None of it is on a server, because there is no account.")
                    .font(Slate.Typography.footnote)
                    .foregroundStyle(Slate.Palette.inkTertiary)
            }

            Section {
                Toggle("Read replies aloud automatically", isOn: $model.speakRepliesAutomatically)
                Picker("Reading speed", selection: $voice.speed) {
                    ForEach(VoiceController.speedOptions, id: \.self) { option in
                        Text(option == 1.0 ? "Normal" : "\(option, specifier: "%.1f")×").tag(option)
                    }
                }
            } header: {
                Text("Voice")
            } footer: {
                Text("Speech is generated when you ask for it and is not stored.")
            }

            Section {
                Toggle("Offer the smallest hint first", isOn: $model.startAtLowestHelp)
            } header: {
                Text("The tutor")
            } footer: {
                // Stated because a student who thinks help is being rationed will stop
                // asking, and that costs more than any amount of over-helping.
                Text("Either way, the full solution is always one tap away. Turning this off just means explanations start longer.")
            }

            Section {
                Toggle("Send names to the tutor", isOn: $model.shareNamesWithTutor)
            } header: {
                Text("What leaves this iPad")
            } footer: {
                Text("When you ask a question, the tutor sees that question, what you have written under it, and the page around it. It never sees your history, your other subjects, or what you got wrong last week. Email addresses, phone numbers and long ID numbers are stripped before anything is sent, whatever this setting says.")
            }

            Section {
                Button("Export everything") {
                    Task { exportURL = (await model.exportEverything())?.url }
                }
                ForEach(model.subjects, id: \.self) { subject in
                    Button("Delete what Slate learned about \(subject)", role: .destructive) {
                        model.pendingDeletion = .subject(subject)
                    }
                }
                Button("Delete everything Slate learned", role: .destructive) {
                    model.pendingDeletion = .everything
                }
            } header: {
                Text("Your data")
            } footer: {
                Text("Deleting removes what Slate concluded about you, not your work. Your documents and handwriting are never touched by anything on this screen.")
            }

            Section {
                Button("Show the first-time tips again") { FirstRunTips().reset() }
                Button("Show the introduction again") { OnboardingState.reset() }
            }
        }
        .navigationTitle("Settings")
        .task { await model.refresh() }
        .confirmationDialog(
            "Delete this?",
            isPresented: Binding(
                get: { model.pendingDeletion != nil },
                set: { if !$0 { model.pendingDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) { Task { await model.confirmDeletion() } }
            Button("Keep it", role: .cancel) { model.pendingDeletion = nil }
        } message: {
            // The warning says what actually goes, in the student's words. No
            // euphemism, and no burying the reassuring half.
            Text(model.pendingDeletion?.warning ?? "")
        }
        .alert("Done", isPresented: Binding(
            get: { model.lastAction != nil },
            set: { if !$0 { model.dismissLastAction() } }
        )) {
            Button("Alright") { model.dismissLastAction() }
        } message: {
            Text(model.lastAction ?? "")
        }
        .sheet(isPresented: Binding(
            get: { exportURL != nil },
            set: { if !$0 { exportURL = nil } }
        )) {
            if let exportURL {
                ShareLink(item: exportURL) {
                    Label("Save or send the export", systemImage: "square.and.arrow.up")
                }
                .padding(Slate.Space.section)
                .presentationDetents([.height(200)])
            }
        }
    }
}
#endif
