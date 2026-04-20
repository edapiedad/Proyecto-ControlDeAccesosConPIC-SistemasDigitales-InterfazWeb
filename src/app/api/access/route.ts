import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { detectTimeAnomaly } from '@/lib/ai-engine/anomaly-detector';
import { analyzeCoOccurrence } from '@/lib/ai-engine/co-occurrence';
import type { AccessStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * POST /api/access
 * Recibe credenciales (RFID o Keypad) y la VEREDICTO DE ESTADO ('GRANTED', 'DENIED', 'ANOMALY')
 * directamente desde el PIC18F45K50. El servidor asienta los registros y delega la decisión al HW.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar la Llave de la API (Asegura que solo el PIC hable con el Endpoint)
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.ESP32_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parsear el cuerpo de la petición
    let body: { rfid_tag?: string; credential?: string; status?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Aceptamos "rfid_tag" o "credential" para acomodar teclado matricial y tarjetas por igual
    const credential = (body.credential?.trim() || body.rfid_tag?.trim())?.toUpperCase();
    if (!credential) {
      return Response.json(
        { error: 'Missing or invalid credential (rfid_tag or credential required)' },
        { status: 400 }
      );
    }

    // El PIC decide el estado. Si no lo envía, asumimos DENIED por extrema precaución.
    const accessStatus: AccessStatus = 
      (body.status?.trim().toUpperCase() as AccessStatus) || 'DENIED';

    // 3. Buscar la credencial (RFID/Clave) en la base de datos de usuarios físicos
    let { data: user, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id, name, role')
      .eq('rfid_tag', credential)
      .maybeSingle();

    if (lookupError) {
      console.error('[Access API] User lookup error:', lookupError);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // 4. AUTO-CAPTURA: Si el PIC dice que la puerta se abrió (GRANTED), pero no conocemos al usuario...
    // ¡Lo registramos automáticamente como "Usuario Desconocido"!
    if (!user && accessStatus === 'GRANTED') {
      const { data: newUser, error: insertUserError } = await supabaseAdmin
        .from('users')
        .insert({
          name: 'Usuario Desconocido',
          rfid_tag: credential,
          role: 'user'
        })
        .select('id, name, role')
        .single();
        
      if (insertUserError) {
        console.error('[Access API] Failed to capture new unknown user:', insertUserError);
      } else {
        user = newUser; // Ahora tenemos ID para amarrarle al log
      }
    }

    const now = new Date().toISOString();

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
      return Response.json(
        { error: 'Failed to log access' },
        { status: 500 }
      );
    }

    // 6. Lanzar análisis IA en segundo plano (No asincrono para no trabar el PIC)
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

    // 7. Retornar respuesta exitosa al PIC
    return Response.json(
      {
        status: accessStatus,
        user_name: user?.name ?? 'Desconocido',
        timestamp: now,
        logged: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Access API] Unexpected error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
