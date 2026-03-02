# PulsePay — Mobile Gaming Community Platform

A full-stack mobile gaming community platform built with React, TypeScript, Supabase, and Tailwind CSS.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v3, shadcn/ui, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Deployment**: Vercel

---

## Local Development

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd pulsepay
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Set up the Supabase database

Run the SQL in `supabase/schema.sql` in your Supabase dashboard SQL editor:
- Go to **Supabase Dashboard → SQL Editor**
- Paste and run the entire contents of `supabase/schema.sql`

This will create all tables, RLS policies, triggers, and seed data.

### 5. Configure OAuth providers (optional)

In your **Supabase Dashboard → Authentication → Providers**, enable:
- Google, Discord, Twitter/X, or Facebook
- Set the redirect URL to: `https://your-domain.com/auth/callback`

### 6. Start the development server

```bash
npm run dev
```

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

### 3. Add environment variables in Vercel

In your Vercel project settings → **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

### 4. Update Supabase Auth redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL**: `https://your-vercel-domain.vercel.app`
- **Redirect URLs**: `https://your-vercel-domain.vercel.app/auth/callback`

### 5. Deploy

Click **Deploy** — Vercel will build and deploy automatically.

---

## Database Schema

| Table | Description |
|-------|-------------|
| `profiles` | User profiles, extends Supabase auth.users |
| `games` | Mobile games catalog |
| `tournaments` | Tournament listings |
| `posts` | Community posts |
| `live_updates` | Real-time tournament updates |

All tables have Row Level Security (RLS) enabled. Realtime is enabled for `posts`, `tournaments`, and `live_updates`.

---

## Project Structure

```
src/
├── components/
│   ├── layout/         # Navbar, Footer
│   ├── ui/             # shadcn/ui components
│   └── ui-custom/      # Custom components
├── contexts/
│   ├── AuthContext.tsx  # Supabase auth state
│   └── ThemeContext.tsx
├── hooks/
│   ├── useGames.ts      # Fetch games from Supabase
│   ├── useTournaments.ts
│   └── usePosts.ts      # Posts with realtime updates
├── lib/
│   └── supabase.ts      # Supabase client
├── pages/
│   ├── Home.tsx
│   ├── Games.tsx
│   ├── Tournaments.tsx
│   ├── Community.tsx
│   ├── About.tsx
│   ├── SignIn.tsx
│   ├── Register.tsx
│   └── AuthCallback.tsx
└── types/
    └── database.ts      # TypeScript types for Supabase schema
```
