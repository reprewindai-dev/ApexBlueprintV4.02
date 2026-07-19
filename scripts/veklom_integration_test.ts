import dotenv from 'dotenv';

dotenv.config();

const VEKLOM_BASE = process.env.VEKLOM_BASE_URL || 'https://api.veklom.com';
const VEKLOM_KEY = process.env.VEKLOM_API_KEY;

async function healthCheck() {
  const url = `${VEKLOM_BASE.replace(/\/+$/, '')}/health`;
  const res = await fetch(url);
  const text = await res.text();
  console.log('health', res.status, text);
  return { ok: res.ok, status: res.status, body: text };
}

async function modelsCheck() {
  const url = `${VEKLOM_BASE.replace(/\/+$/, '')}/v1/models`;
  const res = await fetch(url);
  const text = await res.text();
  console.log('models', res.status, text.slice(0, 500));
  if (!res.ok) throw new Error(`models check failed with HTTP ${res.status}`);
  return JSON.parse(text);
}

async function execTest() {
  const url = `${VEKLOM_BASE.replace(/\/+$/, '')}/v1/chat/completions`;
  const payload = {
    messages: [{ role: 'user', content: 'Respond only with the word OK.' }],
    model: process.env.VEKLOM_MODEL || 'qwen2.5-coder:1.5b',
    max_tokens: 200,
    temperature: 0.1,
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VEKLOM_KEY || ''}`,
    },
    body: JSON.stringify(payload),
  }).catch(e => ({ ok: false, status: 0, text: () => e.message } as any));

  const text = await (res.text ? res.text() : 'no body');
  console.log('exec', res.status, text.slice(0, 200));
  return { ok: res.ok, status: res.status, body: text };
}

(async function main() {
  if (!VEKLOM_KEY) {
    console.error('VEKLOM_API_KEY is not set in environment. Aborting.');
    process.exit(2);
  }

  console.log('VEKLOM_BASE:', VEKLOM_BASE);
  console.log('Running health check...');
  const health = await healthCheck();
  if (!health.ok) process.exitCode = 1;
  console.log('Running models check...');
  await modelsCheck();
  console.log('Running exec test...');
  const exec = await execTest();
  if (!exec.ok) process.exitCode = 1;

  console.log('Integration test complete.');
})();
