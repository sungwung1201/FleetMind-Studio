# Deployment Guide

## Local Production Build

```bash
npm install
npm run build
npm run preview
```

## Vercel Deployment

1. Push the repository to GitHub.
2. Open Vercel and import the repository.
3. Use the following settings:

| Field | Value |
|---|---|
| Framework | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Deploy.
5. Copy the Live Demo URL into `README.md`.

## Netlify Deployment

1. Push the repository to GitHub.
2. Open Netlify and import the repository.
3. Use the following settings:

| Field | Value |
|---|---|
| Build Command | `npm run build` |
| Publish Directory | `dist` |

4. Deploy.
5. Copy the Live Demo URL into `README.md`.

## GitHub Pages

If deploying to GitHub Pages under a repository subpath, configure Vite `base` as needed.

```ts
// vite.config.ts
export default defineConfig({
  base: "/fleetmind-studio/",
});
```
