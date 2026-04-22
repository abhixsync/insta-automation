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

async function uploadUrlToImgbb(imageUrl: string): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error('IMGBB_API_KEY is not set');

  const form = new URLSearchParams();
  form.append('key', apiKey);
  form.append('image', imageUrl); // imgbb fetches the URL itself — no binary download needed

  console.log('[flux] uploading URL to imgbb...');
  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json();
  console.log(`[flux] imgbb status: ${res.status}, url: ${data?.data?.url}`);
  if (!res.ok || !data?.data?.url) {
    throw new Error(`imgbb upload failed: ${JSON.stringify(data)}`);
  }

  return data.data.url as string;
}

export async function generateImage(topic: string): Promise<string> {
  const prompt = await buildImagePrompt(topic);
  console.log(`[flux] prompt: "${prompt.slice(0, 100)}"`);

  // Build Pollinations URL — imgbb will fetch it directly (avoids downloading in our function)
  const seed = Math.floor(Math.random() * 1_000_000);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  console.log('[flux] passing Pollinations URL to imgbb for hosting...');

  return await uploadUrlToImgbb(pollinationsUrl);
}
