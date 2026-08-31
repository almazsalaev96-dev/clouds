import { config } from './config.js';
import { ServiceError } from './anthropic.js';

/**
 * ElevenLabs speech, streamed straight through to the iPad.
 *
 * The key stays here. The app posts text and gets audio bytes; it has no
 * ElevenLabs credential to leak and no ability to call the API on its own
 * account. The voice is chosen server-side too, so it can be changed for
 * everyone without an app release.
 */

/** Guardrails on what the voice is asked to say. */
export function prepareSpeechText(raw, limit = config.limits.maxSpeechCharacters) {
  if (typeof raw !== 'string') return '';

  const cleaned = raw
    // The tutor writes light markdown; reading "asterisk asterisk" aloud is
    // not what anyone wants.
    .replace(/[*_`#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= limit) return cleaned;

  // Cut at a sentence end so speech never stops mid-word.
  const clipped = cleaned.slice(0, limit);
  const lastStop = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
  return lastStop > limit * 0.5 ? clipped.slice(0, lastStop + 1) : clipped;
}

/**
 * Maps the app's 0.7–1.4 speed onto voice settings.
 *
 * Faster speech from a tutor needs a little more stability, or it starts to
 * sound clipped and anxious — which is the opposite of what a stuck student
 * needs to hear.
 */
export function voiceSettingsFor(speed) {
  // `Number(speed) || 1` would be wrong here: 0 is falsy, so a speed of 0
  // would silently become 1 instead of clamping to the slowest setting.
  const parsed = Number(speed);
  const clamped = Math.min(1.4, Math.max(0.7, Number.isFinite(parsed) ? parsed : 1));
  return {
    stability: clamped > 1.1 ? 0.55 : 0.45,
    similarity_boost: 0.75,
    style: 0.25,
    use_speaker_boost: true,
    speed: clamped,
  };
}

/**
 * @returns {Promise<ReadableStream>} MP3 bytes
 */
export async function streamSpeech(text, speed, signal) {
  if (!config.elevenLabs.apiKey || !config.elevenLabs.voiceId) {
    throw new ServiceError('voice_unavailable', "I can't speak right now, but you can still read the explanation.");
  }

  const prepared = prepareSpeechText(text);
  if (!prepared) {
    throw new ServiceError('voice_unavailable', 'There was nothing to read out.', 400);
  }

  const url = `${config.elevenLabs.baseURL}/v1/text-to-speech/${config.elevenLabs.voiceId}/stream?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': config.elevenLabs.apiKey,
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: prepared,
      model_id: config.elevenLabs.modelId,
      voice_settings: voiceSettingsFor(speed),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    if (response.status === 429) {
      throw new ServiceError('rate_limited', 'The voice is busy right now. Try again in a moment.', 429);
    }
    const detail = await response.text().catch(() => '');
    throw new ServiceError(
      'voice_unavailable',
      "I can't speak right now, but you can still read the explanation.",
      502,
      detail.slice(0, 300)
    );
  }

  return response.body;
}
