import dotenv from 'dotenv';

dotenv.config();

const VEKLOM_BASE = process.env.VEKLOM_BASE_URL || 'https://api.veklom.com';
const VEKLOM_KEY = process.env.VEKLOM_API_KEY; // byos_ key

async function healthCheck() {
  const url = `${VEKLOM_BASE.replace(/\/+$/, '')}/api/v1/health`;
  const res = await fetch(url);
  const text = await res.text();
  console.log('health', res.status, text);
  return { ok: res.ok, status: res.status, body: text };
}

async function authCheck() {
  const url = `${VEKLOM_BASE.replace(/\/+$/, '')}/api/v1/auth/login`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: VEKLOM_KEY }) }).catch((e: any) => ({ ok: false, status: 0, text: () => e.message } as any));
  const txt = await (res.text ? res.text() : 'no response body');
  console.log('auth', res.status, txt);
  return { ok: res.ok, status: res.status, body: txt };
}

async function execTest() {
  const url = `${VEKLOM_BASE.replace(/\/+$/, '')}/v1/exec`;
  const payload = {
    prompt: 'SYSTEM INSTRUCTIONS:\nRespond with valid JSON object: {"ok":true, "data":"hello"}',
    model: process.env.VEKLOM_MODEL || 'qwen2.5:3b',
    use_memory: false,
    max_tokens: 200,
    temperature: 0.1,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VEKLOM_KEY || '',
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
  await healthCheck();
  console.log('Running auth check...');
  await authCheck();
  console.log('Running exec test...');
  await execTest();

  console.log('Integration test complete.');
})();
