# Instagram Content Engine — Technical Spec

> Spec document for the Instagram module of Crescova (or standalone product).
> Purpose: AI-native content generation + scheduling + publishing for Instagram,
> built for founders and early-stage creators.
> Audience: Claude Code — this is working context, not prose for humans.

---

## 0. TL;DR

- **Wedge**: Reels + carousel generation engine, visual-first. Not a text-first scheduler.
- **Killer workflow**: Paste a blog post / LinkedIn thread / YouTube transcript → engine outputs 5 carousels + 3 Reels, all on-brand.
- **Positioning**: One umbrella brand (extend Crescova), split architecture. Shared auth/billing/brand profile, separate Instagram service with its own workers (video rendering is CPU-heavy and must not colocate with the LinkedIn service).
- **Ship order**: Carousels (weeks 1–4) → Reels (weeks 5–6) → Repurposing layer (weeks 7–8).
- **Non-goals**: Auto-follow/like/comment on others, unofficial APIs, trending-audio Reels, story stickers (API doesn't support).

---

## 1. Platform constraints (these shape the product)

### 1.1 Account requirements
- Only **Instagram Business and Creator accounts** can publish via API. Personal accounts cannot.
- Users must convert to Business/Creator. This is UX friction Crescova never had.
- As of the **Instagram Business Login** flow (launched July 2024), a Facebook Page is no longer required. Use this flow — cleaner than Facebook Login for Business.

### 1.2 Rate limits
- **100 API-published posts / rolling 24h** per Instagram account. Carousels count as 1.
- **200 API calls / hour** per app per user. Cache aggressively; use `?fields=` to slim responses.
- Enforce client-side rate limiting *before* hitting Meta — publish queue must check quota before firing `media_publish`.

### 1.3 Content publishing limits
- **Carousels**: max 10 items (images/videos, no Reels inside carousels).
- **Reels**: 5–90 seconds for the Reels tab. 9:16 aspect ratio. Cannot use Instagram's music library via API — audio must be embedded in the uploaded file.
- **Stories**: API supports publishing, but stickers (polls, links, locations) are NOT supported. Mentions without stickers are OK.
- **Insights**: not available for accounts with <1,000 followers. Degrade gracefully.

### 1.4 Meta app review
- Content publishing scopes require app review. Budget **2–4 weeks**. Start this in week 1, in parallel with development.
- Required: business verification, privacy policy, terms, screencast of full OAuth → publish flow.
- Request **minimum scopes**. Meta rejects requests for unused scopes.

### 1.5 Do NOT build
- Auto-follow / auto-like / auto-comment on other accounts → ban.
- Use of unofficial libraries (`instagrapi`, `instauto`) → ban + legal risk.
- Story polls/stickers → unsupported.
- Trending-audio Reels → unsupported via API.

---

## 2. Architecture overview

### 2.1 Shared vs separated services

**Shared (colocated with Crescova)**
- Auth, sessions, users
- Billing (Stripe)
- Brand profiles (colors, logos, fonts, tone, content pillars)
- AI prompt library
- Analytics warehouse

**Separate (new service)**
- Instagram OAuth flow + token store
- Rendering workers (carousel + Reels)
- Media pipeline (R2 upload, cleanup)
- Publishing workers (Meta Graph API adapter)
- Instagram-specific scheduler queue
- Instagram webhook handler

Deploy the Instagram service independently. Recommended: Node.js service on ECS (you already use ECS/Terraform) + separate render workers on Remotion Lambda or GPU EC2.

### 2.2 High-level flow

```
Brand profile + content brief
  → AI ideation (topic, hook, angle)
  → AI script/copy generation
  → Asset selection (fonts, colors, logo, b-roll, TTS for Reels)
  → Render pipeline (format-specific: Satori for carousels, Remotion for Reels)
  → Upload to public R2 bucket
  → Create IG container(s) → poll until FINISHED → media_publish
  → Fetch insights at 24h + 7d post-publish
```

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | Node.js + TypeScript | Matches Crescova |
| Framework | Express or Fastify (match Crescova) | — |
| DB | Postgres (Prisma ORM) | Consistent with ecosystem |
| Queue | BullMQ on Redis | You already run Redis; TS-native |
| Carousel render | Satori + @resvg/resvg-js | React → SVG → PNG, ~100ms/slide, zero browser |
| Reels render | Remotion + Remotion Lambda | React-based video, serverless, pay-per-render |
| Image post-processing | sharp | PNG → JPEG, resize, optimize |
| TTS (Reels) | Cartesia (primary) / ElevenLabs (premium tier) | Cartesia is cheaper, ElevenLabs is best quality |
| Captions | WhisperX | Word-level timestamps for kinetic captions |
| B-roll | Pexels API (free) + Storyblocks/Artlist (licensed) | Start free |
| Media storage | Cloudflare R2 | No egress fees; Meta cURLs your URLs |
| AI copy | Claude Sonnet 4.6+ via Anthropic SDK | Matches Crescova |
| Auth | Extend Crescova | — |
| Secrets | AWS Secrets Manager | — |
| Observability | Existing Crescova stack | — |

### 3.1 Package list

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@aws-sdk/client-s3": "latest",
    "@prisma/client": "latest",
    "@resvg/resvg-js": "latest",
    "bullmq": "latest",
    "dotenv": "latest",
    "express": "latest",
    "ioredis": "latest",
    "satori": "latest",
    "sharp": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@remotion/cli": "latest",
    "@remotion/lambda": "latest",
    "@types/express": "latest",
    "@types/node": "latest",
    "prisma": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

### 3.2 Environment variables

```bash
# Meta / Instagram
IG_APP_ID=
IG_APP_SECRET=
IG_REDIRECT_URI=https://app.example.com/api/ig/callback
IG_GRAPH_VERSION=v23.0
IG_WEBHOOK_VERIFY_TOKEN=              # for webhook subscription handshake
IG_APP_SECRET_HASH_KEY=               # for appsecret_proof

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PUBLIC=                     # public bucket for IG-fetched media
R2_BUCKET_PRIVATE=                    # private bucket for source assets
R2_PUBLIC_BASE_URL=                   # e.g. https://media.example.com

# Token encryption
TOKEN_ENCRYPTION_KEY=                 # 32-byte base64 key for AES-256-GCM

# Redis
REDIS_URL=

# Postgres
DATABASE_URL=

# AI
ANTHROPIC_API_KEY=
CARTESIA_API_KEY=
ELEVENLABS_API_KEY=                   # optional
PEXELS_API_KEY=

# Remotion Lambda
REMOTION_AWS_ACCESS_KEY_ID=
REMOTION_AWS_SECRET_ACCESS_KEY=
REMOTION_AWS_REGION=ap-south-1
REMOTION_FUNCTION_NAME=
REMOTION_SERVE_URL=
```

### 3.3 Suggested directory structure

```
packages/
  instagram-engine/
    src/
      api/                         # Express routes
        oauth.ts
        carousels.ts
        reels.ts
        webhooks.ts
      integrations/
        instagram/
          oauth.ts                 # auth URL, token exchange, refresh
          publisher.ts             # the Meta "dance" (container → poll → publish)
          webhooks.ts              # verification + event handling
          types.ts
      renderers/
        carousel/
          templates/               # one .tsx per template
            quote.tsx
            listicle.tsx
            stat-card.tsx
            hook.tsx
            cta.tsx
          render.ts                # Satori wrapper
          fonts.ts                 # font loader/cache
        reel/
          compositions/            # Remotion compositions
            faceless-short.tsx
            testimonial.tsx
          render.ts                # Remotion Lambda wrapper
          captions.ts              # WhisperX integration
          tts.ts
          broll.ts                 # Pexels search + download
      workers/
        render-carousel.ts
        render-reel.ts
        publish.ts
        fetch-insights.ts
        refresh-tokens.ts
      services/
        content.ts                 # ContentItem state machine
        brand-profile.ts
        ai/
          ideator.ts
          copywriter.ts
          hashtag-suggester.ts
          repurposer.ts
      storage/
        r2.ts
        media.ts                   # upload, cleanup, signed/public URLs
      crypto/
        tokens.ts                  # AES-256-GCM encrypt/decrypt
      db/
        prisma.ts
      config.ts
      index.ts                     # API entrypoint
      queues.ts                    # BullMQ queue definitions
    prisma/
      schema.prisma
      migrations/
    tests/
```

---

## 4. Database schema (Prisma)

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  // ... existing Crescova fields
  brandProfiles   BrandProfile[]
  igAccounts      IgAccount[]
}

