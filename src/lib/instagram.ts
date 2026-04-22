const IG_AUTH_BASE = 'https://api.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH_BASE = 'https://graph.instagram.com';

function apiBase() {
  return `${IG_GRAPH_BASE}/${process.env.IG_GRAPH_VERSION ?? 'v23.0'}`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    redirect_uri: process.env.IG_REDIRECT_URI!,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    state,
  });
  return `${IG_AUTH_BASE}?${params}`;
}

export async function exchangeCode(code: string) {
  // Step 1: short-lived token
  const form = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    client_secret: process.env.IG_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: process.env.IG_REDIRECT_URI!,
    code,
  });
  const res = await fetch(IG_TOKEN_URL, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const { access_token, user_id } = (await res.json()) as {
    access_token: string;
    user_id: number;
  };

  // Step 2: upgrade to long-lived token (60-day)
  const longRes = await fetch(
    `${IG_GRAPH_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${process.env.IG_APP_SECRET!}&access_token=${access_token}`
  );
  if (!longRes.ok) throw new Error(`Long-lived exchange failed: ${await longRes.text()}`);
  const { access_token: longToken, expires_in } = (await longRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Step 3: fetch username via /me
  const profileRes = await fetch(
    `${apiBase()}/me?fields=username&access_token=${longToken}`
  );
  const profileData = (await profileRes.json()) as { username?: string };
  const username = profileData.username ?? `ig_${user_id}`;

  return {
    accessToken: longToken,
    igUserId: String(user_id),
    username,
    expiresAt: new Date(Date.now() + expires_in * 1000),
  };
}

export async function postImage(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<{ mediaId: string; permalink: string }> {
  const base = apiBase();

  // Step 1: create media container (retry on transient errors — safe, no double-post risk)
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: token,
  });
  let containerData: { id?: string; error?: { is_transient?: boolean; code?: number } } = {};
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 3000));
    const containerRes = await fetch(`${base}/${igUserId}/media?${containerParams}`, {
      method: 'POST',
    });
    containerData = await containerRes.json();
    if (containerData.id) break;
    const err = containerData.error as { is_transient?: boolean; code?: number } | undefined;
    if (!err?.is_transient) break; // non-transient — no point retrying
  }
  if (!containerData.id)
    throw new Error(`Container creation failed: ${JSON.stringify(containerData)}`);

  // Step 2: poll until FINISHED
  await waitForContainer(containerData.id, token, base);

  // Step 3: publish (never retry on ambiguous failure)
  const publishParams = new URLSearchParams({
    creation_id: containerData.id,
    access_token: token,
  });
  const publishRes = await fetch(`${base}/${igUserId}/media_publish?${publishParams}`, {
    method: 'POST',
  });
  const publishData = (await publishRes.json()) as { id?: string; error?: unknown };
  if (!publishData.id)
    throw new Error(`Publish failed: ${JSON.stringify(publishData)}`);

  // Step 4: get permalink
  const permalinkRes = await fetch(
    `${base}/${publishData.id}?fields=permalink&access_token=${token}`
  );
  const { permalink } = (await permalinkRes.json()) as { permalink: string };

  return { mediaId: publishData.id, permalink };
}

async function waitForContainer(
  containerId: string,
  token: string,
  base: string,
  timeoutMs = 5 * 60_000
) {
  const start = Date.now();
  let delay = 2000;
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      `${base}/${containerId}?fields=status_code,status&access_token=${token}`
    );
    const { status_code, status } = (await res.json()) as {
      status_code: string;
      status: string;
    };
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED')
      throw new Error(`Container ${status_code}: ${status}`);
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 15_000);
  }
  throw new Error('Container polling timed out');
}
