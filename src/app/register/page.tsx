'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, token, fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al procesar el registro.');
      } else {
        setSuccess('¡Registro exitoso! Redirigiendo al login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err) {
      console.error('[Register Page Error]:', err);
      setError('Error de conexión. Intenta de nuevo.');
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
        gap: '24px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            background: 'rgba(56, 189, 248, 0.1)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'var(--accent-cyan)',
            fontSize: '28px',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <UserPlus size={28} />
          </div>
          <h1 className="animate-in animate-in-delay-1" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Nuevo Administrador
          </h1>
          <p className="animate-in animate-in-delay-1" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Únete al equipo usando tu clave de invitación
          </p>
        </div>

        <form onSubmit={handleRegister} className="animate-in animate-in-delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label">Nombre Completo</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej: Juan Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="form-label">Correo Electrónico</label>
            <input
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
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              required
              className="form-input"
              placeholder="Min. 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <div>
            <label className="form-label" style={{ color: 'var(--accent-cyan)' }}>Clave de Invitación</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej: AB12-XY99"
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', textTransform: 'uppercase' }}
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="animate-slide-in-up" style={{
              padding: '10px',
              background: 'var(--status-denied-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--status-denied)',
              fontSize: '0.85rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div className="animate-slide-in-up" style={{
              padding: '10px',
              background: 'var(--status-granted-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'var(--status-granted)',
              fontSize: '0.85rem',
              textAlign: 'center'
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary animate-in animate-in-delay-3"
            style={{ marginTop: '10px', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
            disabled={isLoading}
          >
            {isLoading ? <><Loader2 size={18} className="animate-spin" /> Procesando invitación...</> : 'Crear Cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <Link href="/login" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ¿Ya tienes cuenta? <span style={{ color: 'var(--accent-cyan)' }}>Inicia sesión</span>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .form-label {
          display: block;
          fontSize: 0.8rem;
          fontWeight: 600;
          color: var(--text-secondary);
          marginBottom: 8px;
          textTransform: uppercase;
          letterSpacing: 0.5px;
        }
      `}</style>
    </div>
  );
}
