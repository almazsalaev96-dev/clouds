import { config } from './config.js';

/**
 * Validation for anything arriving from a client.
 *
 * The app is the only intended caller, but the endpoint is on the internet and
 * anyone can post to it. Everything here assumes the body is hostile: sizes are
 * bounded, types are checked, and nothing is passed upstream unexamined —
 * upstream calls cost money, and an unbounded field is how a proxy becomes
 * someone else's free API.
 */

const VALID_MODES = new Set([
  'explain', 'hint', 'check', 'solve', 'teach', 'simplify',
  'stepByStep', 'mistakeFinder', 'examAnswer', 'summarize', 'quizMe', 'planAnswer',
]);

const VALID_ATTACHMENT_KINDS = new Set(['page', 'region', 'image']);
const VALID_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Largest single image, decoded. Roughly a 1280px page at good quality. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export class ValidationError extends Error {
  constructor(studentMessage, field) {
    super(studentMessage);
    this.name = 'ValidationError';
    this.studentMessage = studentMessage;
    this.field = field;
    this.status = 400;
  }
}

function string(value, max, field) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError('That request was malformed.', field);
  if (value.length > max) throw new ValidationError('That request was too long.', field);
  return value;
}

function integer(value, { min, max, fallback }) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

/** Validates and normalises a tutor request body. */
export function parseTutorRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('That request was malformed.', 'body');
  }

  const raw = body.context;
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('That request was missing its page context.', 'context');
  }

  const doc = raw.document ?? {};
  const context = {
    document: {
      title: string(doc.title, 300, 'document.title') ?? 'Worksheet',
      subject: string(doc.subject, 80, 'document.subject') ?? 'Unsorted',
      pageNumber: integer(doc.pageNumber, { min: 1, max: 10_000, fallback: 1 }),
      pageCount: integer(doc.pageCount, { min: 1, max: 10_000, fallback: 1 }),
    },
    printedText: string(raw.printedText, 20_000, 'printedText'),
    selectedText: string(raw.selectedText, 8000, 'selectedText'),
    studentWork: string(raw.studentWork, 8000, 'studentWork'),
    detectedQuestion: string(raw.detectedQuestion, 120, 'detectedQuestion'),
    neighbouringText: string(raw.neighbouringText, 8000, 'neighbouringText'),
    studentMessage: string(raw.studentMessage, 4000, 'studentMessage'),
    mode: VALID_MODES.has(raw.mode) ? raw.mode : undefined,
    examMode: raw.examMode === true,
    allowFullSolutions: raw.allowFullSolutions !== false,
    recentTurns: parseTurns(raw.recentTurns),
    strugglingWith: parseTopics(raw.strugglingWith),
  };

  // A request with no page text, no handwriting, no image and no question is
  // not a tutoring request — it is someone using the proxy as a chat endpoint.
  const attachments = parseAttachments(body.attachments);
  const hasSubstance =
    context.printedText || context.selectedText || context.studentWork ||
    attachments.length > 0 || context.studentMessage;

  if (!hasSubstance) {
    throw new ValidationError('There was nothing on this page for your tutor to look at.', 'context');
  }

  return { context, attachments };
}

function parseTurns(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-8)
    .filter((turn) => turn && typeof turn === 'object' && typeof turn.text === 'string')
    .map((turn) => ({
      role: turn.role === 'tutor' ? 'tutor' : 'student',
      text: turn.text.slice(0, 2000),
    }));
}

function parseTopics(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((topic) => typeof topic === 'string' && topic.length > 0 && topic.length <= 60)
    .slice(0, 3);
}

function parseAttachments(value) {
  if (!Array.isArray(value)) return [];

  const attachments = [];
  for (const item of value.slice(0, config.limits.maxAttachments)) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.data !== 'string') continue;

    const mediaType = VALID_MEDIA_TYPES.has(item.mediaType) ? item.mediaType : 'image/jpeg';

    // base64 is 4 characters per 3 bytes; check the encoded length before
    // decoding so an enormous string is rejected without allocating it.
    const approximateBytes = Math.floor((item.data.length * 3) / 4);
    if (approximateBytes > MAX_IMAGE_BYTES) {
      throw new ValidationError('That page image was too large to send.', 'attachments');
    }
    if (!isBase64(item.data)) {
      throw new ValidationError('That page image was malformed.', 'attachments');
    }

    attachments.push({
      kind: VALID_ATTACHMENT_KINDS.has(item.kind) ? item.kind : 'page',
      mediaType,
      data: item.data,
    });
  }
  return attachments;
}

function isBase64(value) {
  // Cheap structural check. The upstream API does the real decoding; this is
  // here so obvious junk never reaches it.
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;
}

/** Validates a speech request body. */
export function parseVoiceRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('That request was malformed.', 'body');
  }
  const text = string(body.text, config.limits.maxSpeechCharacters * 2, 'text');
  if (!text || !text.trim()) {
    throw new ValidationError('There was nothing to read out.', 'text');
  }
  const speed = Number(body.speed);
  return {
    text,
    speed: Number.isFinite(speed) ? Math.min(1.4, Math.max(0.7, speed)) : 1,
  };
}
