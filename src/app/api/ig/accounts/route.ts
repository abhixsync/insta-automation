import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const accounts = await db.igAccount.findMany({
    where: { status: 'active' },
    select: { id: true, igUserId: true, username: true, status: true, connectedAt: true },
    orderBy: { connectedAt: 'desc' },
  });
  return NextResponse.json({ accounts });
}
