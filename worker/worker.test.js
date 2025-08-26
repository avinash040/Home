import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import vectors from '../data/vectors.json' assert { type: 'json' };

test('chat worker performs retrieval and forwards context', async () => {
  const fakeEmbedding = { embedding: { values: vectors[0].embedding } };
  const fakeResponse = { candidates: [ { content: { parts: [ { text: 'Hello' } ] } } ] };
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes(':embedContent')) {
      return new Response(JSON.stringify(fakeEmbedding), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (url.includes(':generateContent')) {
      const body = JSON.parse(options.body);
      assert.equal(body.contents[0].parts.length, 3);
      assert.ok(body.contents[0].parts[0].text.includes('Avinash Kothapalli'));
      assert.ok(body.contents[0].parts[1].text.includes('Avinash Kothapalli'));
      assert.equal(body.contents[0].parts[2].text, 'Hi');
      return new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    throw new Error('Unexpected fetch: ' + url);
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
    assert.deepEqual(data.candidates, fakeResponse.candidates);
    assert.equal(data.sources.length, 5);
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
