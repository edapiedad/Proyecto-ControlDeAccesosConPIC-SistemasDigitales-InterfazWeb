'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const supabase = createBrowserClient();
  
  const [profile, setProfile] = useState<any>(null);
  const [telegramId, setTelegramId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  
  const [invitations, setInvitations] = useState<any[]>([]);
  const [newInviteToken, setNewInviteToken] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      setTelegramId(data?.telegram_id?.toString() || '');
    }

    // Fetch invitations created by this user
    const { data: invites } = await supabase
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });
    
    setInvitations(invites || []);
    setIsLoading(false);
  }

  async function generateInvitation() {
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('invitations').insert({
      token,
      created_by: user?.id
    });

    if (error) {
       console.error('Error al generar invitación:', error);
    } else {
       setNewInviteToken(token);
       fetchData();
    }
  }

  async function handleUpdateTelegramId(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    // 1. Re-autenticar al usuario para cambios sensibles
    const { data: { user } } = await supabase.auth.getUser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user?.email as string,
      password: password,
    });

    if (authError) {
      setMessage({ text: 'Contraseña incorrecta. Verificación fallida.', type: 'error' });
      setIsSaving(false);
      return;
    }

    // 2. Actualizar el perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ telegram_id: parseInt(telegramId) || null })
      .eq('id', user?.id);

    if (updateError) {
      setMessage({ text: 'Error al actualizar el ID de Telegram.', type: 'error' });
    } else {
      setMessage({ text: '¡Ajustes guardados correctamente!', type: 'success' });
      setShowConfirm(false);
      setPassword('');
      fetchData();
    }
    setIsSaving(false);
  }

  if (isLoading) return <div className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Cargando ajustes...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Ajustes de Seguridad
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Gestiona tu identidad de Telegram y las invitaciones del sistema</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Sección: Perfil y Telegram ID */}
        <section className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>👤</span> Perfil de Administrador
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Tu ID de Telegram</label>
              <input
                type="number"
                className="form-input"
                placeholder="Ej: 1027425435"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Este ID permite que el Bot te reconozca como administrador.
              </p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Guardar Cambios
            </button>
          </form>

          {message.text && (
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              borderRadius: '8px',
              background: message.type === 'success' ? 'var(--status-granted-bg)' : 'var(--status-denied-bg)',
              color: message.type === 'success' ? 'var(--status-granted)' : 'var(--status-denied)',
              fontSize: '0.85rem'
            }}>
              {message.text}
            </div>
          )}
        </section>

        {/* Sección: Invitaciones de Equipo */}
        <section className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🎟️</span> Invitaciones del Sistema
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={generateInvitation} className="btn" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)', border: '1px dashed var(--accent-cyan)' }}>
              + Generar Nueva Clave
            </button>

            {newInviteToken && (
               <div className="animate-bounce" style={{ padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clave Generada:</p>
                  <code style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{newInviteToken}</code>
               </div>
            )}

            <div style={{ marginTop: '10px' }}>
              <p style={labelStyle}>Claves Recientes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invitations.slice(0, 5).map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <code style={{ color: inv.is_used ? 'var(--text-muted)' : 'var(--text-primary)' }}>{inv.token}</code>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      padding: '2px 8px', 
                      borderRadius: '10px',
                      background: inv.is_used ? 'var(--status-denied-bg)' : 'var(--status-granted-bg)',
                      color: inv.is_used ? 'var(--status-denied)' : 'var(--status-granted)'
                    }}>
                      {inv.is_used ? 'Usada' : 'Activa'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modal de Confirmación por Contraseña */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: '32px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Confirmar identidad</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Por seguridad, ingresa tu contraseña para autorizar el cambio del ID de Telegram.
            </p>
            <form onSubmit={handleUpdateTelegramId}>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Contraseña actual" 
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowConfirm(false)} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-subtle)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSaving}>
                  {isSaving ? 'Verificando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};
