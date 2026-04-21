import { supabaseAdmin } from '@/lib/supabase/server';
import { generateText, generateJSON } from '@/lib/gemini';

// Structured query response from LLM
interface QueryIntent {
  table: 'access_logs' | 'users' | 'view_top_users' | 'view_inactive_users' | 'view_peak_hours';
  filters: {
    column: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
    value: string;
  }[];
  select?: string;
  order_by?: string;
  order_direction?: 'asc' | 'desc';
  limit?: number;
  join_users?: boolean;
}

const SCHEMA_DESCRIPTION = `
Tablas disponibles en la base de datos:

1. "users" — Usuarios registrados del sistema de control de acceso
   - id: UUID (identificador único)
   - name: VARCHAR (nombre del usuario) 
   - rfid_tag: VARCHAR (tag RFID asignado, único)
   - role: VARCHAR (rol: 'admin', 'user', 'guardia', etc.)
   - created_at: TIMESTAMPTZ (fecha de creación)

2. "access_logs" — Registros de acceso al sistema
   - id: UUID (identificador único)
   - user_id: UUID (referencia a users.id, nullable para intentos fallidos)
   - rfid_tag_used: VARCHAR (tag RFID usado en el intento)
   - timestamp: TIMESTAMPTZ (fecha y hora del intento de acceso)
   - status: VARCHAR — Valores posibles:
     * 'GRANTED' = acceso concedido en modo normal
     * 'DENIED' = acceso denegado en modo normal
     * 'ANOMALY' = anomalía horaria detectada por IA
     * 'ADMIN_START' = se activó modo administrador (tarjeta maestra)
     * 'ADMIN_END' = se desactivó modo administrador
     * 'USER_ADDED' = nueva credencial registrada en el hardware
     * 'USER_REMOVED' = credencial eliminada del hardware
     * 'FACTORY_RESET' = borrado total de memoria del hardware

3. "view_top_users" — Vista Analítica de Asiduidad
   - Sirve para responder: "¿Quién entra más veces?", "Top usuarios"
   - Columnas: name, total_accesses (entero), last_access (fecha)
   - Ya viene ordenada de mayor a menor por defect

4. "view_inactive_users" — Vista Analítica de Fantasmas
   - Sirve para responder: "¿Quién no ha venido nunca?", "Tarjetas inactivas"
   - Columnas: id, name, rfid_tag, role

5. "view_peak_hours" — Vista Analítica de Tráfico
   - Sirve para responder: "¿A qué hora hay más picos?", "Horas con más accesos"
   - Columnas: hour_of_day (0 a 23), access_count (entero)
   - Ya viene ordenada de mayor a menor afluencia

Notas:
- Las fechas están en formato ISO 8601 (ej: 2025-01-15T14:30:00)
- El "timestamp" es la hora del servidor cuando se registró el acceso
- La zona horaria del sistema es America/Caracas (UTC-4)
`;

/**
 * Process a natural language query from Telegram (or voice note audio), convert to database query,
 * execute it, and format the results as a human-readable response.
 */