model BrandProfile {
  id              String   @id @default(cuid())
  userId          String
  name            String
  // Brand kit
  primaryColor    String
  secondaryColor  String
  accentColor     String
  logoUrl         String?
  fontHeading     String   // Google Font family name
  fontBody        String
  // Voice
  tone            String   // "bold" | "playful" | "authoritative" | ...
  contentPillars  String[]
  forbiddenTopics String[]
  defaultTimezone String   @default("UTC")

  user            User     @relation(fields: [userId], references: [id])
  contents        ContentItem[]
}

model IgAccount {
  id                String   @id @default(cuid())
  userId            String
  igUserId          String   @unique         // from Meta
  username          String
  accessTokenEnc    Bytes                    // AES-256-GCM encrypted
  tokenExpiresAt    DateTime
  lastRefreshedAt   DateTime?
  status            String   @default("active") // active | revoked | expired
  connectedAt       DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id])
  contents          ContentItem[]

  @@index([tokenExpiresAt, status])
}

model ContentItem {
  id             String   @id @default(cuid())
  brandProfileId String
  igAccountId    String
  type           String   // "carousel" | "reel" | "image" | "story"
  status         String   // draft | rendering | ready | scheduled | publishing | published | failed
  sourceType     String?  // "from_scratch" | "repurposed"
  sourceRef      String?  // URL or ref to source content
  topic          String?
  caption        String?
  hashtags       String[]
  scheduledFor   DateTime?
  publishedAt    DateTime?

  brandProfile   BrandProfile @relation(fields: [brandProfileId], references: [id])
  igAccount      IgAccount    @relation(fields: [igAccountId], references: [id])
  slides         Slide[]
  reelAsset      ReelAsset?
  publishJob     PublishJob?
  insights       Insights?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([status, scheduledFor])
  @@index([igAccountId, createdAt])
}

