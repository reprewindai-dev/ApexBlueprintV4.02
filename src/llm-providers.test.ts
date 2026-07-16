import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenAICompatibleRequest } from './llm-providers';

test('Veklom provider resolves to the live Veklom chat endpoint', () => {
  const request = buildOpenAICompatibleRequest({
    provider: 'veklom',
    apiKey: 'test-token',
    modelName: 'qwen2.5-coder:1.5b',
    authMode: 'bearer',
  });

  assert.equal(request.chatUrl, 'https://api.veklom.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer test-token');
  assert.equal(request.payload.model, 'qwen2.5-coder:1.5b');
});

test('Veklom verification uses the models endpoint', () => {
  const request = buildOpenAICompatibleRequest({
    provider: 'veklom',
    apiKey: 'test-token',
    modelName: 'qwen2.5-coder:1.5b',
    authMode: 'bearer',
    mode: 'verify',
  });

  assert.equal(request.verifyUrl, 'https://api.veklom.com/v1/models');
});
