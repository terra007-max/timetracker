# Zeitwerk — Team Time Tracker

A fast, minimal time tracker for SAP consulting teams.
Built with React + Vite + Supabase. Deploys for free on Vercel.

---

## What you need (all free, no credit card)

- A **GitHub** account → github.com
- A **Supabase** account → supabase.com
- A **Vercel** account → vercel.com
- **Git** installed on your computer → git-scm.com
- **Node.js** installed → nodejs.org (download the LTS version)

---

## Step 1 — Set up Supabase (the database)

1. Go to **supabase.com** → New project
2. Give it a name (e.g. `zeitwerk`), pick a password, choose region **Frankfurt** (closest to Vienna)
3. Wait ~1 minute for it to start
4. Go to **SQL Editor** (left sidebar) → **New query**
5. Open the file `supabase-schema.sql` from this folder, copy all the text, paste it into the editor → click **Run**
6. Go to **Project Settings** → **API**
7. Copy these two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 2 — Push to GitHub

1. Go to **github.com** → click the green **New** button
2. Repository name: `zeitwerk`
3. Set to **Private**
4. Click **Create repository** (do NOT add README or .gitignore — the folder already has them)
5. Open a terminal (on Windows: search "Command Prompt" or "PowerShell")
6. Navigate to this folder:
   ```
   cd path/to/zeitwerk
   ```
7. Run these commands one by one:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/zeitwerk.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3 — Deploy on Vercel

1. Go to **vercel.com** → **Add New Project**
2. Click **Import** next to your `zeitwerk` repository
3. Leave all settings as default — Vercel auto-detects Vite
4. Click **Environment Variables** and add these two:
   ```
   VITE_SUPABASE_URL        → paste your Project URL from Step 1
   VITE_SUPABASE_ANON_KEY   → paste your anon key from Step 1
   ```
5. Click **Deploy**
6. Wait ~1 minute → Vercel gives you a URL like `https://zeitwerk-abc.vercel.app`

---

## Step 4 — Share with your team

Send your colleagues the Vercel URL. That's it.

- Each person enters their name and picks a color on first visit
- Their identity is saved in their browser
- Everyone shares the same projects and can see each other on the Team tab

---

## Updating the app later

Any time you change code and push to GitHub, Vercel automatically redeploys:
```bash
git add .
git commit -m "describe your change"
git push
```

---

## Troubleshooting

**"Could not connect to database"**
→ Check that your `.env` variables are set correctly in Vercel (Project → Settings → Environment Variables)

**Team tab shows no other users**
→ Real-time requires the Supabase schema to be set up correctly. Re-run `supabase-schema.sql`.

**Changes not showing after deploy**
→ Hard refresh in your browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