model Slide {
  id             String   @id @default(cuid())
  contentItemId  String
  position       Int
  templateId     String   // which Satori template
  props          Json     // props passed to template
  renderedUrl    String?  // R2 public URL after rendering

  contentItem    ContentItem @relation(fields: [contentItemId], references: [id])

  @@unique([contentItemId, position])
}

model ReelAsset {
  id             String   @id @default(cuid())
  contentItemId  String   @unique
  compositionId  String
  props          Json
  scriptText     String
  ttsAudioUrl    String?
  bRollUrls      String[]
  captionsJson   Json?
  renderedUrl    String?
  coverImageUrl  String?
  durationSec    Int?

  contentItem    ContentItem @relation(fields: [contentItemId], references: [id])
}

model PublishJob {
  id               String   @id @default(cuid())
  contentItemId    String   @unique
  containerIds     String[] // child containers (per slide)
  parentContainer  String?
  publishedMediaId String?
  mediaPermalink   String?
  attempts         Int      @default(0)
  lastError        String?
  nextAttemptAt    DateTime?

  contentItem      ContentItem @relation(fields: [contentItemId], references: [id])
}

model Insights {
  id                String   @id @default(cuid())
  contentItemId     String   @unique
  fetchedAt         DateTime @default(now())
  impressions       Int?
  reach             Int?
  likes             Int?
  comments          Int?
  saves             Int?
  shares            Int?
  videoViews        Int?     // Reels only
  engagementRate    Float?
  raw               Json     // full response for future-proofing

  contentItem       ContentItem @relation(fields: [contentItemId], references: [id])
}

model AuditLog {
  id           String   @id @default(cuid())
  actorId      String
  action       String   // content.created | content.scheduled | content.published | token.refreshed | ...
  entityType   String
  entityId     String
  meta         Json
  createdAt    DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}
```

**State machine invariant**: `ContentItem.status` transitions only through a dedicated service method, never direct writes. Every transition emits an `AuditLog` entry.

---

## 5. OAuth flow (Instagram Business Login)

### 5.1 Scopes

**MVP (carousels only)**:
- `instagram_business_basic`
- `instagram_business_content_publish`

**Add later**:
- `instagram_business_manage_insights` — for analytics
- `instagram_business_manage_comments` — for comment management
- `instagram_business_manage_messages` — for DMs

Request only what you use; Meta rejects review for unused scopes.

### 5.2 Endpoints

- Authorize: `https://api.instagram.com/oauth/authorize`
- Short-lived token exchange: `https://api.instagram.com/oauth/access_token`
- Long-lived token exchange: `https://graph.instagram.com/access_token`
- Token refresh: `https://graph.instagram.com/refresh_access_token`
- API base: `https://graph.instagram.com/v23.0`

### 5.3 Reference implementation

