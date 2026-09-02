import type { SpeakRequest, SpeakResult, VoiceProvider } from "./provider.ts";

/** Emits a short deterministic byte pattern so audio routes are testable offline. */
export class MockVoice implements VoiceProvider {
  readonly name = "mock";
  readonly available = true;
  readonly spoken: string[] = [];

  async speak(request: SpeakRequest): Promise<SpeakResult> {
    this.spoken.push(request.text);
    const bytes = new TextEncoder().encode(`audio:${request.text.length}`);
    return {
      contentType: "audio/mpeg",
      stream: new ReadableStream({
        start(controller) { controller.enqueue(bytes); controller.close(); },
      }),
    };
  }
}
