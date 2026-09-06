# FB Group Poster

A Next.js web app that lets you post to multiple Facebook groups as your Page, using browser automation (Playwright) with your own logged-in Facebook session.

## Features

- **Facebook login via a real browser window** — log in manually once; the session is persisted and reused automatically.
- **Page management** — detect the Facebook Pages you manage and select which Page to post as.
- **Group discovery** — scrape the groups associated with your Pages, cached locally in `data/groups.json`.
- **Multi-group posting** — compose a message (with optional image) and post it to selected groups one by one, with per-group status feedback.
- **Dashboard UI** — built with React 19, Tailwind CSS 4, and shadcn/ui components, including dark mode support.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, Node.js runtime for API routes)
- React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui + lucide-react
- [Playwright](https://playwright.dev) for browser automation
- [sonner](https://sonner.emilkowal.dev) for toast notifications

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

## Usage

1. **Log in** — from the dashboard, trigger the login flow. A Playwright-driven browser window opens; log in to Facebook manually. The session is saved to `data/session.json`.
2. **Detect Pages** — the app scrapes the Pages you manage (`/api/pages`) and caches them.
3. **Detect Groups** — fetch the groups for your Pages (`/api/groups`), cached in `data/groups.json`.
4. **Post** — write your message, optionally attach an image, and submit (`/api/post`). The app switches to the selected Page (if any) and posts to each selected group, reporting success/failure per group.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/route.ts    # GET status, POST open login window, DELETE logout
│   │   ├── pages/route.ts   # Detect managed Facebook Pages
│   │   ├── groups/route.ts  # Detect & cache groups
│   │   └── post/route.ts    # Post to selected groups
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── dashboard.tsx        # Main dashboard UI
│   ├── theme-toggle.tsx     # Dark mode toggle
│   └── ui/                  # shadcn/ui primitives
└── lib/
    ├── facebook/            # poster, pages, scraper (Playwright automation)
    ├── playwright.ts        # Browser context & session management
    ├── cache.ts             # Local cache (data/groups.json)
    ├── session.ts           # Persisted login state
    └── types.ts             # Shared TypeScript types
```

## Data Files

- `data/session.json` — persisted Facebook login session/cookies.
- `data/groups.json` — cached Pages and groups.
- `browser-data/` — Playwright persistent browser profile.

> ⚠️ These files contain sensitive session data. Do not commit or share them.

## Notes & Caveats

- This tool automates posting via a real browser using your own account. Use responsibly — excessive automated posting may violate Facebook's Terms of Service and could risk account restrictions.
- Facebook's UI changes frequently; scraping/posting selectors may need updating when that happens.

