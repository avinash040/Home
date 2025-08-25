import vectors from "../data/vectors.json" assert { type: "json" };

function cosineSimilarity(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const prompt = body?.prompt ?? "Say hello and confirm the proxy works.";

      let context = "";
      try {
        const embedRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY,
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        const embedData = await embedRes.json();
        const query = embedData.embedding?.values || [];
        const scored = vectors
          .map((v) => ({
            text: v.text,
            source: v.source,
            score: cosineSimilarity(query, v.embedding),
          }))
          .sort((a, b) => b.score - a.score);

        const unique = [];
        const seen = new Set();
        for (const s of scored) {
          const company = s.source.includes("#")
            ? s.source.split("#")[1].split("/")[0]
            : s.source.split("/")[0];
          if (!seen.has(company)) {
            unique.push(s);
            seen.add(company);
          }
          if (unique.length === 3) break;
        }

        context = unique.map((s) => s.text).join("\n\n");
      } catch {
        // ignore retrieval errors and fall back to no context
      }

      const instruction =
        "You are answering on behalf of Avinash Kothapalli. " +
        "Speak in the first person when describing his work experience.";
      const parts = [{ text: instruction }];
      if (context) {
        parts.push({ text: context });
      }
      parts.push({ text: prompt });

      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts }],
          }),
        }
      );

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("OK", { status: 200 });
  },
};
