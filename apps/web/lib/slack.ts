import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '@helena/shared';

/**
 * Verifies the Slack request signature per the v0 scheme.
 * Slack docs: https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp) return false;
  const env = loadEnv();

  const tsInt = parseInt(timestamp, 10);
  if (Number.isNaN(tsInt)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsInt) > 300) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = 'v0=' + createHmac('sha256', env.SLACK_SIGNING_SECRET).update(base).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function postToSlack(
  channel: string,
  text: string,
  botToken: string,
  threadTs?: string
): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${botToken}`
    },
    body: JSON.stringify({ channel, text, thread_ts: threadTs })
  });
  if (!res.ok) console.error('Slack post failed:', await res.text());
}

export async function fetchSlackFile(url: string, botToken: string): Promise<Buffer | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${botToken}` }
  });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export function bufferToDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}
