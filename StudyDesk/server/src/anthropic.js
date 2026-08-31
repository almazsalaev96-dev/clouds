import { config } from './config.js';
import { buildSystemPrompt, buildMessages, extractVerdict } from './prompt.js';

/**
 * Streaming client for the tutoring model.
 *
 * Uses fetch and the Messages API's own SSE stream directly rather than an SDK:
 * the surface used here is one endpoint and four event types, and a streaming
 * transport is a bad place to inherit someone else's buffering behaviour.
 */

/**
 * Streams a tutor reply.
 *
 * @param {object} context   the StudyContext sent by the app
 * @param {Array}  attachments
 * @param {AbortSignal} [signal]
 * @yields {{type: 'text', text: string} | {type: 'verdict', verdict: string}}
 */
export async function* streamTutorReply(context, attachments, signal) {
  if (!config.anthropic.apiKey) {
    throw new ServiceError('tutor_unavailable', 'Your tutor is not set up on this server yet.');
  }

  const response = await fetch(`${config.anthropic.baseURL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': config.anthropic.version,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      stream: true,
      system: buildSystemPrompt(context),
      messages: buildMessages(context, attachments),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await safeReadText(response);
    throw upstreamError(response.status, detail);
  }

  // The verdict marker arrives at the very start of a `check` reply, but it may
  // be split across deltas. Hold back until either the marker is resolved or
  // enough characters have arrived that it clearly isn't there — then release
  // everything. The student sees nothing but clean prose.
  let pending = '';
  let verdictResolved = context?.mode !== 'check';

  for await (const event of parseSSE(response.body)) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const chunk = event.delta.text ?? '';
      if (!chunk) continue;

      if (verdictResolved) {
        yield { type: 'text', text: chunk };
        continue;
      }

      pending += chunk;
      const { verdict, text } = extractVerdict(pending);
      if (verdict) {
        verdictResolved = true;
        yield { type: 'verdict', verdict };
        if (text) yield { type: 'text', text };
        pending = '';
      } else if (pending.length > 40) {
        // The model didn't lead with a verdict. Release what's held.
        verdictResolved = true;
        yield { type: 'text', text: pending };
        pending = '';
      }
    } else if (event.type === 'error') {
      throw new ServiceError('tutor_unavailable', 'Your tutor stopped part way through. Your work is safely saved.');
    }
  }

  if (pending) yield { type: 'text', text: pending };
}

/** Parses the upstream SSE stream into JSON events. */
async function* parseSSE(body) {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // A partial or malformed event is not worth taking the reply down for.
        }
      }
    }
  }
}

async function safeReadText(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

function upstreamError(status, detail) {
  if (status === 429) {
    return new ServiceError('rate_limited', 'Your tutor is busy right now. Try again in a moment.', 429);
  }
  if (status === 401 || status === 403) {
    // A credential problem is ours, not the student's; they get a neutral
    // message and the detail goes to the log.
    return new ServiceError('tutor_unavailable', "I couldn't reach your tutor just now. Your work is safely saved.", 502, detail);
  }
  if (status >= 500) {
    return new ServiceError('tutor_unavailable', 'Your tutor is having a problem. Your work is safely saved.', 502, detail);
  }
  return new ServiceError('tutor_unavailable', "I couldn't answer that one. Your work is safely saved.", 502, detail);
}

/** An error with a message that is safe to show a student. */
export class ServiceError extends Error {
  constructor(code, studentMessage, status = 503, detail = '') {
    super(studentMessage);
    this.name = 'ServiceError';
    this.code = code;
    this.studentMessage = studentMessage;
    this.status = status;
    this.detail = detail;
  }
}