```typescript
// src/integrations/instagram/oauth.ts
const IG_AUTH_BASE = 'https://api.instagram.com/oauth/authorize';
const IG_TOKEN_BASE = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH_BASE = 'https://graph.instagram.com';

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    redirect_uri: process.env.IG_REDIRECT_URI!,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    state, // HMAC-signed: userId + nonce + timestamp, stored in Redis with 10-min TTL
  });
  return `${IG_AUTH_BASE}?${params}`;
}

export async function exchangeCode(code: string) {
  const form = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    client_secret: process.env.IG_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: process.env.IG_REDIRECT_URI!,
    code,
  });
  const res = await fetch(IG_TOKEN_BASE, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Short-lived token exchange failed: ${await res.text()}`);
  const { access_token, user_id } = await res.json();

  // Immediately upgrade to long-lived token (60 days)
  const longLivedRes = await fetch(
    `${IG_GRAPH_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${process.env.IG_APP_SECRET}&access_token=${access_token}`
  );
  if (!longLivedRes.ok) throw new Error(`Long-lived exchange failed: ${await longLivedRes.text()}`);
  const { access_token: longToken, expires_in } = await longLivedRes.json();

  return {
    accessToken: longToken,
    igUserId: String(user_id),
    expiresAt: new Date(Date.now() + expires_in * 1000),
  };
}

export async function refreshToken(token: string) {
  const res = await fetch(
    `${IG_GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Refresh failed: ${await res.text()}`);
  return res.json();
}
```

### 5.4 Token storage + rotation

- Encrypt tokens at rest with **AES-256-GCM**. Use envelope encryption; rotate the DEK periodically.
- Long-lived tokens can only be refreshed once they are **>24 hours old** and **<60 days old**.
- Daily cron (`refresh-tokens` worker): refresh any `IgAccount` with `tokenExpiresAt < now + 14 days` and `status = active`.
- On refresh failure, mark `status = expired` and notify user (email + in-app).

### 5.5 Revocation handling

- Subscribe to the `permission` webhook field.
- On revocation event, mark account `status = revoked`, cancel all pending scheduled jobs, notify user.

### 5.6 OAuth state security

- `state` parameter **must** be HMAC-signed and single-use.
- Include `userId`, nonce (16 random bytes), timestamp.
- Store in Redis with 10-minute TTL, delete on callback.
- Never trust raw userIds in state.

---

## 6. Rendering layer

### 6.1 Carousel templates (Satori)

Templates are pure React components. Brand kit flows in as props. Template = one file in `src/renderers/carousel/templates/`.

**Target format**: 1080 × 1350 (4:5 ratio — best-performing on IG). JPEG output.

```tsx
// src/renderers/carousel/templates/quote.tsx
import { BrandKit } from '../types';

export interface QuoteTemplateProps {
  brand: BrandKit;
  position: number;
  totalSlides: number;
  content: {
    heading?: string;
    body: string;
    attribution?: string;
  };
}

export const QuoteTemplate = ({ brand, content, position, totalSlides }: QuoteTemplateProps) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    width: '1080px',
    height: '1350px',
    padding: '80px',
    background: brand.primaryColor,
    color: brand.secondaryColor,
    fontFamily: brand.fontBody,
    justifyContent: 'space-between',
  }}>
    {brand.logoUrl && <img src={brand.logoUrl} style={{ width: '120px', height: 'auto' }} />}

    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {content.heading && (
        <div style={{
          fontFamily: brand.fontHeading,
          fontSize: '56px',
          fontWeight: 800,
          lineHeight: 1.1,
          color: brand.accentColor,
        }}>
          {content.heading}
        </div>
      )}
      <div style={{ fontSize: '44px', lineHeight: 1.3, fontWeight: 500 }}>
        {content.body}
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', opacity: 0.7 }}>
      <span>{content.attribution ?? '@deviloftech'}</span>
      <span>{position + 1} / {totalSlides}</span>
    </div>
  </div>
);
```

```typescript
// src/renderers/carousel/render.ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { templateRegistry } from './templates';

export async function renderSlide(
  templateId: string,
  props: unknown,
  fonts: FontData[]
): Promise<Buffer> {
  const Template = templateRegistry[templateId];
  if (!Template) throw new Error(`Unknown template: ${templateId}`);

  const svg = await satori(Template(props as any), { width: 1080, height: 1350, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } }).render().asPng();

  // Convert to JPEG for IG (smaller, faster upload, IG-friendly)
  return sharp(png).jpeg({ quality: 90, progressive: true }).toBuffer();
}
```

**Template library — MVP set (6 templates)**:
1. `hook` — big bold opener slide
2. `quote` — centered quote with attribution
3. `listicle` — numbered item with body
4. `stat-card` — big number + caption
5. `comparison` — two-column before/after
6. `cta` — closing slide with call to action

### 6.2 Font handling

- Cache Google Font files in R2 at service startup. Do NOT fetch on every render.
- Curated list of ~50 fonts covering all use cases (sans, serif, display, mono).
- Custom font upload = paid tier with click-through license.

### 6.3 Reels compositions (Remotion)

Target: 1080 × 1920, 30fps, H.264, 5–90 seconds, audio embedded in MP4.

**Composition pattern** (Remotion):
```tsx
// src/renderers/reel/compositions/faceless-short.tsx
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from 'remotion';
import { KineticCaptions } from '../components/KineticCaptions';
import { BrollClip } from '../components/BrollClip';

