import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { loadEnv } from '@helena/shared';

/**
 * Verify a Discord interaction request using Ed25519.
 * Discord signs `timestamp + body` with the app's private key. We verify with
 * the DER-encoded public key derived from DISCORD_PUBLIC_KEY (hex).
 */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp) return false;
  const env = loadEnv();
  if (!env.DISCORD_PUBLIC_KEY) return false;

  try {
    const pubKeyBytes = Buffer.from(env.DISCORD_PUBLIC_KEY, 'hex');
    // Wrap raw ed25519 public key in DER as Node crypto expects.
    // Structure: 302a300506032b6570032100 + 32-byte public key.
    const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const der = Buffer.concat([derPrefix, pubKeyBytes]);
    const publicKey = createPublicKey({
      key: der,
      format: 'der',
      type: 'spki'
    });
    const message = Buffer.from(timestamp + rawBody);
    const sigBytes = Buffer.from(signature, 'hex');
    return cryptoVerify(null, message, publicKey, sigBytes);
  } catch {
    return false;
  }
}

export async function fetchDiscordChannels(botToken: string, guildId: string): Promise<Array<{
  id: string;
  name: string;
  type: number;
}>> {
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: 'no-store'
  });
  if (!res.ok) return [];
  const arr = (await res.json()) as Array<{ id: string; name: string; type: number }>;
  // Type 0 is GUILD_TEXT
  return arr.filter((c) => c.type === 0);
}

export async function postToDiscord(
  channelId: string,
  content: string,
  botToken: string
): Promise<void> {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: content.slice(0, 1900) })
  });
  if (!res.ok) console.error('Discord post failed:', await res.text());
}

export async function editDiscordInteractionResponse(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, 1900) })
  });
  if (!res.ok) console.error('Discord edit response failed:', await res.text());
}

export async function fetchDiscordMessage(
  channelId: string,
  messageId: string,
  botToken: string
): Promise<{ content: string; author?: { username?: string; id?: string } } | null> {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  if (!res.ok) return null;
  return (await res.json()) as { content: string; author?: { username?: string; id?: string } };
}
