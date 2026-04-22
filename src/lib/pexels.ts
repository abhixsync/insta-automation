import Groq from 'groq-sdk';

const PEXELS_API_URL = 'https://api.pexels.com/v1/search';

interface PexelsPhoto {
  src: { original: string; large2x: string; large: string };
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

/**
 * Use Groq 70B to convert a topic into a concrete, visual Pexels search query.
 * Falls back to the raw topic if GROQ_API_KEY is not set.
 */
async function buildSearchQuery(topic: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return topic.trim().slice(0, 100);

  try {
    const client = new Groq({ apiKey: groqKey });
    const msg = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Give me a 2-4 word Pexels stock photo search query for an Instagram post about "${topic}". Reply with ONLY the search keywords — no punctuation, no explanation. Make it concrete and visual (e.g. "person working laptop cafe" not "productivity"). Avoid brand names.`,
        },
      ],
    });
    const text = msg.choices[0]?.message?.content?.trim().replace(/["""]/g, '') ?? '';
    if (text.length > 2 && text.length < 80) return text;
  } catch {
    // fall through to raw topic
  }

  return topic.trim().slice(0, 100);
}

/**
 * Search Pexels by topic and return a public image URL not in usedUrls.
 * Uses Groq 70B to generate a better visual search query.
 */
export async function searchPexels(
  topic: string,
  usedUrls: Set<string> = new Set()
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error('PEXELS_API_KEY is not set');

  const query = await buildSearchQuery(topic);
  console.log(`[pexels] topic: "${topic}" → query: "${query}"`);

  const url = new URL(PEXELS_API_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '20'); // fetch more so we can skip used ones
  url.searchParams.set('orientation', 'square');
  url.searchParams.set('size', 'medium');

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as PexelsResponse;
  if (!data.photos?.length) return null;

  // Shuffle and pick first unused
  const shuffled = [...data.photos].sort(() => Math.random() - 0.5);
  for (const photo of shuffled) {
    const candidate = photo.src.large2x || photo.src.large || photo.src.original;
    if (!usedUrls.has(candidate)) return candidate;
  }

  // All results already used — return any random one
  const fallback = shuffled[0];
  return fallback.src.large2x || fallback.src.large || fallback.src.original;
}
