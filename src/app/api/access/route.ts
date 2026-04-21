import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { detectTimeAnomaly } from '@/lib/ai-engine/anomaly-detector';
import { analyzeCoOccurrence } from '@/lib/ai-engine/co-occurrence';
import type { AccessStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

// Todos los estatus válidos que acepta nuestro sistema (alineados con el PIC18F45K50)
const VALID_STATUSES: AccessStatus[] = [
  'GRANTED',       // PIC: "ACCESO CONCEDIDO" — Tarjeta/clave válida en modo normal
  'DENIED',        // PIC: "ACCESO DENEGADO" — Tarjeta/clave NO encontrada
  'ANOMALY',       // IA: Acceso fuera de horario o patrón estadístico raro
  'ADMIN_START',   // PIC: ">> ADMIN: ON" — Se activó modo administrador con tarjeta maestra
  'ADMIN_END',     // PIC: ">> ADMIN: OFF" — Se desactivó modo administrador
  'USER_ADDED',    // PIC: "AGREGANDO..." — Nueva tarjeta/clave registrada en EEPROM
  'USER_REMOVED',  // PIC: "ELIMINANDO..." — Tarjeta/clave borrada de EEPROM
  'FACTORY_RESET', // PIC: "!!! FACTORY RESET !!!" — Memoria borrada (clave D311 en admin)
];

/**
 * POST /api/access
 * Recibe credenciales y eventos del PIC18F45K50 vía ESP32.
 * Soporta: accesos normales, eventos admin, alta/baja de usuarios y factory reset.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar la Llave de la API
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.ESP32_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parsear el cuerpo de la petición
    let body: { rfid_tag?: string; credential?: string; status?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Aceptamos "rfid_tag" o "credential" (teclado matricial y tarjetas RFID)
    const credential = (body.credential?.trim() || body.rfid_tag?.trim())?.toUpperCase();
    if (!credential) {
      return Response.json(
        { error: 'Missing or invalid credential (rfid_tag or credential required)' },
        { status: 400 }
      );
    }

    // Validar el estatus contra la lista blanca
    const rawStatus = body.status?.trim().toUpperCase() as AccessStatus;
    const accessStatus: AccessStatus = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'DENIED';

    const now = new Date().toISOString();

    // ================================================================
    // RUTA A: Eventos Administrativos del PIC (no son accesos físicos)
    // ================================================================
    if (['ADMIN_START', 'ADMIN_END', 'USER_ADDED', 'USER_REMOVED', 'FACTORY_RESET'].includes(accessStatus)) {
      
      // Para USER_ADDED: auto-registrar la credencial nueva en la tabla users
      if (accessStatus === 'USER_ADDED') {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('rfid_tag', credential)
          .maybeSingle();

        if (!existingUser) {
          const shortCred = credential.length > 4 ? credential.slice(-4) : credential;
          await supabaseAdmin
            .from('users')
            .insert({
              name: `Usuario Nuevo (*${shortCred})`,
              rfid_tag: credential,
              role: 'user'
            });
        }
      }

      // Registrar el evento administrativo en la bitácora
      const { error: logError } = await supabaseAdmin
        .from('access_logs')
        .insert({
          user_id: null,
          rfid_tag_used: credential,
          timestamp: now,
          status: accessStatus,
        });

      if (logError) {
        console.error('[Access API] Admin event log error:', logError);
        return Response.json({ error: 'Failed to log admin event' }, { status: 500 });
      }

      return Response.json({
        status: accessStatus,
        message: `Evento administrativo "${accessStatus}" registrado correctamente`,
        timestamp: now,
        logged: true
      }, { status: 200 });
    }

    // ================================================================
    // RUTA B: Accesos Normales (GRANTED / DENIED)
    // ================================================================

    // 3. Buscar la credencial en la base de datos de usuarios físicos
    let { data: user, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id, name, role')
      .eq('rfid_tag', credential)
      .maybeSingle();

    if (lookupError) {
      console.error('[Access API] User lookup error:', lookupError);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // 4. AUTO-CAPTURA: Si el PIC dice GRANTED pero no conocemos esa credencial
    if (!user && accessStatus === 'GRANTED') {
      const shortCred = credential.length > 4 ? credential.slice(-4) : credential;
      const { data: newUser, error: insertUserError } = await supabaseAdmin
        .from('users')
        .insert({
          name: `Usuario Desconocido (*${shortCred})`,
          rfid_tag: credential,
          role: 'user'
        })
        .select('id, name, role')
        .single();
        
      if (insertUserError) {
        console.error('[Access API] Failed to capture new unknown user:', insertUserError);
      } else {
        user = newUser;
      }
    }

    // 5. Insertar la bitácora del acceso
    const { data: logEntry, error: insertLogError } = await supabaseAdmin
      .from('access_logs')
      .insert({
        user_id: user?.id ?? null,
        rfid_tag_used: credential,
        timestamp: now,
        status: accessStatus,
      })
      .select('id')
      .single();

    if (insertLogError) {
      console.error('[Access API] Log insert error:', insertLogError);
      return Response.json({ error: 'Failed to log access' }, { status: 500 });
    }

    // 6. Lanzar análisis IA en segundo plano (solo para accesos GRANTED con usuario conocido)
    if (logEntry) {
      if (user && accessStatus === 'GRANTED') {
        detectTimeAnomaly(logEntry.id, user.id, user.name, now).catch((err) =>
          console.error('[Access API] Anomaly detection error:', err)
        );
      }

      analyzeCoOccurrence(credential, accessStatus, now).catch((err) =>
        console.error('[Access API] Co-occurrence analysis error:', err)
      );
    }

    // 7. Retornar respuesta al ESP32/PIC
    return Response.json({
      status: accessStatus,
      user_name: user?.name ?? 'Desconocido',
      timestamp: now,
      logged: true
    }, { status: 200 });

  } catch (error) {
    console.error('[Access API] Unexpected error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
