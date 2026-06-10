# The Gaffer's Pick - WC 2026

World Cup 2026 group stage predictor. Dark broadcast aesthetic, multi-group leaderboards, PIN-protected picks, 30-minute kickoff lock.

## Stack

- **Frontend:** Vite + React
- **Backend:** Express + Node.js
- **Database:** Supabase (Postgres)
- **Hosting:** Railway (monorepo, one service)

---

## Local Development

```bash
# 1. Install root dependencies
npm install

# 2. Install client dependencies
cd client && npm install && cd ..

# 3. Copy env template
cp .env.example .env
# Fill in your Supabase values in .env

# 4. Run both server + client concurrently
npm run dev
```

Client runs on http://localhost:5173  
Server runs on http://localhost:3001

---

## Deploy to Railway

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/gaffers-pick.git
git push -u origin main
```

### 2. Create Railway project

- Go to https://railway.app
- New Project → Deploy from GitHub repo
- Select your repo

### 3. Set environment variables in Railway

Go to your service → Variables → Add these:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Supabase Postgres URI (Settings → Database → Connection string → URI) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key (Settings → API) |
| `ADMIN_PASSWORD_HASH` | `8b9298461c9d9bc1c1204cc7aa295477193d22fcb1168c55b8e87c5a0346cb50` |
| `PORT` | `3001` |

### 4. Deploy

Railway auto-deploys on push. Tables are created automatically on first boot.

---

## Scoring System

| Prediction | Points |
|---|---|
| Correct result (W/D/L) | 3 pts |
| Exact home score | +2 pts |
| Exact away score | +2 pts |
| Correct goal difference (wrong scoreline) | +2 pts |
| Correct yellow cards | +1 pt |
| Correct red cards | +1 pt |
| **Max per match** | **10 pts** |

Picks lock 30 minutes before kickoff.

---

## Admin

Access via the ⚙ button. Admin password is never stored in code - only the SHA-256 hash lives in `ADMIN_PASSWORD_HASH` env var.

From the admin panel you can:
- Create groups and share their codes
- Enter match results (score + cards)
- Points recalculate automatically across all groups
