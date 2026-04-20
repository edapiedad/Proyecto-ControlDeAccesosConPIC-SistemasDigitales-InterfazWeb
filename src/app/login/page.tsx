'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    // Si ya estamos autenticados, lo devolvemos al dashboard de forma forzada
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    checkSession();
  }, [supabase.auth, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Acceso denegado: Credenciales incorrectas');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      console.error('[Login Error]', err);
      setError('Error de red al intentar iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg-primary)'
    }}>
      <div className="glass-card animate-in" style={{
        width: '100%',
        maxWidth: '430px',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            background: 'rgba(6, 182, 212, 0.1)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'var(--accent-cyan)',
            fontSize: '28px',
            border: '1px solid rgba(6, 182, 212, 0.3)'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h1 className="animate-in animate-in-delay-1" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Acceso Autorizado
          </h1>
          <p className="animate-in animate-in-delay-1" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Ingresa tus credenciales de administrador
          </p>
        </div>

        <form onSubmit={handleLogin} className="animate-in animate-in-delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Correo Electrónico</label>
            <input
              id="email"
              type="email"
              required
              className="form-input"
              placeholder="admin@proyecto.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Contraseña</label>
            <input
              id="password"
              type="password"
              required
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="animate-slide-in-up" style={{
              padding: '12px',
              background: 'var(--status-denied-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--status-denied)',
              fontSize: '0.85rem',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary animate-in animate-in-delay-3"
            style={{ marginTop: '12px', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
            disabled={isLoading}
          >
            {isLoading ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
