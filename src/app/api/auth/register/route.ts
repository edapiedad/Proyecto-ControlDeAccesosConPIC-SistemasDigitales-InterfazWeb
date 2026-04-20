import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/auth/register
 * Registra un nuevo administrador validando un token de invitación.
 */
export async function POST(request: Request) {
  try {
    const { email, password, token, fullName } = await request.json();

    if (!email || !password || !token) {
      return NextResponse.json(
        { error: 'Email, contraseña y clave de invitación son requeridos.' },
        { status: 400 }
      );
    }

    // 1. Validar el token de invitación
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'La clave de invitación es inválida, ya fue usada o ha expirado.' },
        { status: 400 }
      );
    }

    // 2. Crear el usuario en Auth usando Service Role (admin client)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: `Error al crear usuario: ${authError?.message}` },
        { status: 500 }
      );
    }

    // 3. Marcar el token como usado
    await supabaseAdmin
      .from('invitations')
      .update({ 
        is_used: true, 
        used_by: authUser.user.id 
      })
      .eq('id', invite.id);

    return NextResponse.json(
      { message: 'Usuario registrado exitosamente. Ya puedes iniciar sesión.' },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Register API Error]:', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
