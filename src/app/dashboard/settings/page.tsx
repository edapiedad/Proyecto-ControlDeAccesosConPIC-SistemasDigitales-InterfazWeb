'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Settings2, ShieldCheck, Loader2, CircleCheck, TriangleAlert } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createBrowserClient();
  
  const [profile, setProfile] = useState<any>(null);
  const [telegramId, setTelegramId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');

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
    
    setIsLoading(false);
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
    if (!user) {
      setMessage({ text: 'No se pudo obtener la información del usuario.', type: 'error' });
      setIsSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ telegram_id: parseInt(telegramId) || null })
      .eq('id', user.id);

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
    <div className="animate-in">
      <header className="animate-in animate-in-delay-1" style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings2 size={24} color="var(--accent-cyan)" /> Ajustes de Seguridad
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Gestiona tu identidad de Telegram para acceso mediante IA</p>
      </header>

      <div className="animate-in animate-in-delay-2" style={{ display: 'flex', justifyContent: 'center' }}>
        
        {/* Sección: Perfil y Telegram ID (Centrada) */}
        <section className="glass-card" style={{ padding: '32px', width: '100%', maxWidth: '600px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 2, background: 'var(--status-granted)', opacity: 0.8, borderRadius: '0 0 4px 4px' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)' }}><ShieldCheck size={22} /></span> Perfil de Administrador
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                Este ID numérico permite que nuestro bot inteligente mapee tus consultas en lenguaje natural a tu cuenta administrativa en la plataforma.
              </p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '12px 24px' }}>
              Guardar Cambios
            </button>
          </form>

          {message.text && (
            <div className="animate-fade-in" style={{ 
              marginTop: '20px', 
              padding: '12px', 
              borderRadius: '8px',
              background: message.type === 'success' ? 'var(--status-granted-bg)' : 'var(--status-denied-bg)',
              color: message.type === 'success' ? 'var(--status-granted)' : 'var(--status-denied)',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {message.type === 'success' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
              {message.text}
            </div>
          )}
        </section>
      </div>

      {/* Modal de Confirmación por Contraseña */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card animate-fade-in" style={{ padding: '32px', maxWidth: '400px', width: '90%', border: '1px solid var(--border-accent)' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <ShieldCheck color="var(--accent-cyan)" /> Confirmar identidad
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Por seguridad de la plataforma, ingresa tu contraseña maestra para autorizar la integración con la cuenta de Telegram seleccionada.
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
                <button type="button" onClick={() => setShowConfirm(false)} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSaving}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Verificando</> : 'Confirmar'}
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
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};
