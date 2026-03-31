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
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
  showKeyboard: boolean = true
): Promise<boolean> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}${token}/sendMessage`;

  // Telegram messages have a 4096 character limit
  const truncatedText = text.length > 4000 ? text.substring(0, 4000) + '\n\n⚠️ Mensaje truncado...' : text;

  const payload: any = {
    chat_id: chatId,
    text: truncatedText,
    parse_mode: parseMode,
  };

  // Activa la botonera persistente en la parte inferior del chat
  if (showKeyboard) {
    payload.reply_markup = {
      keyboard: [
        [{ text: '/status' }],
        [{ text: '/start' }, { text: '/myid' }]
      ],
      resize_keyboard: true,
      is_persistent: true
    };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

/**
 * Fetch a Telegram voice file and return it as a Base64 string for Gemini 2.5
 */
export async function getTelegramVoiceAsBase64(fileId: string): Promise<string | null> {
  const token = getBotToken();
  try {
    // 1. Obtener la ruta del archivo OGG desde Telegram
    const fileRes = await fetch(`${TELEGRAM_API_BASE}${token}/getFile?file_id=${fileId}`);
    if (!fileRes.ok) return null;
    
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;
    
    // 2. Descargar el binario directamente del Content Delivery Network (CDN) oficial
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
    const downloadRes = await fetch(downloadUrl);
    
    if (!downloadRes.ok) return null;
    
    // 3. Convertirlo a ArrayBuffer y luego a Codificación Base64
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error('[Telegram] Error descargando archivo de audio:', error);
    return null;
  }
}
