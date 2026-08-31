import SwiftUI

/// Settings, organised around questions a student actually has: how should the
/// tutor behave, what leaves my iPad, and how do I turn things off.
struct SettingsView: View {

    @Environment(AppEnvironment.self) private var app
    @Environment(AppSettings.self) private var settings

    var body: some View {
        @Bindable var settings = settings

        Form {
            Section {
                Toggle("Offer a hint before the answer", isOn: $settings.hintFirst)
                Toggle("Suggest help when I'm stuck", isOn: $settings.smartSuggestions)
            } header: {
                Text("How your tutor helps")
            } footer: {
                Text("With hints on, asking for a solution offers a hint first. You can always take the full answer.")
            }

            Section {
                Toggle("Speak answers out loud", isOn: $settings.voiceEnabled)
                if settings.voiceEnabled {
                    VStack(alignment: .leading) {
                        Text("Speed").font(Theme.Text.label)
                        Slider(value: $settings.voiceSpeed, in: 0.7...1.4, step: 0.1) {
                            Text("Speed")
                        } minimumValueLabel: {
                            Text("Slower").font(.caption2)
                        } maximumValueLabel: {
                            Text("Faster").font(.caption2)
                        }
                    }
                }
            } header: {
                Text("Voice")
            }

            Section {
                Toggle("Send a picture of the page", isOn: $settings.sendsPageImages)
                Toggle("Remember topics I find hard", isOn: $settings.remembersWeakTopics)
                if settings.remembersWeakTopics {
                    Button("Forget everything remembered", role: .destructive) {
                        app.memory.forgetEverything()
                    }
                }
            } header: {
                Text("Privacy")
            } footer: {
                Text("""
                Your handwriting is read on this iPad and never uploaded as an image for recognition. \
                When you ask a question, your tutor is sent the printed text of that page, a short reading of your handwriting, \
                and — if the switch above is on — one picture of the page or the part you selected. Nothing else from your library is sent.

                Turning pictures off keeps everything as text: diagrams and graphs stop working, everything else still does.
                """)
            }

            Section {
                Toggle("Guess the subject when importing", isOn: $settings.autoDetectSubject)
                Button("Show the welcome tips again") {
                    settings.hasSeenReaderTips = false
                    settings.hasCompletedOnboarding = false
                }
            } header: {
                Text("General")
            }

            Section {
                Button("Erase study history", role: .destructive) {
                    app.analytics.eraseAll()
                }
            } footer: {
                Text("Removes your recorded study time. Your worksheets, handwriting and notes are not touched.")
            }

            Section {
                LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                LabeledContent("Tutor", value: app.aiProvider == nil ? "Not configured" : "Connected via Study Desk")
            } footer: {
                Text("Study Desk never stores an AI or voice key on this iPad. Requests go through the Study Desk server, which holds the credentials.")
            }
        }
        .navigationTitle("Settings")
    }
}
