# Avinash Kothapalli - Personal Website

This repository contains the source for my personal website. The site highlights my professional experience, projects and links to my resume.

To view the site locally, open `index.html` in a web browser. You can also serve it with any static file server if you prefer.

To publish the site with GitHub Pages:

1. Push the contents of this repository to GitHub.
2. In the repository settings, enable GitHub Pages and choose the `main` branch as the source.
3. The site will be available at `https://<your-username>.github.io/<repository-name>/`.

Feel free to customize the content or styling to keep the site up to date.

## Worker API

The `worker` directory contains a Cloudflare Worker that backs the `/api/chat` endpoint. It is configured by the `wrangler.toml` file at the repository root, which points to `worker/worker.js` and reads your Gemini API key from the `GEMINI_API_KEY` environment variable.

For local development:

1. Copy `worker/.dev.vars.example` to `worker/.dev.vars`.
2. Set `GEMINI_API_KEY` in that file.
3. Run `npx wrangler dev` from the repository root.

For deployment on Cloudflare, store the key as a secret:

```sh
wrangler secret put GEMINI_API_KEY
```

Then deploy the worker from the repository root:

```sh
npx wrangler deploy
```

## Building the vector index

The chat endpoint retrieves context from embeddings stored in `data/vectors.json`. After modifying the site's content, rebuild this file so new sections are indexed:

```sh
npm run build:vectors
```

The build script now breaks large HTML files into article-sized chunks and automatically slugs section headings when IDs are missing. This ensures details from every work experience across the site are indexed for retrieval. Set `GEMINI_API_KEY` in your environment before running the command.
