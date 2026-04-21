import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { detectTimeAnomaly } from '@/lib/ai-engine/anomaly-detector';
import { analyzeCoOccurrence } from '@/lib/ai-engine/co-occurrence';
import type { AccessStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

// Todos los estatus válidos que acepta nuestro sistema (alineados con el PIC18F45K50)
const VALID_STATUSES: AccessStatus[] = [
  'GRANTED',       // PIC: "ACCESO CONCEDIDO"
  'DENIED',        // PIC: "ACCESO DENEGADO"
  'ANOMALY',       // IA: Acceso fuera de horario
  'ADMIN_START',   // PIC: ">> ADMIN: ON"
  'ADMIN_END',     // PIC: ">> ADMIN: OFF"
  'USER_ADDED',    // PIC: "AGREGANDO..."
  'USER_REMOVED',  // PIC: "ELIMINANDO..."
  'FACTORY_RESET', // PIC: "!!! FACTORY RESET !!!"
  'WIFI_ON',        // ESP32: Conectado a WiFi
  'WIFI_OFF',       // ESP32: Desconectado de WiFi
];

/**
 * Reconcilia logs huérfanos: busca registros con el mismo rfid_tag pero sin user_id
 * y los vincula al usuario correcto.
 */
async function reconcileOrphanedLogs(userId: string, credential: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('access_logs')
      .update({ user_id: userId })
      .eq('rfid_tag_used', credential)
      .is('user_id', null);

    if (error) {
      console.error('[Access API] Orphan reconciliation error:', error);
    }
  } catch (err) {
    console.error('[Access API] Unexpected reconciliation error:', err);
  }
}

/**
 * Busca o crea un usuario para una credencial dada.
 * Retorna el usuario encontrado/creado o null.
 */
async function findOrCreateUser(credential: string, shouldCreate: boolean) {
  // Buscar usuario existente
  const { data: existingUser, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id, name, role')
    .eq('rfid_tag', credential)
    .maybeSingle();

  if (lookupError) {
    console.error('[Access API] User lookup error:', lookupError);
    return null;
  }

  if (existingUser) return existingUser;

  // Si no existe y debemos crearlo
  if (shouldCreate) {
    const isKeypad = credential.startsWith('KEY');
    const shortCred = credential.length > 4 ? credential.slice(-4) : credential;
    const typeName = isKeypad ? 'Clave Teclado' : 'Tarjeta RFID';
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        name: `${typeName} (*${shortCred})`,
        rfid_tag: credential,
        role: 'user'
      })
      .select('id, name, role')
      .single();

    if (insertError) {
      // Si falla por UNIQUE constraint (otro request ya lo creó), intentar buscar de nuevo
      if (insertError.code === '23505') {
        const { data: retryUser } = await supabaseAdmin
          .from('users')
          .select('id, name, role')
          .eq('rfid_tag', credential)
          .maybeSingle();
        return retryUser;
      }
      console.error('[Access API] Failed to auto-register user:', insertError);
      return null;
    }

    // Reconciliar logs huérfanos anteriores con este nuevo usuario
    if (newUser) {
      await reconcileOrphanedLogs(newUser.id, credential);
    }

    return newUser;
  }

  return null;
}

/**
 * POST /api/access
 * Recibe credenciales y eventos del PIC18F45K50 vía ESP32.
 * Soporta: accesos normales, eventos admin, alta/baja de usuarios y factory reset.
 * 
 * Body esperado:
 *   credential | rfid_tag: string (RFID tag o código de teclado)
 *   status: string (GRANTED, DENIED, ADMIN_START, etc.)
 *   timestamp?: string (ISO 8601, opcional — para eventos diferidos cuando ESP32 estuvo sin internet)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar API Key
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.ESP32_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parsear body
    let body: { rfid_tag?: string; credential?: string; status?: string; timestamp?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const credential = (body.credential?.trim() || body.rfid_tag?.trim())?.toUpperCase();
    if (!credential) {
      return Response.json(
        { error: 'Missing or invalid credential' },
        { status: 400 }
      );
    }

    // Validar status contra lista blanca
    const rawStatus = body.status?.trim().toUpperCase() as AccessStatus;
    const accessStatus: AccessStatus = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'DENIED';

    // Usar timestamp del ESP32 si viene (para eventos diferidos), sino usar hora actual del servidor
    const eventTimestamp = body.timestamp || new Date().toISOString();

    // ================================================================
    // RUTA A: Eventos Administrativos del PIC
    // ================================================================
    if (['ADMIN_START', 'ADMIN_END', 'USER_ADDED', 'USER_REMOVED', 'FACTORY_RESET'].includes(accessStatus)) {

      // USER_ADDED: registrar la credencial nueva en la tabla users
      if (accessStatus === 'USER_ADDED') {
        await findOrCreateUser(credential, true);
      }

      // Registrar el evento administrativo en la bitácora
      const { error: logError } = await supabaseAdmin
        .from('access_logs')
        .insert({
          user_id: null,
          rfid_tag_used: credential,
          timestamp: eventTimestamp,
          status: accessStatus,
        });

      if (logError) {
        console.error('[Access API] Admin event log error:', logError);
        return Response.json({ error: 'Failed to log admin event' }, { status: 500 });
      }

      return Response.json({
        status: accessStatus,
        message: `Evento "${accessStatus}" registrado`,
        timestamp: eventTimestamp,
        logged: true
      }, { status: 200 });
    }

    // ================================================================
    // RUTA B: Accesos Normales (GRANTED / DENIED)
    // ================================================================

    // Para GRANTED: buscar o crear usuario. Para DENIED: solo buscar.
    const user = await findOrCreateUser(credential, accessStatus === 'GRANTED');

    // Insertar log de acceso
    const { data: logEntry, error: insertLogError } = await supabaseAdmin
      .from('access_logs')
      .insert({
        user_id: user?.id ?? null,
        rfid_tag_used: credential,
        timestamp: eventTimestamp,
        status: accessStatus,
      })
      .select('id')
      .single();

    if (insertLogError) {
      console.error('[Access API] Log insert error:', insertLogError);
      return Response.json({ error: 'Failed to log access' }, { status: 500 });
    }

    // Análisis IA en segundo plano (solo para GRANTED con usuario conocido)
    if (logEntry && user && accessStatus === 'GRANTED') {
      detectTimeAnomaly(logEntry.id, user.id, user.name, eventTimestamp).catch((err) =>
        console.error('[Access API] Anomaly detection error:', err)
      );
    }

    if (logEntry) {
      analyzeCoOccurrence(credential, accessStatus, eventTimestamp).catch((err) =>
        console.error('[Access API] Co-occurrence analysis error:', err)
      );
    }

    return Response.json({
      status: accessStatus,
      user_name: user?.name ?? 'Desconocido',
      timestamp: eventTimestamp,
      logged: true
    }, { status: 200 });

  } catch (error) {
    console.error('[Access API] Unexpected error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
