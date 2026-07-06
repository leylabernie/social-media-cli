# LuxeMia Social — Social Media Automation Dashboard

A deployable Next.js web app that automates social media posting for [LuxeMia](https://luxemia.shop). Scrapes product info, generates AI captions, and posts to X, Instagram, Facebook, Pinterest, and LinkedIn via browser automation — all from a web dashboard.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/leylabernie/social-media-cli)

## Environment Variables

After deploying, set these in your Vercel dashboard (Settings → Environment Variables):

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for caption generation | Yes |
| `KV_URL` | Vercel KV URL (create at vercel.com/storage) | Yes |
| `KV_REST_API_URL` | Vercel KV REST API URL | Yes |
| `KV_REST_API_TOKEN` | Vercel KV REST API token | Yes |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV read-only token | Yes |
| `X_USERNAME` / `X_PASSWORD` | X login credentials | For X posting |
| `INSTAGRAM_USERNAME` / `INSTAGRAM_PASSWORD` | Instagram login | For IG posting |
| `FACEBOOK_EMAIL` / `FACEBOOK_PASSWORD` | Facebook login | For FB posting |
| `FB_PAGE_URL` | Your Facebook page URL | For FB posting |
| `PINTEREST_EMAIL` / `PINTEREST_PASSWORD` | Pinterest login | For Pinterest |
| `PINTEREST_BOARD_NAME` | Board to pin to | For Pinterest |
| `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` | LinkedIn login | For LinkedIn |

## Setup Steps

### 1. Create Vercel KV Storage
- Go to [vercel.com/storage](https://vercel.com/storage)
- Click "Create Database" → "KV"
- Connect it to your project
- The `KV_*` env vars will be auto-populated

### 2. Set Social Media Credentials
- Add each platform's username/password as environment variables
- The app uses these to log in and post (cookies are stored in KV for session persistence)

### 3. First Post
- Visit your deployed URL
- Paste a luxemia.shop product URL
- Review AI-generated captions
- Select platforms and click Post

## How It Works

| Step | What Happens |
|------|-------------|
| **Scrape** | Fetches product title, price, image from luxemia.shop |
| **AI Captions** | GPT-4o-mini generates unique captions per platform |
| **Review** | You edit/approve each caption in the dashboard |
| **Post** | Browser automation logs in and posts to each selected platform |
| **History** | All posts saved with URLs for tracking |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scrape` | POST | `{ url }` → product info |
| `/api/caption` | POST | `{ product, platforms }` → generated captions |
| `/api/post` | POST | `{ product, platforms, captions }` → post results |
| `/api/status` | GET | Check platform auth status |
| `/api/history` | GET | Get post history |

## Architecture

- **Frontend**: Next.js 14 App Router + React + Tailwind CSS
- **Browser Automation**: Playwright Core + @sparticuz/chromium (serverless-compatible)
- **AI**: OpenAI GPT-4o-mini for caption generation
- **Storage**: Vercel KV for sessions and post history
- **Image Processing**: Sharp (serverless-compatible)
- **Scraping**: Cheerio + native fetch

## Tech Stack

Next.js 14, React 18, TypeScript, Tailwind CSS, Playwright Core, @sparticuz/chromium, OpenAI, Sharp, Cheerio, Vercel KV, Lucide React
