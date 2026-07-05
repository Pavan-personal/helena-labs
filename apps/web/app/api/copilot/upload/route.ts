import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerClient } from '@helena/db';
import { getWorkspaceFromSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function POST(req: Request) {
  const url = new URL(req.url);
  const hs = url.searchParams.get('hs') ?? undefined;
  const workspace = await getWorkspaceFromSession(hs);
  if (!workspace) return NextResponse.json({ error: 'no session' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'unsupported mime type' }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const db = getServerClient();
  // Dedupe within workspace
  const { data: existing } = await db
    .from('copilot_attachments')
    .select('id, storage_path, mime_type, bytes')
    .eq('workspace_id', workspace.id)
    .eq('sha256', sha256)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      attachmentId: (existing as { id: string }).id,
      deduped: true
    });
  }

  const ext = file.type.split('/')[1] ?? 'bin';
  const uuid = crypto.randomUUID();
  const storagePath = `${workspace.id}/${uuid}.${ext}`;

  const { error: upErr } = await db.storage
    .from('copilot-uploads')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error('upload failed:', upErr);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await db
    .from('copilot_attachments')
    .insert({
      workspace_id: workspace.id,
      storage_path: storagePath,
      mime_type: file.type,
      bytes: file.size,
      sha256
    })
    .select('*')
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: 'db insert failed' }, { status: 500 });
  }

  return NextResponse.json({
    attachmentId: (inserted as { id: string }).id,
    deduped: false
  });
}
