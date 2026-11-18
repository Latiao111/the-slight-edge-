import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractGeminiErrorDetails,
  FALLBACK_GEMINI_MODEL,
  formatGeminiErrorMessage,
  isTransientGeminiError,
  PRIMARY_GEMINI_MODEL,
  runWithGeminiRetryAndFallback,
} from './geminiRetry';

test('extractGeminiErrorDetails unwraps nested @google/genai JSON error payloads', () => {
  const nested = new Error(
    JSON.stringify({
      error: {
        message: JSON.stringify({
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
            status: 'UNAVAILABLE',
          },
        }),
        code: 503,
        status: 'Service Unavailable',
      },
    })
  );

  const details = extractGeminiErrorDetails(nested);
  assert.equal(details.code, 503);
  assert.equal(details.status, 'UNAVAILABLE');
  assert.match(details.message, /high demand/i);
});

test('isTransientGeminiError classifies 503/429/timeout as transient and 403/400 key errors as non-transient', () => {
  assert.equal(
    isTransientGeminiError(new Error('{"error":{"code":503,"status":"UNAVAILABLE","message":"high demand"}}')),
    true
  );
  assert.equal(isTransientGeminiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }), true);
  assert.equal(isTransientGeminiError(new Error('Request timeout after 15000ms')), true);
  assert.equal(isTransientGeminiError({ status: 403, message: 'PERMISSION_DENIED' }), false);
  assert.equal(isTransientGeminiError(new Error('API_KEY_INVALID')), false);
});

test('formatGeminiErrorMessage produces clean Chinese error messages without raw JSON', () => {
  const err503 = new Error(
    '{"error":{"code":503,"status":"UNAVAILABLE","message":"This model is currently experiencing high demand."}}'
  );
  const msgTeacher = formatGeminiErrorMessage(err503, 'teacher');
  const msgTranslate = formatGeminiErrorMessage(err503, 'translate');

  assert.doesNotMatch(msgTeacher, /\{|\}|\\"/);
  assert.match(msgTeacher, /繁忙|激增/);
  assert.match(msgTranslate, /已保留已译段落/);
});

test('runWithGeminiRetryAndFallback retries primary model then falls back on persistent 503', async () => {
  const calls: string[] = [];
  const result = await runWithGeminiRetryAndFallback({
    primaryAttempts: 2,
    fallbackAttempts: 2,
    sleep: async () => {},
    execute: async ({ model, attempt, isFallback }) => {
      calls.push(`${model}:${attempt}:${isFallback}`);
      if (model === PRIMARY_GEMINI_MODEL) {
        throw new Error('{"error":{"code":503,"status":"UNAVAILABLE","message":"high demand"}}');
      }
      return 'OK_FROM_FALLBACK';
    },
  });

  assert.equal(result, 'OK_FROM_FALLBACK');
  assert.deepEqual(calls, [
    `${PRIMARY_GEMINI_MODEL}:1:false`,
    `${PRIMARY_GEMINI_MODEL}:2:false`,
    `${FALLBACK_GEMINI_MODEL}:1:true`,
  ]);
});

test('runWithGeminiRetryAndFallback does not retry or fall back on 403 key errors', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      runWithGeminiRetryAndFallback({
        sleep: async () => {},
        execute: async ({ model }) => {
          calls.push(model);
          throw Object.assign(new Error('PERMISSION_DENIED'), { status: 403 });
        },
      }),
    /PERMISSION_DENIED/
  );
  assert.deepEqual(calls, [PRIMARY_GEMINI_MODEL]);
});
