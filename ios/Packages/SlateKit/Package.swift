// swift-tools-version: 5.9
import PackageDescription

// Modules may depend only on modules above them in this list. That rule is what keeps
// SlateLearning free of UIKit and therefore testable anywhere, and what stops a view
// from reaching past the engines to a network client.
let package = Package(
    name: "SlateKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "SlateFoundation", targets: ["SlateFoundation"]),
        .library(name: "SlateModel", targets: ["SlateModel"]),
        .library(name: "SlateLearning", targets: ["SlateLearning"]),
        .library(name: "SlateDocuments", targets: ["SlateDocuments"]),
        .library(name: "SlateInk", targets: ["SlateInk"]),
        .library(name: "SlateAI", targets: ["SlateAI"]),
        .library(name: "SlateVoice", targets: ["SlateVoice"]),
        .library(name: "SlateDesign", targets: ["SlateDesign"]),
        .library(name: "SlateUI", targets: ["SlateUI"]),
    ],
    targets: [
        .target(name: "SlateFoundation"),
        .target(name: "SlateModel", dependencies: ["SlateFoundation"]),
        .target(name: "SlateLearning", dependencies: ["SlateFoundation", "SlateModel"]),
        .target(name: "SlateDocuments", dependencies: ["SlateFoundation", "SlateModel"]),
        .target(name: "SlateInk", dependencies: ["SlateFoundation", "SlateModel", "SlateDocuments"]),
        .target(name: "SlateAI", dependencies: ["SlateFoundation", "SlateModel", "SlateDocuments"]),
        .target(name: "SlateVoice", dependencies: ["SlateFoundation"]),
        .target(name: "SlateDesign", dependencies: ["SlateFoundation"]),
        .target(
            name: "SlateUI",
            dependencies: [
                "SlateFoundation", "SlateModel", "SlateLearning", "SlateDocuments",
                "SlateInk", "SlateAI", "SlateVoice", "SlateDesign",
            ]
        ),
        .testTarget(
            name: "SlateLearningTests",
            dependencies: ["SlateLearning"],
            // The cross-language oracle. These tests load the same JSON the Python
            // reference emits and assert parity to nine decimal places.
            resources: [.process("Fixtures")]
        ),
        .testTarget(name: "SlateModelTests", dependencies: ["SlateModel"]),
        .testTarget(name: "SlateDocumentsTests", dependencies: ["SlateDocuments"]),
    ]
)
