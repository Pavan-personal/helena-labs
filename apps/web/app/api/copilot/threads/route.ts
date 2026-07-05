import { NextResponse } from 'next/server';
import { getWorkspaceFromSession } from '@/lib/session';
import { createThread, listThreads } from '@/lib/copilot/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace = await getWorkspaceFromSession(url.searchParams.get('hs') ?? undefined);
  if (!workspace) return NextResponse.json({ error: 'no session' }, { status: 401 });
  const threads = await listThreads(workspace.id, 30);
  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { hs?: string };
  const workspace = await getWorkspaceFromSession(body.hs);
  if (!workspace) return NextResponse.json({ error: 'no session' }, { status: 401 });
  const thread = await createThread({
    workspaceId: workspace.id,
    createdBy: workspace.installer_email ?? 'unknown'
  });
  return NextResponse.json({ thread });
}
