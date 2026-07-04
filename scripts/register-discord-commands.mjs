/**
 * Registers global Discord application commands.
 * Run: node --env-file=apps/web/.env.local scripts/register-discord-commands.mjs
 */
const APP_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error('Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in env');
  process.exit(1);
}

const COMMANDS = [
  {
    name: 'askoncall',
    description: 'Search past incidents for a resolution',
    type: 1,
    options: [
      {
        name: 'query',
        description: 'Describe the alert or symptom',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'Save to helena',
    type: 3
  }
];

async function main() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(COMMANDS)
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Command registration failed:', res.status, text);
    process.exit(1);
  }
  console.log('Registered:', text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
