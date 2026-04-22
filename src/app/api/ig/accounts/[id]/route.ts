import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await db.igAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  await db.post.deleteMany({ where: { igAccountId: id } });
  await db.igAccount.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
