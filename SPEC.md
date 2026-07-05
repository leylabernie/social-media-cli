# LuxeMia Social — SPEC.md

## Overview
A Node.js + TypeScript CLI tool that automates social media posting by driving real browser sessions via Playwright. Scrapes product info from luxemia.shop, generates AI captions, and posts to connected social accounts through browser automation.

## Architecture
- **CLI**: Commander + Inquirer for interactive flows
- **Scraper**: Cheerio for HTML parsing of luxemia.shop product pages
- **AI**: OpenAI GPT-4o-mini for platform-specific caption generation
- **Image**: Sharp for per-platform image resizing
- **Browser**: Playwright-extra + stealth plugin with persistent profiles
- **Storage**: better-sqlite3 for post history and session logging
- **Scheduler**: node-cron for delayed posting

## Module Boundaries

### Core (Agent 1)
- `src/index.ts` — CLI entry with commander
- `src/commands/` — All CLI commands (post, auth, status, history, schedule, retry, config)
- `src/scraper/product.ts` — Product page scraper
- `src/ai/caption-generator.ts` — OpenAI caption generation
- `src/image/processor.ts` — Sharp image processing
- `src/browser/` — Browser management (launch, auth-flow, profile-manager, human.ts, session-check, stealth)
- `src/storage/` — SQLite database + schema
- `src/scheduler/` — Cron-based scheduling
- `src/review/` — Interactive review prompts
- `src/platforms/types.ts` — Shared platform interface
- `src/utils/` — Env validation, logger

### Platforms (Agents 2-6)
- `src/platforms/x.ts` — X/Twitter browser integration
- `src/platforms/instagram.ts` — Instagram browser integration
- `src/platforms/facebook.ts` — Facebook Page browser integration
- `src/platforms/pinterest.ts` — Pinterest browser integration
- `src/platforms/linkedin.ts` — LinkedIn browser integration

## Data Interfaces

### ProductInfo
```typescript
interface ProductInfo {
  title: string;
  description: string;
  price: string;
  url: string;
  imageUrl: string;
  tags: string[];
}
```

### PlatformPost (per-platform result)
```typescript
interface PlatformPost {
  platform: string;
  caption: string;
  imagePath: string;
  postUrl?: string;
  postedAt?: string;
  error?: string;
}
```

### PostRecord (DB schema)
```sql
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  product_url TEXT NOT NULL,
  product_title TEXT,
  product_image_url TEXT,
  created_at TEXT NOT NULL,
  scheduled_at TEXT,
  status TEXT NOT NULL,
  platforms_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  event TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);
```

## Platform Specifications

### X (Twitter)
- Auth: https://x.com/login
- Profile: `.browser-profiles/twitter/`
- Session check: https://x.com/home — look for login button
- Post: https://x.com/compose/post
- Selectors: `[data-testid="tweetTextarea_0"]`, image upload input, `[data-testid="tweetButton"]`
- Caption: max 280 chars, 1-2 emojis, 2-3 hashtags, include URL
- Image: 1200x675 (16:9)

### Instagram
- Auth: https://www.instagram.com/accounts/login/
- Profile: `.browser-profiles/instagram/`
- Session check: https://instagram.com/ — look for login form
- Post: Click create button → select Post → upload → caption → share
- Selectors: create button, file input, caption textarea, share button
- Caption: max 2200 chars, 5-8 emojis, 10-15 hashtags, include URL
- Image: 1080x1350 (4:5)

### Facebook Page
- Auth: https://www.facebook.com/login/
- Profile: `.browser-profiles/facebook/`
- Session check: https://facebook.com/ — look for login form
- Post: Navigate to page URL → create post → photo/video → caption → post
- Selectors: composer div, photo upload, post button
- Caption: <500 chars recommended, 2-3 emojis, conversational
- Image: 1200x630 (1.91:1)

### Pinterest
- Auth: https://www.pinterest.com/login/
- Profile: `.browser-profiles/pinterest/`
- Session check: https://pinterest.com/ — look for login button
- Post: Click Create → Create Pin → upload → title + description + link + board → publish
- Selectors: create button, image upload, title input, description textarea, link input, board dropdown, publish button
- Caption: Title (≤100 chars) + Description (≤500 chars). URL in link field, NOT in description
- Image: 1000x1500 (2:3)

### LinkedIn
- Auth: https://www.linkedin.com/login
- Profile: `.browser-profiles/linkedin/`
- Session check: https://linkedin.com/feed/ — look for sign-in form
- Post: Click "Start a post" → type caption → add image → post
- Selectors: start post button, contenteditable textarea, image icon, file input, post button
- Caption: ≤700 chars recommended, professional tone, 1-2 emojis, include URL
- Image: 1200x627 (1.91:1)

## Critical Implementation Notes
1. Each platform has its own persistent browser profile directory
2. First-run auth uses HEADED browser; posting uses HEADLESS
3. ALWAYS use playwright-extra + stealth plugin
4. Human-like delays MANDATORY (humanType, humanClick, humanDelay)
5. Session expiry detection with graceful skip
6. Captcha detection: save screenshot, warn user, skip platform
7. Image upload via setInputFiles on input[type="file"]
8. Multiple fallback selectors for UI brittleness
9. .browser-profiles/ in .gitignore (contains session cookies)
10. --dry-run generates content without browser launch

## Build Order
1. Agent 1: Core infrastructure (all shared modules)
2. Agents 2-6: Platform integrations (parallel)
3. Agent 7: Integration testing + README
