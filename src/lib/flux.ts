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

async function generateWithPollinations(prompt: string): Promise<string> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

  // Pre-fetch to ensure image is generated before we return the URL
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`Pollinations error: ${res.status}`);

  return url;
}

async function generateWithTogetherAI(prompt: string): Promise<string> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('TOGETHER_API_KEY is not set');

  const res = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      response_format: 'url',
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Together AI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('Together AI returned no image URL');
  return url;
}

export async function generateImage(topic: string): Promise<string> {
  const prompt = await buildImagePrompt(topic);
  console.log(`[flux] topic: "${topic}" → prompt: "${prompt.slice(0, 80)}…"`);

  // Together AI returns a stable CDN URL that Meta can reliably fetch.
  // Pollinations is fallback only (its URLs can be unreliable for Instagram).
  if (process.env.TOGETHER_API_KEY) {
    try {
      const url = await generateWithTogetherAI(prompt);
      console.log('[flux] generated via Together AI');
      return url;
    } catch (err) {
      console.warn('[flux] Together AI failed, falling back to Pollinations:', err);
    }
  }

  const url = await generateWithPollinations(prompt);
  console.log('[flux] generated via Pollinations');
  return url;
}