export const FacelessShort = ({ script, brollUrls, captions, ttsAudioUrl, brand }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: brand.primaryColor }}>
      {brollUrls.map((url, i) => (
        <Sequence key={i} from={i * 90} durationInFrames={90}>
          <BrollClip src={url} />
        </Sequence>
      ))}
      <Audio src={ttsAudioUrl} />
      <KineticCaptions captions={captions} brand={brand} />
    </AbsoluteFill>
  );
};
```

**Rendering**: Use Remotion Lambda (`renderMediaOnLambda`) to avoid managing GPUs. Falls back to local Chromium-based renderer for dev.

**Reels pipeline stages** (sequential):
1. `script` — Claude generates hook + 3 beats + CTA (45–60s target)
2. `tts` — Cartesia/ElevenLabs → MP3 audio URL
3. `captions` — WhisperX on TTS audio → word-level timestamps
4. `broll` — Pexels search based on script keywords → 5–8 clips
5. `render` — Remotion Lambda → MP4 URL
6. `cover` — extract middle frame as 9:16 JPEG for IG cover

---

## 7. Publishing adapter (Meta Graph API)

### 7.1 Carousel publish flow

```typescript
// src/integrations/instagram/publisher.ts
const IG_API = `https://graph.instagram.com/${process.env.IG_GRAPH_VERSION}`;

export class IgPublisher {
  constructor(private igUserId: string, private token: string) {}

  async createImageContainer(imageUrl: string, isCarouselItem: boolean): Promise<string> {
    const params = new URLSearchParams({
      image_url: imageUrl,
      is_carousel_item: String(isCarouselItem),
      access_token: this.token,
    });
    const res = await fetch(`${IG_API}/${this.igUserId}/media?${params}`, { method: 'POST' });
    const data = await res.json();
    if (!data.id) throw new IgPublishError('Container creation failed', data);
    return data.id;
  }

  async createCarouselContainer(childIds: string[], caption: string): Promise<string> {
    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: this.token,
    });
    const res = await fetch(`${IG_API}/${this.igUserId}/media?${params}`, { method: 'POST' });
    const data = await res.json();
    if (!data.id) throw new IgPublishError('Carousel container creation failed', data);
    return data.id;
  }

  async createReelContainer(videoUrl: string, caption: string, coverUrl?: string, shareToFeed = true): Promise<string> {
    const params = new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      share_to_feed: String(shareToFeed),
      ...(coverUrl ? { cover_url: coverUrl } : {}),
      access_token: this.token,
    });
    const res = await fetch(`${IG_API}/${this.igUserId}/media?${params}`, { method: 'POST' });
    const data = await res.json();
    if (!data.id) throw new IgPublishError('Reel container creation failed', data);
    return data.id;
  }

  async waitForContainer(containerId: string, timeoutMs = 5 * 60_000): Promise<void> {
    const start = Date.now();
    let delay = 2000;
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(
        `${IG_API}/${containerId}?fields=status_code,status&access_token=${this.token}`
      );
      const { status_code, status } = await res.json();
      if (status_code === 'FINISHED') return;
      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        throw new IgPublishError(`Container ${status_code}`, { status });
      }
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 15_000);
    }
    throw new IgPublishError('Container polling timeout', { containerId });
  }

  async publish(parentContainerId: string): Promise<string> {
    const params = new URLSearchParams({
      creation_id: parentContainerId,
      access_token: this.token,
    });
    const res = await fetch(`${IG_API}/${this.igUserId}/media_publish?${params}`, { method: 'POST' });
    const data = await res.json();
    if (!data.id) throw new IgPublishError('Publish failed', data);
    return data.id;
  }

  async getPermalink(mediaId: string): Promise<string> {
    const res = await fetch(`${IG_API}/${mediaId}?fields=permalink&access_token=${this.token}`);
    const { permalink } = await res.json();
    return permalink;
  }

  async getRateLimitUsage() {
    const res = await fetch(
      `${IG_API}/${this.igUserId}/content_publishing_limit?access_token=${this.token}`
    );
    return res.json();
  }
}

