export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export function shorten(value, limit) {
  const chars = [...String(value ?? '')];
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join('');
}

export function captionText(value, limit) {
  let result = '';
  for (const char of String(value ?? '')) {
    const escaped = escapeHtml(char);
    if (result.length + escaped.length > limit - 1) return `${result}…`;
    result += escaped;
  }
  return result;
}

export class TelegramRateLimitError extends Error {
  constructor(retryAfter) {
    super('Telegram rate limit reached; remaining announcements deferred');
    this.retryAfter = Math.max(1, Math.ceil(Number(retryAfter) || 60));
  }
}

export async function sendTelegram(text, mediaUrl, threadId, env, animation = false) {
  if (!Number.isSafeInteger(threadId) || threadId <= 0) throw new Error('Telegram topic ID is not configured');
  if (!env.TELEGRAM_CHAT_ID || !env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram credentials are not configured');
  // Keep the raw caption below the parsed-caption limit, including HTML entities.
  if (text.length > 1024) throw new Error('Telegram caption exceeds 1024 characters');
  const media = await fetch(mediaUrl, {signal: AbortSignal.timeout(15000)});
  if (!media.ok) throw new Error(`Announcement media returned ${media.status}`);
  const form = new FormData();
  form.append('chat_id', env.TELEGRAM_CHAT_ID);
  form.append(animation ? 'animation' : 'video', await media.blob(), mediaUrl.split('/').pop());
  form.append('caption', text);
  form.append('parse_mode', 'HTML');
  form.append('message_thread_id', String(threadId));
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${animation ? 'sendAnimation' : 'sendVideo'}`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(20000)
  });
  const result = await response.json().catch(() => null);
  if (response.status === 429 || result?.error_code === 429) {
    throw new TelegramRateLimitError(result?.parameters?.retry_after);
  }
  if (!response.ok || result?.ok !== true) {
    throw new Error(`Telegram delivery failed (${result?.error_code || response.status}): ${shorten(result?.description || 'invalid acknowledgement', 160)}`);
  }
  return result.result;
}
