# 🚀 PulsePay — Full Deployment Guide

> Supabase database, OAuth setup, and Vercel deployment. Step by step.

---

## PART 1 — Database (Supabase)

Supabase is the recommended database. Free tier, no credit card, works out of the box with Prisma and Vercel.

### Step 1: Create a Supabase project

1. Go to **https://supabase.com** and sign up (free)
2. Click **"New project"**
3. Fill in:
   - **Name:** `pulsepay`
   - **Database Password:** create a strong password — save it somewhere, you'll need it
   - **Region:** pick the one closest to your users
4. Click **"Create new project"** and wait ~2 minutes for it to provision

### Step 2: Get your connection strings

1. In your Supabase project, go to **Settings → Database**
2. Scroll to **"Connection string"** section
3. You need **two** URLs:

**DATABASE_URL** — click the **"Transaction"** tab (port **6543**):
```
postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**DIRECT_URL** — click the **"Session"** tab (port **5432**):
```
postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

> **Why two?** `DATABASE_URL` uses PgBouncer connection pooling — required for serverless (Vercel). `DIRECT_URL` bypasses pooling and is used only when Prisma runs migrations.

4. Replace `[YOUR-PASSWORD]` with the password you set in Step 1
5. Paste both into `backend/.env`

### Step 3: Push your schema

```bash
cd backend
npm install
npx prisma db push
```

Expected output: `✓ Your database is now in sync with your Prisma schema.`

You can verify by going to **Supabase → Table Editor** — you should see all your tables (User, Game, Tournament, Post, etc.)

### Step 4: Open Prisma Studio (optional)

```bash
npm run db:studio
```

Opens `http://localhost:5555` — a GUI to browse and edit your database data.

---

## PART 2 — Create Your First Admin User

**Option A — Register via the site, then promote:**

1. Run the app locally (`npm run dev`)
2. Register an account at `http://localhost:5000/register.html`
3. Go to **Supabase → Table Editor → User**
4. Find your row, click it, change `role` from `USER` to `ADMIN`, save

**Option B — Supabase SQL Editor:**

1. Go to **Supabase → SQL Editor**
2. Run:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

Now go to `http://localhost:5000/admin/` — you'll be redirected to the admin dashboard automatically after login.

---

## PART 3 — OAuth Setup

Skip any providers you don't need — the app works fine without them.

### Google OAuth

1. Go to **https://console.cloud.google.com/**
2. Create a project (or use existing)
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:5000/api/auth/google/callback
   https://your-app.vercel.app/api/auth/google/callback
   ```
6. Copy **Client ID** and **Client Secret** → paste into `backend/.env`

> Also go to **OAuth consent screen** → add your app name, logo, and support email. Set to **External** so any Google account can sign in.

---

### Discord OAuth

1. Go to **https://discord.com/developers/applications**
2. Click **New Application** → name it `PulsePay`
3. Go to **OAuth2** in the left sidebar
4. Under **Redirects**, click Add and enter:
   ```
   http://localhost:5000/api/auth/discord/callback
   https://your-app.vercel.app/api/auth/discord/callback
   ```
5. Copy **Client ID** and **Client Secret** → paste into `backend/.env`

---

### Twitter / X OAuth 2.0

1. Go to **https://developer.twitter.com/en/portal/projects-and-apps**
2. Apply for a developer account (usually approved instantly)
3. Create a new app inside your project
4. Go to **User authentication settings** and enable **OAuth 2.0**
5. Set:
   - **Type of App:** Web App
   - **Callback / Redirect URL:**
     ```
     http://localhost:5000/api/auth/twitter/callback
     https://your-app.vercel.app/api/auth/twitter/callback
     ```
   - **Website URL:** your production URL
6. Required scopes: `tweet.read`, `users.read`, `offline.access`
7. Copy **Client ID** and **Client Secret** → paste into `backend/.env`

---

### Facebook / Meta OAuth

1. Go to **https://developers.facebook.com/apps/**
2. Click **Create App** → type: **Consumer**
3. Add the **Facebook Login** product (click "Set Up")
4. Go to **Facebook Login → Settings**
5. Under **Valid OAuth Redirect URIs**, add:
   ```
   http://localhost:5000/api/auth/facebook/callback
   https://your-app.vercel.app/api/auth/facebook/callback
   ```
6. Go to **Settings → Basic** to find your **App ID** and **App Secret**

> ⚠️ Facebook requires your app to be in **Live mode** (not Development) before non-admin users can log in. You'll need to submit for App Review and add `email` and `public_profile` to your requested permissions.

---

## PART 4 — Deploy to Vercel

### Step 1: Push code to GitHub

```bash
git init
git add .
git commit -m "Initial commit — PulsePay"