export class IgPublishError extends Error {
  constructor(message: string, public meta: unknown) { super(message); }
}
```

### 7.2 Critical publishing gotchas

- **Image URLs must be publicly accessible HTTPS.** Meta cURLs them. Signed URLs with auth headers do NOT work.
- **Image format**: JPEG preferred. Max 8MB. Aspect ratio 4:5 to 1.91:1. Convert PNG → JPEG with `sharp` before upload.
- **Container expiration**: 24 hours. Don't create until you're ready to publish.
- **Reels video specs**: MOV/MP4, H.264 or HEVC, AAC audio ≤48kHz, 9:16, 23–60 FPS, ≤90s for Reels tab eligibility.
- **Idempotency**: Do NOT retry `media_publish` on ambiguous failures — can double-post. Retry only on explicit network errors. Log `creation_id` for manual reconciliation.
- **Pre-publish quota check**: Hit `/content_publishing_limit`. If `quota_usage >= 95% of quota_total`, reschedule.
- **No reels in carousels**. No reels sharing stickers via API.

---

## 8. Job orchestration (BullMQ)

One queue per stage. Each stage does one thing.

```typescript
// src/queues.ts
import { Queue } from 'bullmq';
import { connection } from './redis';

export const renderCarouselQueue = new Queue('render-carousel', { connection });
export const renderReelQueue = new Queue('render-reel', { connection });
export const publishQueue = new Queue('publish', { connection });
export const insightsQueue = new Queue('fetch-insights', { connection });
export const refreshTokensQueue = new Queue('refresh-tokens', { connection });
```

### 8.1 Render carousel worker (sketch)

```typescript
// src/workers/render-carousel.ts
import { Worker } from 'bullmq';
import { renderSlide } from '../renderers/carousel/render';
import { loadFonts } from '../renderers/carousel/fonts';
import { r2Upload } from '../storage/r2';
import { loadContentWithSlides, updateSlide, transitionStatus } from '../services/content';
import { publishQueue } from '../queues';

new Worker('render-carousel', async (job) => {
  const { contentItemId } = job.data;
  const content = await loadContentWithSlides(contentItemId);
  await transitionStatus(contentItemId, 'rendering');

  const fonts = await loadFonts(content.brandProfile);

  for (const slide of content.slides) {
    const jpeg = await renderSlide(slide.templateId, slide.props, fonts);
    const url = await r2Upload(jpeg, `renders/${contentItemId}/${slide.position}.jpg`, {
      contentType: 'image/jpeg',
      public: true,
    });
    await updateSlide(slide.id, { renderedUrl: url });
  }

  await transitionStatus(contentItemId, content.scheduledFor ? 'scheduled' : 'ready');

  if (content.scheduledFor) {
    await publishQueue.add('publish', { contentItemId }, {
      delay: content.scheduledFor.getTime() - Date.now(),
    });
  }
}, { connection, concurrency: 4 });
```

### 8.2 Publish worker (sketch)

```typescript
// src/workers/publish.ts
import { Worker } from 'bullmq';
import { IgPublisher } from '../integrations/instagram/publisher';
import { decryptToken } from '../crypto/tokens';
import { insightsQueue } from '../queues';

new Worker('publish', async (job) => {
  const { contentItemId } = job.data;
  const content = await loadContentFull(contentItemId);
  const token = await decryptToken(content.igAccount.accessTokenEnc);
  const pub = new IgPublisher(content.igAccount.igUserId, token);

  const quota = await pub.getRateLimitUsage();
  const used = quota.data?.[0]?.quota_usage ?? 0;
  const total = quota.data?.[0]?.config?.quota_total ?? 100;
  if (used >= total * 0.95) throw new Error('Rate limit near cap');

  await transitionStatus(contentItemId, 'publishing');

  let mediaId: string;

  if (content.type === 'carousel') {
    const childIds = await Promise.all(
      content.slides.map(s => pub.createImageContainer(s.renderedUrl!, true))
    );
    await Promise.all(childIds.map(id => pub.waitForContainer(id)));
    const parentId = await pub.createCarouselContainer(childIds, content.caption!);
    await pub.waitForContainer(parentId);
    mediaId = await pub.publish(parentId);
    await saveContainerIds(contentItemId, { childIds, parentId });
  } else if (content.type === 'reel') {
    const containerId = await pub.createReelContainer(
      content.reelAsset!.renderedUrl!,
      content.caption!,
      content.reelAsset!.coverImageUrl ?? undefined
    );
    await pub.waitForContainer(containerId);
    mediaId = await pub.publish(containerId);
    await saveContainerIds(contentItemId, { parentId: containerId });
  } else {
    throw new Error(`Unsupported type: ${content.type}`);
  }

  const permalink = await pub.getPermalink(mediaId);
  await transitionStatus(contentItemId, 'published', { mediaId, permalink });

  // Queue insights pull at 24h and 7d
  await insightsQueue.add('fetch', { contentItemId }, { delay: 24 * 3600 * 1000 });
  await insightsQueue.add('fetch', { contentItemId, window: '7d' }, { delay: 7 * 24 * 3600 * 1000 });
}, { connection, concurrency: 2, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } });
```

### 8.3 Worker settings

- Render workers: `concurrency: 4` (CPU-bound, tune per instance size).
- Publish worker: `concurrency: 2` (I/O-bound, but don't want to race quota limits per account). Scope concurrency to 1 per `igAccountId` via BullMQ group keys.
- Retries: `attempts: 3`, exponential backoff starting at 30s.
- Publish step MUST be idempotent — check if already published before retrying.

---

## 9. API surface (MVP)

```
POST   /api/ig/connect              → returns OAuth URL
GET    /api/ig/callback             → handles OAuth callback, stores encrypted token
DELETE /api/ig/accounts/:id         → disconnect

