import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

async function getFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'data') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getFiles(full));
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function splitIntoChunks(text, file) {
  const chunks = [];
  const sources = [];

  if (file.endsWith('.html')) {
    const articles = text.match(/<article[\s\S]+?<\/article>/g) || [];
    if (articles.length > 0) {
      articles.forEach((article, i) => {
        const idMatch = article.match(/id="([^"]+)"/);
        const slug = idMatch ? idMatch[1] : `article-${i}`;
        chunks.push(article);
        sources.push(`${path.relative(root, file)}#${slug}`);
      });
    } else {
      // If no articles, chunk by sections with IDs
      const sections = text.match(/<section id="[^"]+"[\s\S]+?<\/section>/g) || [];
      if (sections.length > 0) {
        sections.forEach((section, i) => {
          const idMatch = section.match(/id="([^"]+)"/);
          const slug = idMatch ? idMatch[1] : `section-${i}`;
          chunks.push(section);
          sources.push(`${path.relative(root, file)}#${slug}`);
        });
      }
    }
  }

  if (chunks.length === 0) {
    chunks.push(text);
    sources.push(path.relative(root, file));
  }

  return { chunks, sources };
}

const root = process.cwd();
const files = await getFiles(root);
const vectors = [];
for (const file of files) {
  const text = await fs.readFile(file, 'utf8');
  const { chunks, sources } = splitIntoChunks(text, file);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const source = sources[i];
    const res = await fetch(EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: chunk }] }] }),
    });
    const data = await res.json();
    const embedding = data.embedding?.values ?? [];
    const id = crypto.createHash('sha256').update(chunk).digest('hex');
    vectors.push({ id, text: chunk, source, embedding });
  }
}

await fs.mkdir(path.join(root, 'data'), { recursive: true });
await fs.writeFile(path.join(root, 'data', 'vectors.json'), JSON.stringify(vectors, null, 2));
