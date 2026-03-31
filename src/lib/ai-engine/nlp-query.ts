import { supabaseAdmin } from '@/lib/supabase/server';
import { generateText, generateJSON } from '@/lib/gemini';

// Structured query response from LLM
interface QueryIntent {
  table: 'access_logs' | 'users';
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
   - status: VARCHAR ('GRANTED' = acceso concedido, 'DENIED' = acceso denegado, 'ANOMALY' = anomalía detectada)

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
    // Step 1: Convert natural language or audio to structured query intent
    const systemPrompt = `Eres un asistente que convierte peticiones (ya sea en texto o deduciéndolas del audio adjunto) a consultas estructuradas para una base de datos de control de acceso IoT.

${SCHEMA_DESCRIPTION}

Responde SIEMPRE con un JSON válido con esta estructura:
{
  "table": "access_logs" | "users",
  "filters": [
    { "column": "nombre_columna", "operator": "eq|neq|gt|gte|lt|lte|like|ilike", "value": "valor" }
  ],
  "select": "columnas separadas por coma (opcional)",
  "order_by": "columna para ordenar (opcional)",
  "order_direction": "asc" | "desc" (opcional),
  "limit": número máximo de resultados (opcional, default 20),
  "join_users": true si necesitas unir con la tabla users (solo para access_logs)
}

Reglas:
- Si recibes un audio adjunto, escúchalo, extrae la intención del usuario y genera el JSON.
- Para filtros de fecha/hora, usa formato ISO 8601
- Hoy es ${new Date().toISOString().split('T')[0]}
- Para "hoy", filtra timestamp >= inicio del día actual en UTC-4
- Para búsquedas de nombre, usa "ilike" con comodines: "%texto%"
- Si no se especifica un límite, usa 20
- Si la pregunta es sobre accesos o movimientos, usa la tabla "access_logs" con join_users=true
- Si la pregunta es sobre usuarios o personas registradas, usa la tabla "users"
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
      return '📭 No se encontraron resultados para tu consulta.';
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
    const validTables = ['access_logs', 'users'] as const;
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
