import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = String(process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');

if (!token || !secretToken || !/^https:\/\//.test(baseUrl)) {
  throw new Error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and an HTTPS PUBLIC_APP_URL first');
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: `${baseUrl}/api/integrations/telegram/webhook`,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  }),
});
const result = await response.json();
if (!result.ok) throw new Error(result.description || 'Telegram rejected the webhook');
console.log('Telegram webhook configured successfully.');
