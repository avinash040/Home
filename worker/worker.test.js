import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

test('chat worker proxies prompt to Gemini API', async () => {
  const fakeResponse = { candidates: [ { content: { parts: [ { text: 'Hello' } ] } } ] };
  const fakeFetch = async (url, options) => {
    assert.equal(options.method, 'POST');
    return new Response(JSON.stringify(fakeResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const originalFetch = global.fetch;
  global.fetch = fakeFetch;
  try {
    const request = new Request('https://example.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hi' })
    });
    const env = { GEMINI_API_KEY: 'test-key' };
    const res = await worker.fetch(request, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, fakeResponse);
  } finally {
    global.fetch = originalFetch;
  }
});
