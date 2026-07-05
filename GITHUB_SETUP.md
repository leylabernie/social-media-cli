# GitHub Setup & Local Installation Guide

## What This Tool Is

**LuxeMia Social is a CLI tool** — it runs on your local computer's terminal, not on a web server. It requires:
- Local browser automation (Playwright)
- Persistent browser login sessions (saved locally)
- Interactive terminal prompts
- Your local machine's resources

**It CANNOT be deployed to Vercel, Netlify, or any serverless platform.**

Instead, you:
1. Clone the repo to your laptop/desktop
2. Install dependencies
3. Log in to social platforms once
4. Run posting commands from your terminal

---

## Step 1: Create a GitHub Repository

Go to https://github.com/new and create a new private repository:
- **Repository name**: `luxemia-social`
- **Visibility**: Private (contains your session data references)
- **Do NOT** initialize with README, .gitignore, or license (we already have these)

---

## Step 2: Push the Code

After creating the empty repo, run these commands in your terminal:

```bash
# Navigate to the project folder
cd luxemia-social

# Add your GitHub repo as the remote
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/luxemia-social.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Verify**: Go to `https://github.com/YOUR_USERNAME/luxemia-social` — you should see all files.

---

## Step 3: Install on Your Computer

After pushing to GitHub, here's how to set it up on any machine:

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/luxemia-social.git
cd luxemia-social

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 5. Log in to all social platforms (one-time setup)
npx tsx src/index.ts auth all
# A browser window will open for each platform. Log in manually, then press Enter.

# 6. Post your first product
npx tsx src/index.ts post "https://luxemia.shop/products/apple-green-georgette-lehenga"
```

---

## Step 4: Daily Usage (After Setup)

```bash
# Post a product (interactive review of captions)
npx tsx src/index.ts post "https://luxemia.shop/products/PRODUCT-HANDLE"

# Dry run (preview without posting)
npx tsx src/index.ts post "<url>" --dry-run

# Check if sessions are still valid
npx tsx src/index.ts status

# View recent posts
npx tsx src/index.ts history
```

---

## Using a Personal Access Token (For Private Repo)

If your repo is private, use a Personal Access Token instead of your password:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scope: `repo` (full control of private repositories)
4. Generate and copy the token
5. Use it when pushing:

```bash
git remote add origin https://YOUR_USERNAME:TOKEN@github.com/YOUR_USERNAME/luxemia-social.git
git push -u origin main
```

---

## Why This Can't Run on Vercel

| Requirement | Vercel Support | This Tool |
|-------------|---------------|-----------|
| Browser automation | No | Yes (Playwright) |
| Persistent files | No (serverless) | Yes (.browser-profiles/) |
| Interactive prompts | No | Yes (Inquirer) |
| Long-running processes | 10s timeout | 60-300s per post |
| Local SQLite | No | Yes |

**Vercel runs code on their servers** — they don't have your login cookies, can't open browsers, and can't show interactive prompts.

**This tool runs on YOUR computer** — it uses your saved browser sessions, shows you captions to review, and opens browsers locally.

---

## Future: Web Dashboard (Optional Enhancement)

If you later want a web-based dashboard, that would be a **separate project** that:
- Provides a web UI for entering product URLs
- Stores posts in a cloud database
- Runs the CLI tool on a VPS (DigitalOcean, AWS EC2) instead of Vercel
- Shows posting history and analytics

That would require a VPS, not Vercel. For now, the CLI tool is the right architecture for your use case.
