const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN environment variable');
  }
  return token;
}

/**
 * Check if a Telegram chat/user ID is authorized to use the bot.
 * Checks both the env variable list and the database.
 */
export function getAuthorizedIdsFromEnv(): number[] {
  const ids = process.env.TELEGRAM_AUTHORIZED_IDS ?? '';
  return ids
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));
}

/**
 * Send a message to a Telegram chat with retry logic.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<boolean> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}${token}/sendMessage`;

  // Telegram messages have a 4096 character limit
  const truncatedText = text.length > 4000 ? text.substring(0, 4000) + '\n\n⚠️ Mensaje truncado...' : text;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: truncatedText,
          parse_mode: parseMode,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return true;
      }

      const errorData = await response.json().catch(() => ({}));
      console.error(`[Telegram] Attempt ${attempt + 1} failed:`, response.status, errorData);

      // Don't retry on client errors (4xx) except rate limiting (429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return false;
      }
    } catch (error) {
      console.error(`[Telegram] Attempt ${attempt + 1} error:`, error);
    }

    // Wait before retrying
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  console.error('[Telegram] All retry attempts failed');
  return false;
}

/**
 * Send a security alert to all authorized Telegram users.
 */
export async function sendSecurityAlert(alertText: string): Promise<void> {
  const authorizedIds = getAuthorizedIdsFromEnv();

  if (authorizedIds.length === 0) {
    console.warn('[Telegram] No authorized IDs configured, skipping alert');
    return;
  }

  const message = `🚨 <b>ALERTA DE SEGURIDAD</b>\n\n${alertText}`;

  await Promise.allSettled(
    authorizedIds.map((chatId) => sendTelegramMessage(chatId, message))
  );
}
