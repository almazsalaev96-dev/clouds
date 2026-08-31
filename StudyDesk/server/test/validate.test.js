import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTutorRequest, parseVoiceRequest, ValidationError } from '../src/validate.js';

const validBody = {
  context: {
    document: { title: 'Worksheet', subject: 'Mathematics', pageNumber: 3, pageCount: 12 },
    printedText: 'Solve 2x + 5 = 15',
    studentWork: 'x = 4',
    mode: 'check',
  },
  attachments: [],
};

test('a well-formed request is accepted', () => {
  const { context, attachments } = parseTutorRequest(validBody);
  assert.equal(context.document.pageNumber, 3);
  assert.equal(context.mode, 'check');
  assert.equal(attachments.length, 0);
});

test('a request with no page context is refused', () => {
  assert.throws(() => parseTutorRequest({}), ValidationError);
  assert.throws(() => parseTutorRequest({ context: 'not an object' }), ValidationError);
});

test('a request with nothing to look at is refused', () => {
  assert.throws(
    () => parseTutorRequest({ context: { document: { title: 'x' } } }),
    /nothing on this page/
  );
});

test('an unknown mode is dropped rather than passed upstream', () => {
  const { context } = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, mode: 'jailbreak' },
  });
  assert.equal(context.mode, undefined);
});

test('page numbers are clamped to something sane', () => {
  const { context } = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, document: { pageNumber: -5, pageCount: 10 ** 9 } },
  });
  assert.equal(context.document.pageNumber, 1);
  assert.equal(context.document.pageCount, 10_000);
});

test('oversized text fields are refused', () => {
  assert.throws(
    () =>
      parseTutorRequest({
        ...validBody,
        context: { ...validBody.context, printedText: 'x'.repeat(50_000) },
      }),
    /too long/
  );
});

test('non-string text fields are refused', () => {
  assert.throws(
    () =>
      parseTutorRequest({
        ...validBody,
        context: { ...validBody.context, printedText: { nested: 'object' } },
      }),
    ValidationError
  );
});

test('examMode and allowFullSolutions default safely', () => {
  const { context } = parseTutorRequest(validBody);
  assert.equal(context.examMode, false);
  assert.equal(context.allowFullSolutions, true);

  const strict = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, examMode: true, allowFullSolutions: false },
  });
  assert.equal(strict.context.examMode, true);
  assert.equal(strict.context.allowFullSolutions, false);
});

test('only "true" enables exam mode, not any truthy value', () => {
  const { context } = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, examMode: 'yes' },
  });
  assert.equal(context.examMode, false);
});

test('conversation turns are capped and normalised', () => {
  const turns = Array.from({ length: 40 }, (_, i) => ({ role: 'weird', text: `t${i}` }));
  const { context } = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, recentTurns: turns },
  });
  assert.equal(context.recentTurns.length, 8);
  assert.ok(context.recentTurns.every((turn) => turn.role === 'student'));
});

test('malformed turns are dropped, not fatal', () => {
  const { context } = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, recentTurns: [null, 42, { role: 'tutor' }, { role: 'tutor', text: 'ok' }] },
  });
  assert.equal(context.recentTurns.length, 1);
  assert.equal(context.recentTurns[0].text, 'ok');
});

test('remembered topics are capped at three and length-limited', () => {
  const { context } = parseTutorRequest({
    ...validBody,
    context: { ...validBody.context, strugglingWith: ['a', 'b', 'c', 'd', 'x'.repeat(200)] },
  });
  assert.equal(context.strugglingWith.length, 3);
});

test('a valid image attachment is accepted', () => {
  const { attachments } = parseTutorRequest({
    ...validBody,
    attachments: [{ kind: 'region', mediaType: 'image/jpeg', data: 'QUJDRA==' }],
  });
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].kind, 'region');
});

test('an unknown attachment kind falls back to "page"', () => {
  const { attachments } = parseTutorRequest({
    ...validBody,
    attachments: [{ kind: 'exfiltrate', data: 'QUJDRA==' }],
  });
  assert.equal(attachments[0].kind, 'page');
});

test('an unsupported media type falls back to jpeg', () => {
  const { attachments } = parseTutorRequest({
    ...validBody,
    attachments: [{ kind: 'page', mediaType: 'application/pdf', data: 'QUJDRA==' }],
  });
  assert.equal(attachments[0].mediaType, 'image/jpeg');
});

test('an enormous image is refused before it is decoded', () => {
  assert.throws(
    () =>
      parseTutorRequest({
        ...validBody,
        attachments: [{ kind: 'page', data: 'A'.repeat(8 * 1024 * 1024) }],
      }),
    /too large/
  );
});

test('a non-base64 payload is refused', () => {
  assert.throws(
    () =>
      parseTutorRequest({
        ...validBody,
        attachments: [{ kind: 'page', data: 'not base64!!' }],
      }),
    /malformed/
  );
});

test('no more than two attachments survive', () => {
  const { attachments } = parseTutorRequest({
    ...validBody,
    attachments: [
      { kind: 'page', data: 'QUJDRA==' },
      { kind: 'page', data: 'QUJDRA==' },
      { kind: 'page', data: 'QUJDRA==' },
      { kind: 'page', data: 'QUJDRA==' },
    ],
  });
  assert.equal(attachments.length, 2);
});

// MARK: Voice

test('a voice request is accepted and the speed clamped', () => {
  assert.equal(parseVoiceRequest({ text: 'Hello', speed: 99 }).speed, 1.4);
  assert.equal(parseVoiceRequest({ text: 'Hello', speed: 0.1 }).speed, 0.7);
  assert.equal(parseVoiceRequest({ text: 'Hello' }).speed, 1);
});

test('an empty voice request is refused', () => {
  assert.throws(() => parseVoiceRequest({ text: '   ' }), /nothing to read out/);
  assert.throws(() => parseVoiceRequest({}), ValidationError);
});
