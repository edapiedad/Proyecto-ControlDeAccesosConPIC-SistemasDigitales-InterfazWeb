import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { detectTimeAnomaly } from '@/lib/ai-engine/anomaly-detector';
import { analyzeCoOccurrence } from '@/lib/ai-engine/co-occurrence';
import type { AccessStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * POST /api/access
 * Receives RFID tag from ESP32, verifies access, logs the event,
 * and triggers async AI analysis.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.ESP32_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let body: { rfid_tag?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const rfidTag = body.rfid_tag?.trim().toUpperCase();
    if (!rfidTag || typeof rfidTag !== 'string') {
      return Response.json(
        { error: 'Missing or invalid rfid_tag' },
        { status: 400 }
      );
    }

    // 3. Look up the RFID tag in users table
    const { data: user, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id, name, role')
      .eq('rfid_tag', rfidTag)
      .maybeSingle();

    if (lookupError) {
      console.error('[Access API] User lookup error:', lookupError);
      return Response.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    // 4. Determine access status
    const accessStatus: AccessStatus = user ? 'GRANTED' : 'DENIED';
    const now = new Date().toISOString();

    // 5. Insert access log
    const { data: logEntry, error: insertError } = await supabaseAdmin
      .from('access_logs')
      .insert({
        user_id: user?.id ?? null,
        rfid_tag_used: rfidTag,
        timestamp: now,
        status: accessStatus,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Access API] Log insert error:', insertError);
      return Response.json(
        { error: 'Failed to log access' },
        { status: 500 }
      );
    }

    // 6. Fire-and-forget: Async AI analysis (doesn't block ESP32 response)
    if (logEntry) {
      // Time anomaly detection (only for granted accesses with a known user)
      if (user && accessStatus === 'GRANTED') {
        detectTimeAnomaly(logEntry.id, user.id, user.name, now).catch((err) =>
          console.error('[Access API] Anomaly detection error:', err)
        );
      }

      // Co-occurrence analysis (for all accesses)
      analyzeCoOccurrence(rfidTag, accessStatus, now).catch((err) =>
        console.error('[Access API] Co-occurrence analysis error:', err)
      );
    }

    // 7. Return response to ESP32
    return Response.json(
      {
        status: accessStatus,
        user_name: user?.name ?? null,
        timestamp: now,
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
