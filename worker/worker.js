import { pipeline, env as tEnv } from "@xenova/transformers";

// EXACT versions you actually have installed (update both if you change deps)
const TRANSFORMERS_VERSION = "2.13.3";
const ORT_VERSION = "1.18.0";

// Prefer ORT’s own CDN path (more stable than bundling inside transformers dist)
tEnv.backends.onnx.wasm.wasmPaths =
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
tEnv.backends.onnx.wasm.numThreads = 1;
tEnv.backends.onnx.wasm.simd = false;
tEnv.useBrowserCache = true;
tEnv.allowLocalModels = false;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(init.headers || {}) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/__wasm_check" && request.method === "GET") {
      const base = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
      const files = [
        "ort-wasm.wasm",
        "ort-wasm-simd.wasm",
        "ort-wasm-threaded.wasm",
        "ort-wasm-simd-threaded.wasm",
      ];
      const results = await Promise.all(
        files.map(async (f) => {
          const r = await fetch(base + f, { method: "HEAD" });
          return { file: f, ok: r.ok, status: r.status };
        })
      );
      return new Response(JSON.stringify({ base, results }, null, 2), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return jsonResponse({ error: "not_found" }, { status: 404 });
    }

    let input;
    try {
      input = await request.json();
    } catch (_) {
      return jsonResponse({ error: "invalid_json" }, { status: 400 });
    }

    if (!input?.message || typeof input.message !== "string") {
      return jsonResponse({ error: "missing_message" }, { status: 400 });
    }

    try {
      const topK = parseInt(env.TOP_K || "5", 10);
      const maxChars = parseInt(env.MAX_CONTEXT_CHARS || "6000", 10);

      // Fetch index
      const indexRes = await fetch(env.VECTORS_URL);
      if (!indexRes.ok) {
        throw new Error(`vectors fetch failed: ${indexRes.status}`);
      }
      const index = await indexRes.json();

      // Embed query
      const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      const qEmbed = await embedder(input.message, { pooling: "mean", normalize: true });
      const q = Array.from(qEmbed.data);

      const l2 = (arr) => Math.sqrt(arr.reduce((s, v) => s + v * v, 0));

      const scored = index.map((item, idx) => {
        const emb = item.embedding;
        const norm = l2(emb);
        const score = emb.reduce((s, v, i) => s + v * q[i], 0) / norm; // query already normalized
        return { ...item, score, label: `#${idx + 1}` };
      });

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, topK);

      let context = "";
      const sources = [];
      for (let i = 0; i < top.length; i++) {
        const r = top[i];
        const chunk = `[#${i + 1} • ${r.source}]\n${r.text}\n\n`;
        if ((context + chunk).length > maxChars) break;
        context += chunk;
        sources.push({ label: `#${i + 1}`, path: r.source, score: r.score });
      }

      const system =
        "Answer strictly from the provided repository context. If the answer isn’t in the context, say you don’t know. Always cite sources inline like [#n • path].";
      const prompt = `${system}\n\nContext:\n${context}\nUser: ${input.message}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
          }),
        }
      );

      if (!geminiRes.ok) {
        throw new Error(await geminiRes.text());
      }
      const geminiData = await geminiRes.json();
      const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return jsonResponse({ answer, sources });
    } catch (err) {
      return jsonResponse({ error: "internal_error", detail: err.message }, { status: 500 });
    }
  },
};
