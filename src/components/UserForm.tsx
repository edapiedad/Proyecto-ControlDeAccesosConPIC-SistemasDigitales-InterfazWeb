'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, KeyRound, CreditCard } from 'lucide-react';

interface UserFormProps {
  onSubmit: (data: { name: string; rfid_tag: string; role: string }) => Promise<void>;
  initialData?: { name: string; rfid_tag: string; role: string };
  submitLabel?: string;
  onCancel?: () => void;
  availableTags?: string[];
}

const ROLES = ['user', 'admin', 'guardia', 'mantenimiento', 'visitante'];

export default function UserForm({
  onSubmit,
  initialData,
  submitLabel = 'Registrar Usuario',
  onCancel,
  availableTags = [],
}: UserFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [rfidTag, setRfidTag] = useState(initialData?.rfid_tag ?? '');
  const [role, setRole] = useState(initialData?.role ?? 'user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (!rfidTag.trim()) {
      setError('El tag RFID es requerido');
      return;
    }

    // Validar RFID tag o teclado (ej: KEY:1234 o A1B2C)
    const cleanTag = rfidTag.trim().toUpperCase();
    if (!/^[A-Z0-9:*#\-_]{2,20}$/.test(cleanTag)) {
      setError('El tag debe tener entre 2 y 20 caracteres alfanuméricos o símbolos válidos (: * #)');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        rfid_tag: cleanTag,
        role,
      });

      // Clear form on success (only for new entries)
      if (!initialData) {
        setName('');
        setRfidTag('');
        setRole('user');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar usuario');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Name */}
        <div>
          <label
            htmlFor="user-name"
            style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Nombre completo
          </label>
          <input
            id="user-name"
            type="text"
            className="form-input"
            placeholder="Ej: Juan Pérez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>

        {/* RFID Tag */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <label
            htmlFor="user-rfid"
            style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Tag RFID o Clave
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="user-rfid"
              type="text"
              className="form-input"
              placeholder="Ej: A1B2C3D4 o KEY:123A"
              value={rfidTag}
              onChange={(e) => {
                setRfidTag(e.target.value.toUpperCase());
                if (availableTags.length > 0) setDropdownOpen(true);
              }}
              onFocus={() => {
                if (availableTags.length > 0) setDropdownOpen(true);
              }}
              disabled={isSubmitting}
              autoComplete="off"
              style={{ fontFamily: 'monospace', letterSpacing: '0.05em', paddingRight: '40px' }}
            />
            {availableTags.length > 0 && (
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronDown size={18} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'var(--transition-fast)' }} />
              </button>
            )}
          </div>

          {/* Menú Flotante de Selección */}
          {dropdownOpen && availableTags.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              marginTop: '4px',
              backdropFilter: 'blur(16px)',
              maxHeight: '220px',
              overflowY: 'auto',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                Credenciales recientes (libres)
              </div>
              {availableTags.map(tag => (
                <div
                  key={tag}
                  onClick={() => { setRfidTag(tag); setDropdownOpen(false); }}
                  style={{ 
                    padding: '10px 14px', 
                    borderBottom: '1px solid var(--border-subtle)', 
                    cursor: 'pointer', 
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
                    {tag.startsWith('KEY:') ? <KeyRound size={14} /> : <CreditCard size={14} />}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{tag}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tag.startsWith('KEY:') ? 'Clave de teclado' : 'Tarjeta RFID'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Valor hexadecimal del tag o código de teclado (2-20 caracteres)
          </p>
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="user-role"
            style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Rol
          </label>
          <select
            id="user-role"
            className="form-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSubmitting}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--status-denied-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--status-denied)',
              fontSize: '0.8rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            id="submit-user"
          >
            {isSubmitting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Guardando...
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
