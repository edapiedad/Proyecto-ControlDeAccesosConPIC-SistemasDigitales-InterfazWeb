import { supabaseAdmin } from '@/lib/supabase/server';
import { generateText } from '@/lib/gemini';
import { sendSecurityAlert } from '@/lib/telegram';

/**
 * Detect anomalous access times using statistical analysis.
 * If anomaly detected, update log status, generate alert via LLM, and send to Telegram.
 */
export async function detectTimeAnomaly(
  logId: string,
  userId: string,
  userName: string,
  accessTimestamp: string
): Promise<void> {
  try {
    // Fetch last 30 GRANTED accesses for this user
    const { data: history, error } = await supabaseAdmin
      .from('access_logs')
      .select('timestamp')
      .eq('user_id', userId)
      .eq('status', 'GRANTED')
      .order('timestamp', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[AnomalyDetector] Error fetching history:', error);
      return;
    }

    const accessDate = new Date(accessTimestamp);
    const accessHour = accessDate.getHours() + accessDate.getMinutes() / 60;

    // Check fixed-range anomaly: outside 06:00-20:00
    const isOutsideFixedRange = accessHour < 6 || accessHour > 20;

    // Check statistical anomaly if we have enough history
    let isStatisticalAnomaly = false;
    let meanHour = 0;
    let stdDevHour = 0;

    if (history && history.length >= 5) {
      const hours = history.map((log) => {
        const d = new Date(log.timestamp);
        return d.getHours() + d.getMinutes() / 60;
      });

      // Calculate mean
      meanHour = hours.reduce((sum, h) => sum + h, 0) / hours.length;

      // Calculate standard deviation
      const squaredDiffs = hours.map((h) => Math.pow(h - meanHour, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / hours.length;
      stdDevHour = Math.sqrt(variance);

      // If std dev is too small (all accesses at same time), use a minimum threshold
      const effectiveStdDev = Math.max(stdDevHour, 0.5);

      // Check if current access is > 2 standard deviations from mean
      isStatisticalAnomaly = Math.abs(accessHour - meanHour) > 2 * effectiveStdDev;
    }

    if (!isOutsideFixedRange && !isStatisticalAnomaly) {
      return; // No anomaly detected
    }

    // Mark the log as ANOMALY
    await supabaseAdmin
      .from('access_logs')
      .update({ status: 'ANOMALY' })
      .eq('id', logId);

    // Build context for LLM
    const timeFormatted = accessDate.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const reasons: string[] = [];
    if (isOutsideFixedRange) {
      reasons.push('Acceso fuera del horario permitido (06:00-20:00)');
    }
    if (isStatisticalAnomaly) {
      reasons.push(
        `Acceso a ${accessHour.toFixed(1)}h difiere significativamente del patrón habitual (media: ${meanHour.toFixed(1)}h, σ: ${stdDevHour.toFixed(1)}h)`
      );
    }

    const prompt = `El usuario "${userName}" accedió al sistema a las ${timeFormatted}.
Razones de la anomalía detectada:
${reasons.map((r) => `- ${r}`).join('\n')}

Historial: El usuario tiene ${history?.length ?? 0} accesos previos registrados.
Hora media de acceso: ${meanHour.toFixed(1)}h
Desviación estándar: ${stdDevHour.toFixed(1)}h

Redacta una alerta de seguridad breve y estructurada en español para notificar al administrador. Incluye la severidad (ALTA/MEDIA/BAJA), un resumen de la situación, y una recomendación de acción.`;

    const systemInstruction =
      'Eres un asistente de seguridad para un sistema de control de acceso IoT. Genera alertas concisas y profesionales en español. No uses markdown.';

    const alertText = await generateText(prompt, systemInstruction);
    await sendSecurityAlert(alertText);
  } catch (error) {
    console.error('[AnomalyDetector] Unexpected error:', error);
  }
}
