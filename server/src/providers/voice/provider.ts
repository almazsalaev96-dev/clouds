/**
 * Voice provider protocol.
 *
 * Speech is streamed to the device as bytes; the gateway never buffers a whole
 * utterance before the student hears the first word, because a tutor that pauses for
 * four seconds before speaking does not feel like a tutor.
 */

export interface SpeakRequest {
  text: string;
  voiceId?: string;
  /** 0.5 slow, 1.0 normal, up to 2.0. Applied by the provider where supported. */
  speed?: number;
  format?: "mp3" | "pcm";
}

export interface SpeakResult {
  contentType: string;
  stream: ReadableStream<Uint8Array>;
}

export class VoiceUnavailable extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "VoiceUnavailable";
    this.retryable = retryable;
  }
}

export interface VoiceProvider {
  readonly name: string;
  readonly available: boolean;
  speak(request: SpeakRequest): Promise<SpeakResult>;
}
