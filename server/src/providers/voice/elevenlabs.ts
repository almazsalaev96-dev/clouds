/**
 * ElevenLabs implementation of `VoiceProvider`.
 *
 * The API key stops here. The device asks the gateway for speech and receives audio
 * bytes; it never learns which provider produced them or with what credential.
 */

import { VoiceUnavailable, type SpeakRequest, type SpeakResult, type VoiceProvider } from "./provider.ts";

const BASE = "https://api.elevenlabs.io/v1";

export interface ElevenLabsOptions {
  apiKey: string;
  defaultVoiceId?: string;
  modelId?: string;
}

/** A calm, adult, unhurried default. Never a cartoon, never over-enthusiastic. */
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

export class ElevenLabsVoice implements VoiceProvider {
  readonly name = "elevenlabs";
  private readonly options: ElevenLabsOptions;

  constructor(options: ElevenLabsOptions) { this.options = options; }

  get available(): boolean { return Boolean(this.options.apiKey); }

  async speak(request: SpeakRequest): Promise<SpeakResult> {
    if (!this.available) {
      throw new VoiceUnavailable("Speech is not configured on this server.", false);
    }
    const voice = request.voiceId ?? this.options.defaultVoiceId ?? DEFAULT_VOICE;
    const format = request.format === "pcm" ? "pcm_24000" : "mp3_44100_128";

    let response: Response;
    try {
      response = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=${format}`, {
        method: "POST",
        headers: {
          "xi-api-key": this.options.apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: request.text,
          model_id: this.options.modelId ?? "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            // Deliberately low. An excited tutor is a distracting one.
            style: 0.15,
            use_speaker_boost: true,
            speed: clampSpeed(request.speed),
          },
        }),
      });
    } catch {
      throw new VoiceUnavailable("Could not reach the speech service.", true);
    }

    if (!response.ok || !response.body) {
      const retryable = response.status >= 500 || response.status === 429;
      throw new VoiceUnavailable(
        retryable ? "The speech service is busy." : "Speech is unavailable right now.",
        retryable,
      );
    }
    return {
      contentType: request.format === "pcm" ? "audio/L16;rate=24000" : "audio/mpeg",
      stream: response.body,
    };
  }
}

function clampSpeed(speed: number | undefined): number {
  if (speed === undefined || !Number.isFinite(speed)) return 1.0;
  return Math.min(1.2, Math.max(0.7, speed));
}
