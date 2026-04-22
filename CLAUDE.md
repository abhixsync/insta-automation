# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Next.js 15 app for posting images to Instagram Business/Creator accounts via the Meta Graph API. Current scope: image-only posting. Spec for the full engine (carousels, Reels, AI generation): `INSTAGRAM_ENGINE_SPEC.md`.

**Stack**: Next.js 15 · TypeScript · Tailwind CSS v3 · Prisma 5 (SQLite) · Zod

---

## First-time setup

```bash
cp .env.example .env          # fill in IG_APP_ID, IG_APP_SECRET, TOKEN_ENCRYPTION_KEY
npm install
npx prisma migrate dev --name init
npm run dev                   # http://localhost:3000
```

Generate `TOKEN_ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Commands

```bash
npm run dev                   # start dev server
npm run build && npm start    # production

npx prisma migrate dev        # create + apply a new migration
npx prisma generate           # regenerate client after schema changes
npx prisma studio             # browse DB in browser
npm run db:deploy             # generate + migrate (prod/CI)
```

---

## Architecture

### Publish flow (image post)

```
POST /api/ig/post  { accountId, imageUrl, caption }
  → decrypt token (AES-256-GCM)
  → POST /{igUserId}/media?image_url=...   ← Meta cURLs the image URL
  → poll /{containerId}?fields=status_code until FINISHED
  → POST /{igUserId}/media_publish?creation_id=...
  → GET  /{mediaId}?fields=permalink
  → save post record with status=published
```

### Directory structure

```
src/
  app/
    page.tsx                    # dashboard UI (client component)
    layout.tsx
    api/ig/
      connect/route.ts          # GET  → returns OAuth URL
      callback/route.ts         # GET  → handles OAuth code exchange
      accounts/route.ts         # GET  → list active accounts
      post/route.ts             # POST → publish image to IG
      posts/route.ts            # GET  → recent post history
  lib/
    db.ts                       # Prisma singleton
    crypto.ts                   # AES-256-GCM encrypt/decrypt
    instagram.ts                # buildAuthUrl, exchangeCode, postImage
prisma/
  schema.prisma                 # IgAccount, Post, OAuthState models
```

### DB models

- **IgAccount** — connected IG Business account; `accessTokenEnc` is AES-256-GCM encrypted.
- **Post** — each publish attempt; `status`: `pending | published | failed`.
- **OAuthState** — single-use OAuth state tokens with 10-min TTL.

---

## Critical invariants

**Never break these:**

1. `media_publish` is **never retried on ambiguous failure** — can double-post. Only retry explicit network errors.
2. IG access tokens stored in `IgAccount.accessTokenEnc` are always AES-256-GCM encrypted via `src/lib/crypto.ts`. Never store plaintext.
3. OAuth `state` is single-use — deleted from `OAuthState` table immediately on callback.
4. Image URLs passed to IG must be **public HTTPS** — Meta fetches them directly. No signed/private URLs.
5. Pre-publish: check `/content_publishing_limit`; if `quota_usage >= 95%` of quota, do not publish.

---

## Key constraints (Instagram API)

- Only Business/Creator accounts can publish via API.
- **100 API-published posts / rolling 24h** per IG account.
- **200 API calls / hour** per app per user — cache aggressively, use `?fields=`.
- Carousel max 10 slides. Caption max 2200 chars. Hashtags max 30.
- Reels: 5–90s, 9:16, audio must be embedded (no Instagram music library via API).
- Container expires after 24h — don't create until ready to publish.
- Insights unavailable for accounts with < 1,000 followers — degrade gracefully.
- Graph API version: `v23.0` (env: `IG_GRAPH_VERSION`).

## Do NOT build

- Auto-follow / auto-like / auto-comment on other accounts.
- Unofficial libraries (`instagrapi`, `instauto`).
- Story polls/stickers (unsupported by API).
- Trending-audio Reels (unsupported by API).

---

## Token lifecycle

- Long-lived tokens last 60 days. Can only be refreshed when **>24h old and <60 days old**.
- Daily cron: refresh any token expiring within 14 days.
- On refresh failure: mark `status = expired`, cancel pending jobs, notify user.
- Subscribe to `permission` webhook to handle revocation → mark `status = revoked`.

---

## Environment variables

```
DATABASE_URL          # SQLite path, e.g. file:./dev.db
IG_APP_ID             # Meta app ID
IG_APP_SECRET         # Meta app secret
IG_REDIRECT_URI       # Must match Meta app settings (e.g. http://localhost:3000/api/ig/callback)
IG_GRAPH_VERSION      # Default: v23.0
TOKEN_ENCRYPTION_KEY  # 32-byte base64 key for AES-256-GCM
```

---

## Meta app review

Start **week 1**, runs 2–4 weeks in parallel with dev. Required: business verification, privacy policy, terms, data deletion endpoint, screencast of full OAuth → publish flow. Request minimum scopes only. See spec §11 for full checklist.
