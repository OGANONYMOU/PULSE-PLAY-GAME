# ▶️ How to Run PulsePay

## Before you start — you need these installed
- **Node.js** (v18 or newer) → https://nodejs.org
- **A Supabase account** → https://supabase.com (free)

---

## Step 1 — Set up the database (do this once)

1. Go to **https://supabase.com** → sign in → **New project**
2. Name it `pulsepay`, set a password (**no special characters** like @ # $ — use only letters and numbers)
3. Wait ~2 min for it to provision
4. Click the green **"Connect"** button at the top of your project
5. Click the **"ORMs"** tab → select **Prisma**
6. Copy both connection strings shown

---

## Step 2 — Create your .env file (do this once)

1. Open the **`backend`** folder
2. Create a new file called **`.env`** (exactly — no .txt)
3. Paste this and fill in your values:

```
DATABASE_URL=<paste the first URL from Supabase — port 6543>
DIRECT_URL=<paste the second URL from Supabase — port 5432>
JWT_SECRET=any_long_random_text_here_at_least_32_chars
JWT_EXPIRE=7d
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5000
```

---

## Step 3 — Push the database schema (do this once)

Open a terminal / Command Prompt in the project folder and run:

```
npm install
npm run db:push
```

You should see: **"Your database is now in sync"**

---

## Step 4 — Start the server

**Windows:** Double-click **`start.bat`**

**Mac / Linux:** Open terminal and run:
```
npm run dev
```

---

## Step 5 — Open the site

Open your browser and go to:
```
http://localhost:5000
```

⚠️ **Do NOT open the HTML files directly by double-clicking them.**
    They will not work without the backend server running.
    Always use **http://localhost:5000**

---

## Make yourself Admin

1. Register an account at http://localhost:5000/register.html
2. Go to **Supabase → Table Editor → User table**
3. Find your row → change `role` from `USER` to `ADMIN` → Save
4. Go to http://localhost:5000/admin/ → you're in
