import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendTelegramMessage, getAuthorizedIdsFromEnv, getTelegramVoiceAsBase64 } from '@/lib/telegram';
import { processNLPQuery } from '@/lib/ai-engine/nlp-query';

export const dynamic = 'force-dynamic';

interface TelegramUpdate {
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    voice?: {
      file_id: string;
      duration: number;
      mime_type: string;
    };
    date: number;
  };
}

/**
 * POST /api/telegram-webhook
 * Receives incoming messages from Telegram Bot API webhook.
 * Checks authorization, processes NLP queries, responds in chat.
 */
export async function POST(request: NextRequest) {
  try {
    let update: TelegramUpdate;
    try {
      update = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const message = update.message;
    if (!message || (!message.text && !message.voice)) {
      // Ignore non-text and non-voice messages
      return Response.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const userText = message.text?.trim() || '';
    const userName = message.from.first_name;
    const voiceFileId = message.voice?.file_id;

    // 1. Check authorization — both env-based and database-based
    const isAuthorized = await checkAuthorization(userId);

    if (!isAuthorized) {
      await sendTelegramMessage(
        chatId,
        `⛔ Lo siento, ${userName}. No tienes autorización para usar este bot.\nTu ID es: <code>${userId}</code>\nContacta al administrador para solicitar acceso.`
      );
      return Response.json({ ok: true });
    }

    // 2. Handle special commands (Solo aplican al texto)
    if (userText.startsWith('/')) {
      const response = await handleCommand(userText, userId, userName);
      await sendTelegramMessage(chatId, response);
      return Response.json({ ok: true });
    }

    // 3. Process natural language query or audio note
    if (voiceFileId) {
      await sendTelegramMessage(chatId, '🎙️ <i>Descargando tu nota de voz...</i>', 'HTML', false);
      const audioBase64 = await getTelegramVoiceAsBase64(voiceFileId);
      
      if (!audioBase64) {
        await sendTelegramMessage(chatId, '❌ Lo siento, no pude procesar el audio debido a un error de red. Por favor, intenta escribir tu consulta.');
        return Response.json({ ok: true });
      }
      
      await sendTelegramMessage(chatId, '🧠 <i>Procesando audio y ejecutando análisis (IA)...</i>', 'HTML', false);
      const response = await processNLPQuery('', audioBase64);
      await sendTelegramMessage(chatId, response);
      
    } else if (userText) {
      await sendTelegramMessage(chatId, '🔍 <i>Procesando tu consulta...</i>', 'HTML', false);
      const response = await processNLPQuery(userText);
      await sendTelegramMessage(chatId, response);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    return Response.json({ ok: true }); // Always return 200 to Telegram
  }
}

/**
 * Check if a Telegram user is authorized via env or database.
 */
async function checkAuthorization(telegramUserId: number): Promise<boolean> {
  // Check env-based authorization
  const envIds = getAuthorizedIdsFromEnv();
  if (envIds.includes(telegramUserId)) {
    return true;
  }

  // Check database-based authorization
  try {
    const { data, error } = await supabaseAdmin
      .from('telegram_authorized_users')
      .select('is_active')
      .eq('telegram_id', telegramUserId)
      .maybeSingle();

    if (error) {
      console.error('[Telegram Auth] DB check error:', error);
      return false;
    }

    return data?.is_active === true;
  } catch {
    return false;
  }
}

/**
 * Handle bot commands.
 */
async function handleCommand(command: string, userId: number, userName: string): Promise<string> {
  const cmd = command.split(' ')[0].toLowerCase().replace(/@.*$/, '');

  switch (cmd) {
    case '/start':
      return `👋 ¡Hola ${userName}! Soy el bot del Sistema de Control de Acceso IoT.\n\nPuedes hacerme preguntas en lenguaje natural sobre los accesos, por ejemplo:\n\n• "¿Quién entró hoy?"\n• "Muestra los accesos denegados de esta semana"\n• "¿Cuántos accesos hubo después de las 5 PM?"\n• "Lista todos los usuarios"\n• "¿Hubo anomalías hoy?"\n\n📋 Comandos disponibles:\n/start - Mostrar esta ayuda\n/status - Estado del sistema\n/myid - Ver tu ID de Telegram`;

    case '/myid':
      return `🆔 Tu ID de Telegram es: <code>${userId}</code>`;

    case '/status': {
      // Get system status
      const { count: totalUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayLogs } = await supabaseAdmin
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', today.toISOString());

      const { count: todayDenied } = await supabaseAdmin
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', today.toISOString())
        .eq('status', 'DENIED');

      const { count: todayAnomalies } = await supabaseAdmin
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', today.toISOString())
        .eq('status', 'ANOMALY');

      return `📊 <b>Estado del Sistema</b>\n\n👥 Usuarios registrados: ${totalUsers ?? 0}\n📋 Accesos hoy: ${todayLogs ?? 0}\n❌ Denegados hoy: ${todayDenied ?? 0}\n⚠️ Anomalías hoy: ${todayAnomalies ?? 0}\n\n🕐 ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`;
    }

    default:
      return `❓ Comando no reconocido: ${cmd}\nUsa /start para ver los comandos disponibles.`;
  }
}
