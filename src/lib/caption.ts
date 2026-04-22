import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

/**
 * Generate an Instagram caption for the given topic using Claude.
 * Falls back to a simple template if ANTHROPIC_API_KEY is not set.
 */
export async function generateCaption(topic: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `Exploring the world of ${topic}. What do you think? Drop a comment below!\n\n#${topic.replace(/\s+/g, '')} #instagram #daily`;
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Write an Instagram caption for a post about "${topic}".
Requirements:
- Start with a strong hook (question or bold statement)
- 2-3 short sentences of value or insight
- One call to action (e.g. save, comment, follow)
- 8-12 relevant hashtags at the end
- Casual, engaging tone
- Under 250 words total

Return only the caption — no explanation, no quotes around it.`,
      },
    ],
  });

  const text = message.content[0];
  return text.type === 'text' ? text.text.trim() : '';
}
