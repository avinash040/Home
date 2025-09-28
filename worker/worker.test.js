import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import siteContext from '../data/site-context.json' assert { type: 'json' };

test('chat worker forwards full site context to Gemini 2.5 Pro', async () => {
  const fakeResponse = { candidates: [ { content: { parts: [ { text: 'Hello' } ] } } ] };
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes(':generateContent')) {
      const body = JSON.parse(options.body);
      assert.equal(body.contents[0].parts.length, 3);
      assert.ok(body.contents[0].parts[0].text.includes('Avinash Kothapalli'));
      for (const file of siteContext.files) {
        assert.ok(body.contents[0].parts[1].text.includes(`File: ${file.path}`));
        const sample = file.content.trim().slice(0, 20);
        if (sample) {
          assert.ok(body.contents[0].parts[1].text.includes(sample));
        }
      }
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
    assert.equal(data.sources.length, siteContext.files.length);
    for (const file of siteContext.files) {
      assert.ok(data.sources.some((source) => source.path === file.path));
    }
    assert.equal(calls.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