GET    /api/brand-profiles          → list
POST   /api/brand-profiles          → create
PATCH  /api/brand-profiles/:id      → update

POST   /api/carousels               → create draft with slides
POST   /api/carousels/:id/preview   → synchronous render, returns preview URLs
POST   /api/carousels/:id/schedule  → enqueue render + publish at scheduledFor
POST   /api/carousels/:id/publish   → publish now (render → publish inline)
GET    /api/carousels/:id           → status + media_id + permalink

POST   /api/reels                   → create draft
POST   /api/reels/:id/generate      → run full pipeline (script → tts → broll → render)
POST   /api/reels/:id/schedule
GET    /api/reels/:id

POST   /api/repurpose               → source URL/text → generate N carousels + M reels drafts
                                      returns array of ContentItem IDs

POST   /api/webhooks/instagram      → webhook receiver (verify + handle)

GET    /api/insights/:contentItemId → cached insights
```

Keep it small. Don't build CRUD zoo.

---

## 10. AI generation prompts

### 10.1 Carousel generation

Input:
- Brand profile (tone, pillars, forbidden topics)
- Topic / angle
- Target slide count (default 7)

Output structure (JSON):
```json
{
  "hook": "big bold opening line, max 60 chars",
  "slides": [
    { "template": "hook", "content": {...} },
    { "template": "listicle", "content": {...} }
  ],
  "caption": "IG caption with hooks, line breaks, no hashtags",
  "hashtags": ["..."] // 15-25
}
```

Prompt pattern (pseudocode):
```
System: You are a carousel scriptwriter for <brand name>, whose voice is <tone>.
        Content pillars: <pillars>. Forbidden topics: <forbidden>.

User:   Write a carousel on "<topic>".
        Generate <N> slides following the template sequence: hook → 3-5 value slides → CTA.
        Return JSON matching <schema>.