export async function processNLPQuery(userMessage: string, audioBase64?: string): Promise<string> {
  try {
    const todayISO = new Date().toISOString().split('T')[0];
    const systemPrompt = `Eres un asistente que convierte peticiones en español (texto o audio) a un JSON de consulta para una base de datos de control de acceso IoT.

${SCHEMA_DESCRIPTION}

Tu respuesta DEBE ser ÚNICAMENTE un objeto JSON con esta estructura (sin markdown, sin explicaciones, sin backticks):
{"table":"...", "filters":[...], "select":"...", "order_by":"...", "order_direction":"...", "limit":20, "join_users":true}

EJEMPLOS de consultas correctas:

Pregunta: "¿Quién entró hoy?"
{"table":"access_logs","filters":[{"column":"timestamp","operator":"gte","value":"${todayISO}T00:00:00Z"},{"column":"status","operator":"eq","value":"GRANTED"}],"join_users":true,"limit":50}

Pregunta: "Lista todos los usuarios"
{"table":"users","filters":[],"limit":50}

Pregunta: "¿Cuántos accesos hubo hoy?"
{"table":"access_logs","filters":[{"column":"timestamp","operator":"gte","value":"${todayISO}T00:00:00Z"}],"join_users":true,"limit":50}

Pregunta: "¿Quién entra más?"
{"table":"view_top_users","filters":[],"limit":10}

Pregunta: "¿A qué hora hay más tráfico?"
{"table":"view_peak_hours","filters":[],"limit":24}

Pregunta: "¿Quién no ha venido nunca?"
{"table":"view_inactive_users","filters":[],"limit":50}

Pregunta: "¿Se añadieron usuarios hoy?"
{"table":"access_logs","filters":[{"column":"timestamp","operator":"gte","value":"${todayISO}T00:00:00Z"},{"column":"status","operator":"eq","value":"USER_ADDED"}],"limit":50}

Pregunta: "Muestra las anomalías"
{"table":"access_logs","filters":[{"column":"status","operator":"eq","value":"ANOMALY"}],"join_users":true,"limit":20}

REGLAS:
1. Responde SOLO con el JSON. Nada más.
2. Para "hoy", usa gte con "${todayISO}T00:00:00Z" sobre la columna timestamp.
3. Para conteos, trae las filas (limit 50) y el formateador contará.
4. Para estadísticas (top, picos, inactivos), usa las vistas view_*.
5. Si no entiendes, responde: {"table":"users","filters":[],"limit":20}
`;


    // Si no hay texto, forzamos a que interprete la nota de voz
    const queryPrompt = userMessage || "Por favor escucha la nota de voz adjunta, deduce la consulta, y genera la estructura JSON correcta.";

    const queryIntent = await generateJSON<QueryIntent>(queryPrompt, systemPrompt, audioBase64);

    if (!queryIntent) {
      return '⚠️ No pude entender tu consulta o tu nota de voz. Intenta reformularla. Ejemplos:\n• "¿Quién entró hoy?"\n• "Muestra los accesos denegados de esta semana"\n• "Lista todos los usuarios"';
    }

    // Step 2: Build and execute query programmatically (no raw SQL!)
    const results = await executeStructuredQuery(queryIntent);

    if (results === null) {
      return '❌ Error al ejecutar la consulta en la base de datos.';
    }

    if (Array.isArray(results) && results.length === 0) {
      if (queryIntent.table === 'users') {
        return '📭 Parece que la tabla de Usuarios está totalmente vacía. No hay usuarios físicos (tarjetas) registrados en el sistema.';
      }
      return '📭 No hay eventos de acceso que coincidan con tu pregunta (El filtro no halló coincidencias).';
    }

    // Step 3: Format results using LLM
    const formatPrompt = `El usuario solicitó esto (vía texto o voz): "${queryPrompt}"

Resultados de la base de datos (JSON):
${JSON.stringify(results, null, 2)}

Formatea estos resultados como una respuesta clara y legible en español para un chat de Telegram.
Usa emojis apropiados (✅ para GRANTED, ❌ para DENIED, ⚠️ para ANOMALY).
Si hay fechas, formátealas de forma legible (ej: "15 ene 2025 a las 2:30 PM").
No uses markdown avanzado, solo texto plano con emojis y saltos de línea.
Limita la respuesta a los datos más relevantes.`;

    const formatSystemPrompt =
      'Eres un asistente que formatea datos de bases de datos como respuestas legibles en español para Telegram. Sé conciso y claro. No uses markdown.';

    const formattedResponse = await generateText(formatPrompt, formatSystemPrompt);
    return formattedResponse;
  } catch (error) {
    console.error('[NLPQuery] Error processing query:', error);
    return '❌ Ocurrió un error procesando tu consulta. Intenta de nuevo.';
  }
}

/**
 * Execute a structured query against Supabase programmatically.
 * This approach prevents SQL injection by never executing raw LLM-generated SQL.
 */
async function executeStructuredQuery(
  intent: QueryIntent
): Promise<Record<string, unknown>[] | null> {
  try {
    const validTables = ['access_logs', 'users', 'view_top_users', 'view_inactive_users', 'view_peak_hours'] as const;
    if (!validTables.includes(intent.table)) {
      console.error('[NLPQuery] Invalid table:', intent.table);
      return null;
    }

    // Build select columns
    let selectStr = intent.select || '*';
    if (intent.table === 'access_logs' && intent.join_users) {
      selectStr = '*, users(name)';
    }

    // Start building the query
    let query = supabaseAdmin
      .from(intent.table)
      .select(selectStr);

    // Apply filters with validation
    const validOperators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike'] as const;

    for (const filter of intent.filters || []) {
      if (!validOperators.includes(filter.operator as typeof validOperators[number])) {
        console.warn('[NLPQuery] Skipping invalid operator:', filter.operator);
        continue;
      }

      // Validate column names (basic sanitization)
      const safeColumn = filter.column.replace(/[^a-zA-Z0-9_]/g, '');
      if (safeColumn !== filter.column) {
        console.warn('[NLPQuery] Skipping suspicious column name:', filter.column);
        continue;
      }

      switch (filter.operator) {
        case 'eq':
          query = query.eq(safeColumn, filter.value);
          break;
        case 'neq':
          query = query.neq(safeColumn, filter.value);
          break;
        case 'gt':
          query = query.gt(safeColumn, filter.value);
          break;
        case 'gte':
          query = query.gte(safeColumn, filter.value);
          break;
        case 'lt':
          query = query.lt(safeColumn, filter.value);
          break;
        case 'lte':
          query = query.lte(safeColumn, filter.value);
          break;
        case 'like':
          query = query.like(safeColumn, filter.value);
          break;
        case 'ilike':
          query = query.ilike(safeColumn, filter.value);
          break;
      }
    }

    // Apply ordering
    if (intent.order_by) {
      const safeOrderBy = intent.order_by.replace(/[^a-zA-Z0-9_]/g, '');
      query = query.order(safeOrderBy, {
        ascending: intent.order_direction === 'asc',
      });
    } else if (intent.table === 'access_logs') {
      query = query.order('timestamp', { ascending: false });
    }

    // Apply limit
    const limit = Math.min(intent.limit || 20, 50);
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[NLPQuery] Supabase query error:', error);
      return null;
    }

    return (data as unknown) as Record<string, unknown>[];
  } catch (error) {
    console.error('[NLPQuery] Error executing structured query:', error);
    return null;
  }
}
