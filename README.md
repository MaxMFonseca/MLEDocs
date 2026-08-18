# MLE documentation

This repository builds the static documentation website for MLE. It is an
Astro and Starlight site that preserves documentation snapshots for specific
MLE commits.

## Requirements

- Node.js 22.12.0 or newer
- pnpm 11.19.0 (the version recorded in `packageManager`)

## Local development

Install dependencies and run the site with pnpm:

```powershell
pnpm install
pnpm dev
```

Run the static checks, production build, and full quality suite with:

```powershell
pnpm run check
pnpm build
pnpm test
```

The production site is published through GitHub Pages beneath the `/MLEDocs`
base path, so links and asset paths must remain base-aware.

## Agent workflow

Agents must read `.local/GUIDE.md` before changing the site. The `.local/`
directory contains local plans and research and is intentionally uncommitted.
