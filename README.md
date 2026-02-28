# 🎮 PulsePay

> Full-stack gaming platform. One command to install. One command to run.

## ⚡ Quick Start

```bash
npm install                      # Install everything
cp .env.example backend/.env    # Configure env
# Edit backend/.env: set DATABASE_URL and JWT_SECRET

npm run db:push                  # Push schema to Postgres
npm run dev                      # Start frontend + backend
```

**→ http://localhost:5000**

## Admin Dashboard

Navigate to **http://localhost:5000/admin/** after promoting a user:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

## Commands

| Command | Description |
|---|---|
| `npm install` | Install all dependencies |
| `npm run dev` | Start API + Frontend together |
| `npm run dev:api` | API only (port 5000) |
| `npm run build` | Compile TypeScript |
| `npm run db:push` | Sync schema to database |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Prisma Studio GUI |

## API Routes

```
POST   /api/auth/register          Create account
POST   /api/auth/signin            Sign in
GET    /api/auth/me                Current user (auth required)
GET    /api/auth/google            → Google OAuth
GET    /api/auth/discord           → Discord OAuth
GET    /api/auth/facebook          → Facebook OAuth
GET    /api/auth/twitter           → Twitter/X OAuth

GET    /api/games                  List games
GET    /api/tournaments            List tournaments
GET    /api/community/posts        Community feed

GET    /api/admin/stats            Dashboard stats (admin)
GET    /api/admin/users            User list (admin)
PATCH  /api/admin/users/:id/role   Change role (admin)
POST   /api/admin/users/:id/ban    Ban user (admin)
...
```

## Deployment

See **DEPLOY.md** for full step-by-step guide covering:
- Neon database setup
- Google / Discord / Twitter / Facebook OAuth
- Vercel deployment

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Prisma ORM) |
| Auth | JWT + OAuth 2.0 |
| Deploy | Vercel + Neon |
