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

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function splitIntoChunks(text, file) {
  const chunks = [];
  const sources = [];
  const labels = [];

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
      // If no articles, chunk by sections (use heading text if id missing)
      const sections = text.match(/<section[\s\S]+?<\/section>/g) || [];
      if (sections.length > 0) {
        sections.forEach((section, i) => {
          const idMatch = section.match(/id="([^"]+)"/);
          let slug = idMatch ? idMatch[1] : '';
          if (!slug) {
            const headingMatch = section.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/);
            slug = headingMatch ? slugify(headingMatch[1]) : `section-${i}`;
          }
          chunks.push(section);
          sources.push(`${path.relative(root, file)}#${slug}`);
          const headingMatch = section.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/);
          labels.push(headingMatch ? headingMatch[1] : slug);
        });
      }
    }
  }

  if (chunks.length === 0) {
    chunks.push(text);
    sources.push(path.relative(root, file));
    labels.push(path.basename(file));
  }

  return { chunks, sources, labels };
}

const root = process.cwd();
const files = await getFiles(root);
const vectors = [];
for (const file of files) {
  const text = await fs.readFile(file, 'utf8');
  const { chunks, sources, labels } = splitIntoChunks(text, file);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const source = sources[i];
    const label = labels[i];
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
    vectors.push({ id, text: chunk, source, label, embedding });
  }
}

await fs.mkdir(path.join(root, 'data'), { recursive: true });
await fs.writeFile(path.join(root, 'data', 'vectors.json'), JSON.stringify(vectors, null, 2));
