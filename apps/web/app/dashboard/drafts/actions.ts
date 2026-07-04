'use server';

import { revalidatePath } from 'next/cache';
import { approveDraft, rejectDraft } from '@helena/db';

export async function approveDraftAction(formData: FormData) {
  const draftId = formData.get('draftId')?.toString();
  if (!draftId) return;
  await approveDraft(draftId, 'reviewer');
  revalidatePath('/dashboard/drafts');
  revalidatePath('/dashboard/runbooks');
}

export async function rejectDraftAction(formData: FormData) {
  const draftId = formData.get('draftId')?.toString();
  if (!draftId) return;
  await rejectDraft(draftId, 'reviewer');
  revalidatePath('/dashboard/drafts');
}
