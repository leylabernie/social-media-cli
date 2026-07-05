# LuxeMia Social — Automated Social Media Posting CLI

A Node.js + TypeScript CLI tool that automates social media posting by driving real browser sessions via Playwright. Built for [LuxeMia](https://luxemia.shop) to scrape product info, generate AI captions, and post to X (Twitter), Instagram, Facebook, Pinterest, and LinkedIn — all without APIs or developer apps.

---

## Table of Contents

- [Why Browser Automation?](#why-browser-automation)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Daily Workflow](#daily-workflow)
- [Commands Reference](#commands-reference)
- [Architecture](#architecture)
- [Anti-Ban Best Practices](#anti-ban-best-practices)
- [Troubleshooting](#troubleshooting)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [ToS Disclaimer](#tos-disclaimer)

---

## Why Browser Automation?

| Approach | Setup Time | Ongoing Maintenance | Platforms | Rate Limits |
|----------|-----------|---------------------|-----------|-------------|
| **Browser Automation** | 15 min | Low | All 5 platforms | None |
| Meta Graph API | 2-4 weeks | High (token refresh) | IG + FB only | Yes |
| X API v2 | 1-2 weeks | Medium (OAuth) | X only | Yes |
| Pinterest API | 1-2 weeks | Medium | Pinterest only | Yes |
| LinkedIn API | 1-2 weeks | High (partnership req) | LinkedIn only | Yes |

This tool avoids:
- Meta App Review (2-4 week process)
- OAuth flows and token refresh
- API rate limits
- Platform restrictions (no API for Threads/TikTok if needed later)

Instead, you log in once per platform in a real browser. The tool saves your session and reuses it for headless posting.

---

## Prerequisites

- **Node.js v24+** (check with `node --version`)
- **An OpenAI API key** — for AI caption generation ([get one here](https://platform.openai.com/api-keys))
- **Accounts on each platform** you want to post to
- **Admin access** to your Facebook Page

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url> luxemia-social
cd luxemia-social
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install chromium
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your details:

```env
# Required — get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-key-here

# Your Facebook Page URL (you must be an admin)
FB_PAGE_URL=https://www.facebook.com/luxemiashop

# The Pinterest board to pin to
PINTEREST_BOARD_NAME=LuxeMia Products

# Optional — which platforms to post to by default
DEFAULT_PLATFORMS=x,instagram,facebook,pinterest,linkedin

# Optional — log level
LOG_LEVEL=info
```

### 4. Log in to all platforms (one-time setup)

```bash
npx tsx src/index.ts auth all
```

This opens a headed browser for each platform. Log in manually, then press Enter in the terminal to save the session.

Your login sessions are saved in `.browser-profiles/` and persist between runs.

---

## Daily Workflow

### Post a product

```bash
npx tsx src/index.ts post "https://luxemia.shop/products/apple-green-georgette-lehenga"
```

The tool will:

1. 🔍 **Scrape** the product page for title, price, description, and image
2. 🤖 **Generate** platform-specific captions using AI
3. 📝 **Show** you the captions for review — approve, edit, or skip each platform
4. 🖼️ **Resize** the product image for each platform's optimal dimensions
5. 🚀 **Post** to all approved platforms in parallel
6. 📋 **Save** results to local history

### Dry run (preview without posting)

```bash
npx tsx src/index.ts post "<url>" --dry-run
```

Generates captions and resizes images but does **not** launch browsers or post. Great for testing AI output.

### Post to specific platforms only

```bash
npx tsx src/index.ts post "<url>" --platforms x,instagram
```

### Schedule a post for later

```bash
npx tsx src/index.ts schedule "<url>" --at "2026-07-08T14:00"
```

### Check session status

```bash
npx tsx src/index.ts status
```

Shows which platforms you're logged into:

```
🔍 Checking session validity for all platforms...

✓ x:           Valid
✓ instagram:   Valid
✓ facebook:    Valid (Page: LuxeMia)
✓ pinterest:   Valid
✓ linkedin:    Valid

All 5 platforms authenticated.
```

### View post history

```bash
npx tsx src/index.ts history
```

### Re-authenticate a platform

If `status` shows a platform as invalid:

```bash
npx tsx src/index.ts auth x
npx tsx src/index.ts auth instagram
npx tsx src/index.ts auth all
```

### Retry a failed post

```bash
npx tsx src/index.ts retry <post-id>
```

---

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `post <url>` | Scrape and post a product | `post "https://luxemia.shop/products/..."` |
| `post <url> --dry-run` | Preview without posting | `post "<url>" --dry-run` |
| `post <url> --platforms` | Post to selected platforms | `post "<url>" --platforms x,instagram` |
| `auth <platform>` | Log in to a platform | `auth x` or `auth all` |
| `status` | Check all session statuses | `status` |
| `history` | Show recent posts | `history` |
| `schedule <url> --at` | Schedule a post | `schedule "<url>" --at "2026-07-08T14:00"` |
| `retry <post-id>` | Retry a failed post | `retry abc-123` |
| `config` | Show current config | `config` |
| `config --set` | Update a config value | `config --set FB_PAGE_URL=https://...` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLI (Commander)                       │
│              src/index.ts + src/commands/                │
├─────────────────────────────────────────────────────────┤
│  Post Flow: scrape → AI captions → review → resize → post│
├──────────┬──────────┬──────────────┬──────────────────────┤
│ Scraper  │  AI      │  Image       │  Browser Manager     │
│ (Cheerio)│ (OpenAI) │  (Sharp)     │  (Playwright)        │
├──────────┴──────────┴──────────────┴──────────────────────┤
│              Platform Browser Integrations                │
│     X    Instagram    Facebook    Pinterest    LinkedIn   │
├───────────────────────────────────────────────────────────┤
│               Storage (SQLite) + Scheduler (Cron)          │
└───────────────────────────────────────────────────────────┘
```

### Browser Automation Details

- **Persistent profiles**: Each platform has its own browser profile (`.browser-profiles/{platform}/`) with saved cookies and session state
- **Headless posting**: All posting happens in headless mode for speed
- **Human-like behavior**: Variable typing delays, mouse movements, scrolling — to avoid detection
- **Stealth mode**: Playwright Extra with stealth plugin masks automation fingerprints
- **Session expiry detection**: Checks if you're still logged in before posting; prompts re-auth if needed

### Image Dimensions Per Platform

| Platform | Dimensions | Ratio | Purpose |
|----------|-----------|-------|---------|
| X | 1200 x 675 | 16:9 | Timeline optimized |
| Instagram | 1080 x 1350 | 4:5 | Best engagement |
| Facebook | 1200 x 630 | 1.91:1 | Link preview |
| Pinterest | 1000 x 1500 | 2:3 | Vertical pin |
| LinkedIn | 1200 x 627 | 1.91:1 | Feed optimized |

---

## Anti-Ban Best Practices

### Do ✅
- Post **1-3 times per day** per platform
- Use the built-in `--dry-run` to preview before posting
- Space out posts across platforms (built-in delays help)
- Re-authenticate promptly when `status` shows expired sessions
- Monitor for "Verify it's you" prompts

### Don't ❌
- Post the same content to all platforms within the same minute
- Post more than 5 times per day per platform
- Use instant/automated-looking behavior (the tool already prevents this)
- Ignore "suspicious activity" warnings — slow down if you see them
- Share your `.browser-profiles/` directory (contains login cookies)

### If you get a warning
1. Stop using the tool for 24-48 hours
2. Log in manually to the platform
3. Slow your posting frequency
4. Increase delays (edit `src/browser/human.ts` — increase `minMs`/`maxMs` values)

---

## Troubleshooting

### Captcha appears during posting
The tool automatically:
- Saves a screenshot to `.cache/screenshots/`
- Prints a warning with the screenshot path
- Skips that platform

**Solution**: Re-run `npx tsx src/index.ts auth <platform>` to log in manually and solve the captcha in headed mode.

### "Suspicious activity" warning
**Solution**: Wait 24 hours. Post less frequently. Increase human delay values in `src/browser/human.ts`.

### Selector not found error
Platform UIs change. The error message will tell you which selector failed.

**Solution**: Update the selector in `src/platforms/{platform}.ts`. Use browser DevTools to find the new selector. Each platform module has fallback selectors — add the new one to the list.

### Session keeps expiring
**Solution**: Some platforms expire sessions more frequently. Run `npx tsx src/index.ts auth <platform>` to refresh. Instagram typically needs re-auth every 2-4 weeks.

### Image upload fails
**Solution**: Check the image URL is publicly accessible. The tool downloads the image first, then uploads it. If the source image is behind authentication, the download will fail.

### Post not appearing on the platform
1. Check the `history` command — did the tool report success?
2. Check `.cache/screenshots/` for debug screenshots
3. Try posting manually to verify the platform is working
4. Run with `LOG_LEVEL=debug` for verbose output

---

## How It Works

### Authentication Flow (`auth`)
```
Launch headed browser → Navigate to login page → User logs in manually
→ Press Enter in terminal → Browser profile saved to .browser-profiles/
```

### Posting Flow (`post`)
```
Validate URL → Scrape product (Cheerio + native fetch)
  → Generate captions (OpenAI GPT-4o-mini, parallel per platform)
  → Interactive review (Inquirer prompts: approve/edit/skip)
  → Resize images (Sharp, parallel per platform, optimal dimensions)
  → For each approved platform:
      → Launch headless browser with saved profile
      → Check session validity
      → Navigate to composer
      → Type caption with human-like delays
      → Upload resized image
      → Click Post
      → Extract post URL
      → Close browser
  → Save results to SQLite history
```

### Session Check (`status`)
```
For each platform:
  → Launch headless browser
  → Navigate to home page
  → Check for login form (invalid) or feed (valid)
  → Report status
```

---

## Project Structure

```
luxemia-social/
├── package.json
├── tsconfig.json
├── .env
├── .env.example
├── .gitignore
├── README.md
├── SPEC.md
├── data/
│   └── luxemia-social.db          # SQLite database (auto-created)
├── .cache/
│   └── images/                    # Resized images
├── .browser-profiles/             # Saved browser sessions (NEVER commit)
│   ├── x/
│   ├── instagram/
│   ├── facebook/
│   ├── pinterest/
│   └── linkedin/
└── src/
    ├── index.ts                   # CLI entry point
    ├── commands/                  # CLI subcommands
    │   ├── post.ts                # Main posting flow
    │   ├── auth.ts                # Authentication flow
    │   ├── status.ts              # Session status check
    │   ├── history.ts             # Post history
    │   ├── schedule.ts            # Scheduled posting
    │   ├── retry.ts               # Retry failed posts
    │   └── config.ts              # Configuration
    ├── scraper/
    │   └── product.ts             # Luxemia.shop product scraper
    ├── ai/
    │   └── caption-generator.ts   # OpenAI caption generation
    ├── image/
    │   └── processor.ts           # Sharp image resizing
    ├── browser/                   # Browser automation utilities
    │   ├── launch.ts              # Headless/headed browser launch
    │   ├── auth-flow.ts           # First-run authentication
    │   ├── profile-manager.ts     # Persistent profile management
    │   ├── human.ts               # Human-like delays and interactions
    │   ├── session-check.ts       # Session validity detection
    │   └── stealth.ts             # Anti-detection scripts
    ├── platforms/                 # Platform integrations
    │   ├── types.ts               # Shared interfaces
    │   ├── x.ts                   # X (Twitter)
    │   ├── instagram.ts           # Instagram
    │   ├── facebook.ts            # Facebook Page
    │   ├── pinterest.ts           # Pinterest
    │   └── linkedin.ts            # LinkedIn
    ├── storage/
    │   ├── db.ts                  # SQLite database
    │   └── schema.sql             # Database schema
    ├── scheduler/
    │   └── cron.ts                # Cron-based scheduling
    ├── review/
    │   └── interactive.ts         # Interactive caption review
    ├── types/
    │   └── playwright-core.d.ts   # Type declarations
    └── utils/
        ├── env.ts                 # Environment validation
        └── logger.ts              # Colored logging
```

---

## ToS Disclaimer

> **This tool automates posting via real browser sessions. This may violate the Terms of Service of social media platforms. Use at your own risk. The author is not responsible for account bans, suspensions, or any other consequences.**
>
> This tool is intended for personal use only. It does not scrape user data, send spam, or engage in harassment. It simply automates the same actions a human would take when posting their own content.

### Platform-specific considerations:
- **X**: Automation of posting is generally tolerated for personal accounts at low frequency
- **Instagram**: Stricter detection — the stealth plugin and human delays are essential
- **Facebook**: Page posting via browser is functionally identical to manual posting
- **Pinterest**: Low risk — browser posting is widely used
- **LinkedIn**: Professional tone recommended; low frequency is safest

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Node.js 24+ | Runtime |
| TypeScript (strict) | Language |
| Playwright Extra + Stealth | Browser automation |
| Cheerio | HTML scraping |
| Sharp | Image processing |
| OpenAI GPT-4o-mini | Caption generation |
| better-sqlite3 | Local database |
| Commander | CLI framework |
| Inquirer | Interactive prompts |
| node-cron | Scheduling |
| chalk | Colored output |

---

## License

MIT
