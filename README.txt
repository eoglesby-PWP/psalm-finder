# Find Your Psalm
**A Preacher with a Parrot**

Interactive psalm-finder for workers2work.com (or subdomain of apreacherwithaparrot.com).

---

## Files

```
psalm-finder/
├── api/
│   └── psalm.js       ← Vercel serverless function (proxy to Anthropic API)
├── public/
│   └── index.html     ← Frontend (production-ready)
├── vercel.json        ← Routing config
└── README.md
```

---

## Deployment

### 1. Push to GitHub

Create a new GitHub repo (e.g. `psalm-finder`), then:

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/psalm-finder.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (free account is fine)
2. Click **Add New → Project**
3. Import your `psalm-finder` GitHub repo
4. Leave all build settings at defaults — Vercel will detect the `vercel.json` config automatically
5. Click **Deploy**

### 3. Add the API key

In Vercel dashboard → your project → **Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your key) |

After adding it, go to **Deployments** and **Redeploy** (the env var won't be live until you redeploy).

### 4. Connect your domain

In Vercel → **Settings → Domains**, add:

```
psalm.workers2work.com
```
or
```
psalm.apreacherwithaparrot.com
```

Then add a CNAME record in your DNS (Wix or wherever your domain lives):

| Type | Host | Value |
|------|------|-------|
| CNAME | psalm | cname.vercel-dns.com |

Vercel provisions SSL automatically.

---

## How it works

1. User types their situation into the textarea and clicks "Find my psalm"
2. The frontend POSTs `{ situation, retry }` to `/api/psalm`
3. The Vercel serverless function (`api/psalm.js`) receives the request, attaches the API key from the environment, and calls the Anthropic API
4. The API returns a JSON psalm recommendation
5. The function validates the response and returns it to the frontend
6. The frontend renders: psalm name, pastoral note, KJV verses, closing encouragement
7. Hit/miss buttons: hit shows a quiet acknowledgment; miss reruns with a `retry: true` flag that instructs Claude to choose a different psalm from a different angle

The API key never touches the browser. All calls go through the serverless function.

---

## Phase 3 (future)

To add anonymous logging of emotional categories and psalm hits/misses, extend `api/psalm.js` to write to a Vercel KV store (free tier available) or a simple Google Sheet via their API. Recommend Vercel KV — it's one import and three lines.

---

## Local testing

```bash
npm install -g vercel
vercel dev
```

Set `ANTHROPIC_API_KEY` in a `.env.local` file at the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then open `http://localhost:3000`.