# Create a repo on github.com first, then:
git remote add origin https://github.com/yourusername/pulse-play.git
git push -u origin main
```

### Step 2: Import on Vercel

1. Go to **https://vercel.com/dashboard**
2. Click **"Add New → Project"**
3. Click **"Import"** next to your GitHub repo
4. Vercel reads `vercel.json` automatically — no build settings needed
5. Click **"Deploy"**

Your first deploy will fail at database connection — that's fine. Next step fixes it.

### Step 3: Add environment variables

In Vercel → your project → **Settings → Environment Variables**, add these one by one:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `DATABASE_URL` | Supabase **Transaction** pooler URL (port 6543) |
| `DIRECT_URL` | Supabase **Session** pooler URL (port 5432) |
| `JWT_SECRET` | Your random 64-char secret |
| `JWT_EXPIRE` | `7d` |
| `API_URL` | `https://your-app.vercel.app` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `CORS_ORIGIN` | `https://your-app.vercel.app` |
| `GOOGLE_CLIENT_ID` | *(if configured)* |
| `GOOGLE_CLIENT_SECRET` | *(if configured)* |
| `DISCORD_CLIENT_ID` | *(if configured)* |
| `DISCORD_CLIENT_SECRET` | *(if configured)* |
| `FACEBOOK_APP_ID` | *(if configured)* |
| `FACEBOOK_APP_SECRET` | *(if configured)* |
| `TWITTER_CLIENT_ID` | *(if configured)* |
| `TWITTER_CLIENT_SECRET` | *(if configured)* |

After adding all variables, click **"Redeploy"** from the Deployments tab.

### Step 4: Update OAuth redirect URIs with your live URL

Once deployed, copy your Vercel URL (e.g. `https://pulse-play-abc123.vercel.app`) and add it to each OAuth provider:

- **Google Console** → Credentials → your OAuth client → add the callback URL
- **Discord** → your app → OAuth2 → add the callback URL
- **Twitter** → User authentication settings → add the callback URL
- **Facebook** → Facebook Login → Settings → add the callback URL

### Step 5: Sync database schema on production

You only need to do this once (or after schema changes):

```bash
# Run from your local machine with production DIRECT_URL
DIRECT_URL="your-supabase-session-pooler-url" npx prisma db push --schema=backend/prisma/schema.prisma
```

Or just re-run from `backend/` with the production URL temporarily set in your `.env`.

---

## PART 5 — Local Dev (quick reference)

```bash
# 1. Install everything
npm install

# 2. Configure
cp .env.example backend/.env
# Edit backend/.env — set DATABASE_URL, DIRECT_URL, JWT_SECRET

# 3. Push schema
npm run db:push

# 4. Start dev server
npm run dev
```

| URL | What |
|---|---|
| `http://localhost:5000` | Main site |
| `http://localhost:5000/admin/` | Admin dashboard |
| `http://localhost:5000/api/health` | API health check |
| `http://localhost:5555` | Prisma Studio (run `npm run db:studio`) |

---

## Troubleshooting

**`PrismaClientInitializationError: Can't reach database`**
→ Check `DATABASE_URL` in `backend/.env`. Make sure you replaced `[YOUR-PASSWORD]` with your actual Supabase password. The password must be URL-encoded if it has special characters (e.g. `@` becomes `%40`).

**`ENOENT: no such file package.json`**
→ You're in the wrong directory. Run all commands from the project root (`PULSE-PLAY-CLONE/`), not inside `frontend/` or `backend/`.

**`OAuth redirect_uri_mismatch`**
→ The callback URL in your OAuth provider settings must exactly match what's in your `.env`. Check for trailing slashes or `http` vs `https`.

**Admin dashboard shows blank or 403**
→ Your user's `role` is still `USER`. Update it in Supabase → Table Editor → User table → change `role` to `ADMIN`.

**Vercel build succeeds but API returns 500**
→ A required env var is missing. Check Vercel → Settings → Environment Variables. The most common missing ones are `DATABASE_URL` and `JWT_SECRET`.

**`invalid input value for enum Role`**
→ You're running Prisma commands before the schema was pushed. Run `npm run db:push` first.
