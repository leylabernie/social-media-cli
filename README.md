# LuxeMia Social — Social Media Dashboard

A Next.js web app that automates posting luxemia.shop products to Instagram, Facebook, TikTok, and Pinterest. Connect your accounts via OAuth, paste a product URL, review AI-generated captions, and post — all from one dashboard.

## Features

- **OAuth Authentication** — Click "Connect" and authenticate directly with each platform. No passwords stored.
- **AI Captions** — GPT-4o-mini generates platform-optimized captions
- **Product Scraping** — Automatically extracts product info from any luxemia.shop URL
- **One-Click Posting** — Post to multiple platforms simultaneously
- **Post History** — Track all your past posts and their status

## Supported Platforms

| Platform | Connection | Posting Method |
|----------|-----------|----------------|
| Instagram | OAuth via Facebook | Instagram Graph API |
| Facebook | OAuth | Facebook Graph API |
| TikTok | OAuth | TikTok API v2 |
| Pinterest | OAuth | Pinterest API v5 |

## Deploy to Vercel

### Step 1: Create a Facebook App (for Instagram + Facebook)
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → Select "Other" → "Business"
3. Add products: "Facebook Login" and "Instagram Graph API"
4. Settings → Basic → copy **App ID** and **App Secret**
5. Add your Vercel domain to "Valid OAuth Redirect URIs":
   - `https://your-app.vercel.app/api/auth/instagram/callback`
   - `https://your-app.vercel.app/api/auth/facebook/callback`

### Step 2: Create a TikTok App
1. Go to [developers.tiktok.com](https://developers.tiktok.com)
2. Create a new app
3. Add redirect URI: `https://your-app.vercel.app/api/auth/tiktok/callback`
4. Copy **Client Key** and **Client Secret**

### Step 3: Create a Pinterest App
1. Go to [developers.pinterest.com](https://developers.pinterest.com)
2. Create a new app
3. Add redirect URI: `https://your-app.vercel.app/api/auth/pinterest/callback`
4. Copy **App ID** and **App Secret**

### Step 4: Create Vercel KV
1. Go to [vercel.com/storage](https://vercel.com/storage)
2. Click "Create Database" → "KV"
3. Connect to your project (auto-adds KV env vars)

### Step 5: Deploy
```bash
# Clone
git clone https://github.com/leylabernie/social-media-cli.git
cd social-media-cli

# Or deploy directly:
# https://vercel.com/new/clone?repository-url=https://github.com/leylabernie/social-media-cli
```

### Step 6: Add Environment Variables
In Vercel dashboard → Settings → Environment Variables:

| Variable | Value | Source |
|----------|-------|--------|
| `OPENAI_API_KEY` | Your OpenAI key | [platform.openai.com](https://platform.openai.com) |
| `FACEBOOK_APP_ID` | Your Facebook App ID | developers.facebook.com |
| `FACEBOOK_APP_SECRET` | Your Facebook App Secret | developers.facebook.com |
| `TIKTOK_CLIENT_KEY` | Your TikTok Client Key | developers.tiktok.com |
| `TIKTOK_CLIENT_SECRET` | Your TikTok Client Secret | developers.tiktok.com |
| `PINTEREST_APP_ID` | Your Pinterest App ID | developers.pinterest.com |
| `PINTEREST_APP_SECRET` | Your Pinterest App Secret | developers.pinterest.com |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL | `https://your-app.vercel.app` |

KV variables are auto-populated when you connect the KV database.

### Step 7: Use It
1. Visit your deployed URL
2. Click **"Connect Instagram"** (or any platform)
3. Authenticate through the platform's official login
4. Repeat for other platforms
5. Paste a luxemia.shop product URL
6. Review AI-generated captions
7. Select platforms and click **Post**

## How It Works

```
User clicks "Connect Instagram"
  → Redirected to Facebook OAuth
  → Logs in on Facebook's official page
  → Redirected back with auth token
  → Token stored securely in Vercel KV

User pastes product URL
  → Backend scrapes luxemia.shop
  → AI generates captions per platform
  → User reviews and edits captions
  → User selects platforms
  → Backend calls each platform's API
  → Posts published!
```

## Project Structure

```
app/
  page.tsx                 # Main dashboard
  layout.tsx               # Root layout
  globals.css              # Tailwind styles
  api/
    scrape/route.ts        # Product scraping
    caption/route.ts       # AI caption generation
    post/route.ts          # Publish to platforms
    history/route.ts       # Post history
    accounts/route.ts      # Connected accounts list
    auth/
      instagram/route.ts   # → OAuth redirect
      instagram/callback/  # ← OAuth callback
      facebook/route.ts
      facebook/callback/
      tiktok/route.ts
      tiktok/callback/
      pinterest/route.ts
      pinterest/callback/
      disconnect/route.ts
components/
  ConnectCard.tsx          # Platform connection card
  ProductInput.tsx         # URL input
  ProductPreview.tsx       # Product display
  CaptionEditor.tsx        # Caption editing
  PlatformCheckboxes.tsx   # Platform selection
  PostButton.tsx           # Post action
  ResultsPanel.tsx         # Post results
  HistoryTable.tsx         # History display
lib/
  types.ts                 # TypeScript types
  kv.ts                    # Vercel KV wrapper
  ai.ts                    # OpenAI integration
  platforms/
    instagram.ts           # Instagram Graph API
    facebook.ts            # Facebook Graph API
    tiktok.ts              # TikTok API
    pinterest.ts           # Pinterest API
```

## Tech Stack

Next.js 14, React 18, TypeScript, Tailwind CSS, Vercel KV, OpenAI GPT-4o-mini

## License

MIT
