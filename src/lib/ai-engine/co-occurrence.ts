import { supabaseAdmin } from '@/lib/supabase/server';
import { generateText } from '@/lib/gemini';
import { sendSecurityAlert } from '@/lib/telegram';

/**
 * Analyze co-occurrence patterns that may indicate security threats.
 * 
 * Pattern 1: Multiple DENIED attempts (>3 in 5 minutes) — brute force
 * Pattern 2: Consecutive GRANTED in <10 seconds — piggybacking/tailgating
 */
export async function analyzeCoOccurrence(
  rfidTag: string,
  status: string,
  accessTimestamp: string
): Promise<void> {
  try {
    const now = new Date(accessTimestamp);

    if (status === 'DENIED') {
      await checkBruteForcePattern(rfidTag, now);
    }

    if (status === 'GRANTED') {
      await checkPiggybackingPattern(rfidTag, now);
    }
  } catch (error) {
    console.error('[CoOccurrence] Unexpected error:', error);
  }
}

/**
 * Check if the same RFID tag has had >3 DENIED attempts in the last 5 minutes.
 */
async function checkBruteForcePattern(rfidTag: string, now: Date): Promise<void> {
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const { data: deniedLogs, error } = await supabaseAdmin
    .from('access_logs')
    .select('id, timestamp')
    .eq('rfid_tag_used', rfidTag)
    .eq('status', 'DENIED')
    .gte('timestamp', fiveMinutesAgo.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('[CoOccurrence] Error checking brute force:', error);
    return;
  }

  if (!deniedLogs || deniedLogs.length < 3) {
    return; // Below threshold
  }

  const timeFormatted = now.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const prompt = `Se detectaron ${deniedLogs.length} intentos de acceso DENEGADO con el tag RFID "${rfidTag}" en los últimos 5 minutos (desde las ${timeFormatted}).

Esto podría indicar:
- Un intento de acceso por fuerza bruta con una tarjeta no registrada
- Una tarjeta dañada o desconfigurada
- Un intento de clonación de tarjetas RFID

Genera una alerta de seguridad breve en español indicando la severidad (ALTA), un resumen del patrón detectado, y recomendaciones de acción inmediata (verificar cámaras, bloquear tag, notificar personal).`;

  const systemInstruction =
    'Eres un asistente de seguridad para un sistema de control de acceso IoT. Genera alertas concisas y profesionales en español. No uses markdown.';

  const alertText = await generateText(prompt, systemInstruction);
  await sendSecurityAlert(alertText);
}

/**
 * Check if the same RFID tag had consecutive GRANTED accesses in <10 seconds.
 * This suggests piggybacking / tailgating.
 */
async function checkPiggybackingPattern(rfidTag: string, now: Date): Promise<void> {
  const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);

  const { data: recentGranted, error } = await supabaseAdmin
    .from('access_logs')
    .select('id, timestamp')
    .eq('rfid_tag_used', rfidTag)
    .eq('status', 'GRANTED')
    .gte('timestamp', tenSecondsAgo.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('[CoOccurrence] Error checking piggybacking:', error);
    return;
  }

  // Need at least 2 GRANTED in 10 seconds (current + previous)
  if (!recentGranted || recentGranted.length < 2) {
    return;
  }

  const timeFormatted = now.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Calculate time gap
  const timestamps = recentGranted.map((l) => new Date(l.timestamp).getTime());
  const minGap = Math.min(
    ...timestamps.slice(0, -1).map((t, i) => Math.abs(t - timestamps[i + 1]))
  );
  const gapSeconds = (minGap / 1000).toFixed(1);

  const prompt = `Se detectaron ${recentGranted.length} accesos CONCEDIDOS consecutivos con el tag RFID "${rfidTag}" en menos de 10 segundos (intervalo mínimo: ${gapSeconds}s) a las ${timeFormatted}.

Esto podría indicar un caso de "piggybacking" o "tailgating", donde:
- Una persona autorizada pasa su tarjeta y otra persona entra detrás sin autenticarse
- La misma tarjeta está siendo presentada múltiples veces rápidamente

Genera una alerta de seguridad breve en español indicando la severidad (MEDIA-ALTA), un resumen del patrón detectado, y recomendaciones (verificar cámaras del punto de acceso, confirmar identidad del usuario).`;

  const systemInstruction =
    'Eres un asistente de seguridad para un sistema de control de acceso IoT. Genera alertas concisas y profesionales en español. No uses markdown.';

  const alertText = await generateText(prompt, systemInstruction);
  await sendSecurityAlert(alertText);
}
