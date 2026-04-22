import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/flux';
import { generateCaption } from '@/lib/caption';

export const maxDuration = 60; // Pollinations + imgbb can take up to 45s

export async function GET(request: NextRequest) {
  const topic = new URL(request.url).searchParams.get('topic')?.trim();
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

  try {
    const [imageUrl, caption] = await Promise.all([
      generateImage(topic),
      generateCaption(topic),
    ]);

    return NextResponse.json({ imageUrl, caption });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