```

Use structured output (Claude's `tool_use` with a JSON schema) for reliable parsing.

### 10.2 Repurposing

Input: source URL or pasted text
Pipeline:
1. Fetch + clean source (markdown extract)
2. Claude: "Extract 5 distinct carousel-worthy angles from this content"
3. For each angle: run carousel generation
4. Claude: "Extract 3 distinct 45-second reel scripts from this content"
5. For each script: queue Reel generation pipeline

---

## 11. Meta app review checklist

Start in week 1, runs in parallel.

### 11.1 Required assets
- [ ] Privacy policy URL (must list Meta data use specifically)
- [ ] Terms of service URL
- [ ] Data deletion URL + automated endpoint
- [ ] App icon (1024×1024)
- [ ] Business verification (can take 1–2 weeks alone)

### 11.2 Scope justifications (write once, save)
For each scope, Meta wants:
- What your app does
- Why this scope is needed
- Screencast showing the exact flow using this scope

Scope: `instagram_business_content_publish`
- Usage: app users schedule and publish carousel/reel content to their own IG Business account
- Screencast must show: login → OAuth grant → compose → publish → appears on IG

### 11.3 Common rejection reasons (avoid)
- Asking for a scope you don't demonstrably use in the screencast
- Test account without real content
- Screencast too short / skipping steps
- Privacy policy missing Meta-specific language
- App still in development mode when submitted

---

## 12. Critical gotchas checklist

- [ ] `state` param in OAuth is HMAC-signed + Redis-backed + single-use
- [ ] Access tokens encrypted at rest (AES-256-GCM)
- [ ] Token refresh cron running daily, refreshes tokens expiring in <14 days
- [ ] Revocation webhook handler implemented
- [ ] Media URLs in IG containers are publicly accessible HTTPS (no auth)
- [ ] PNG → JPEG conversion before upload (with `sharp`, quality 90)
- [ ] Pre-publish quota check against `/content_publishing_limit`
- [ ] Container status polling uses exponential backoff capped at 15s
- [ ] `media_publish` never retried on ambiguous failure (idempotency key on job)
- [ ] Rendered media cleaned up 7 days post-publish (R2 lifecycle rule)
- [ ] Draft autosave every 3s debounced on frontend
- [ ] `scheduledFor` stored UTC, displayed in user's timezone
- [ ] `status` transitions through service only, every transition logged
- [ ] Per-`igAccountId` concurrency limit of 1 on publish worker
- [ ] Webhook signature verification on `/api/webhooks/instagram`
- [ ] Rate limiter: 200 calls/hour/account tracked in Redis, back off at 90%
- [ ] Hashtag count clamped to 30 (IG max), default 20
- [ ] Caption length clamped to 2200 chars (IG max)
- [ ] Carousel slide count clamped to 10 (IG max)
- [ ] Reel duration clamped to 5–90s
- [ ] Font licensing: only curated Google Fonts unless user uploads with click-through

---

## 13. Build plan (6 weeks to MVP)

### Week 1 — Foundations + submit app review
- [ ] Create Meta app, configure Instagram Business Login product
- [ ] Submit app review (business verification, privacy policy, etc.) — runs 2–4 weeks in parallel
- [ ] Prisma schema + migrations
- [ ] OAuth flow working end-to-end in dev (with dev-mode Meta app)
- [ ] Token encryption + refresh cron
- [ ] One Satori template rendering end-to-end in a CLI script (no DB)

### Week 2 — Carousel pipeline
- [ ] API endpoints: `/connect`, `/callback`, brand profiles, carousels CRUD
- [ ] BullMQ setup + Redis
- [ ] `render-carousel` worker
- [ ] R2 integration + public bucket
- [ ] End-to-end: user connects IG → uploads brand kit → picks template → fills text → hits preview → sees slides

### Week 3 — Publishing + scheduling
- [ ] `IgPublisher` adapter with full error handling
- [ ] `publish` worker
- [ ] Scheduled publish with BullMQ delay
- [ ] End-to-end: scheduled post lands on real IG (sandbox/dev account)
- [ ] Insights pull at 24h + 7d

### Week 4 — AI + template library + dashboard
- [ ] 5 more Satori templates (total 6)
- [ ] AI carousel generation with structured output
- [ ] Hashtag suggester
- [ ] Basic dashboard: list scheduled/published/failed, show insights

### Week 5 — Reels pipeline part 1
- [ ] Remotion project setup + one faceless-short composition
- [ ] Cartesia TTS integration
- [ ] Pexels b-roll integration
- [ ] WhisperX captions
- [ ] Remotion Lambda deployment
- [ ] End-to-end reel render (no IG publish yet)

### Week 6 — Reels publish + polish
- [ ] Reel publishing via `IgPublisher.createReelContainer`
- [ ] Cover image extraction
- [ ] Repurposing endpoint (URL → N carousels + M reels)
- [ ] Error handling end-to-end
- [ ] Billing integration (reuse Crescova Stripe)
- [ ] Meta app review submitted by now? If yes, move to prod app review.

---

## 14. Post-MVP roadmap

- Comment management (requires `instagram_business_manage_comments`)
- DM automation (requires `instagram_business_manage_messages`, reactive only — cannot send cold DMs)
- Story publishing (no stickers — API limitation)
- AI video generation tier (Veo 3 / Runway / Luma) as premium
- Cross-posting: Reels → YouTube Shorts + TikTok (unified content model)
- Competitive hashtag analytics (limited by 30-hashtag/week search cap)
- A/B test variants scheduler
- Best-time-to-post heuristic from account's historical insights

---

## 15. References

- Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview/
- Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Business Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
- OAuth Authorize: https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/
- Media endpoint reference: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
- Satori: https://github.com/vercel/satori
- Remotion: https://www.remotion.dev/docs
- Remotion Lambda: https://www.remotion.dev/docs/lambda

---

## 16. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-22 | Build as extension of Crescova, split infra | Reuse auth/billing/brand profiles; video rendering needs own workers |
| 2026-04-22 | Visual-first (carousel + reels), not text-first | Crescova already owns text; IG is visual |
| 2026-04-22 | Instagram Business Login (not Facebook Login for Business) | No FB Page requirement, cleaner UX |
| 2026-04-22 | Satori for carousels, Remotion for Reels | Fast, TS-native, no browser for carousels; Lambda-able for Reels |
| 2026-04-22 | Cloudflare R2 for media storage | No egress fees; Meta-friendly public URLs |
| 2026-04-22 | Ship carousels before Reels | 10x simpler, still high-demand, faster to validate |
