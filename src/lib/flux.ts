import Groq from 'groq-sdk';

async function buildImagePrompt(topic: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return `${topic}, high quality, photorealistic, Instagram post, vibrant colors`;

  try {
    const client = new Groq({ apiKey: groqKey });
    const msg = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `Write a detailed image generation prompt for an Instagram post about "${topic}". Be specific about lighting, style, mood, and visual elements. Make it photorealistic and visually stunning. Reply with ONLY the prompt — no explanation, no quotes.`,
        },
      ],
    });
    const text = msg.choices[0]?.message?.content?.trim() ?? '';
    if (text.length > 10) return text;
  } catch {
    // fall through
  }

  return `${topic}, high quality, photorealistic, Instagram post, vibrant colors`;
}

async function uploadToImgbb(imageBuffer: ArrayBuffer): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error('IMGBB_API_KEY is not set');

  const base64 = Buffer.from(imageBuffer).toString('base64');

  const form = new URLSearchParams();
  form.append('key', apiKey);
  form.append('image', base64);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json();
  if (!res.ok || !data?.data?.url) {
    throw new Error(`imgbb upload failed: ${JSON.stringify(data)}`);
  }

  return data.data.url as string;
}

async function generateImageBuffer(prompt: string): Promise<ArrayBuffer> {
  // Try Pollinations first (free, no key)
  try {
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
    console.log('[flux] trying Pollinations...');
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    console.log(`[flux] Pollinations status: ${res.status}`);
    if (res.ok) return await res.arrayBuffer();
    if (res.status !== 429) throw new Error(`Pollinations error: ${res.status}`);
    console.log('[flux] Pollinations 429 — falling back to HuggingFace');
  } catch (err: unknown) {
    const is429 = err instanceof Error && err.message.includes('429');
    if (!is429) throw err;
    console.log('[flux] Pollinations 429 (caught) — falling back to HuggingFace');
  }

  // Fallback: Hugging Face Inference API (free with HF token)
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) throw new Error('Pollinations rate limited and HF_TOKEN is not set');

  console.log('[flux] trying HuggingFace...');
  const res = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt, parameters: { width: 1024, height: 1024 } }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  console.log(`[flux] HuggingFace status: ${res.status}`);
  if (!res.ok) throw new Error(`HuggingFace error: ${res.status} ${await res.text()}`);
  return await res.arrayBuffer();
}

export async function generateImage(topic: string): Promise<string> {
  const prompt = await buildImagePrompt(topic);
  console.log(`[flux] prompt: "${prompt.slice(0, 100)}"`);
  const imageBuffer = await generateImageBuffer(prompt);
  console.log(`[flux] image buffer size: ${imageBuffer.byteLength} bytes`);
  const url = await uploadToImgbb(imageBuffer);
  console.log(`[flux] imgbb URL: ${url}`);
  return url;
}
