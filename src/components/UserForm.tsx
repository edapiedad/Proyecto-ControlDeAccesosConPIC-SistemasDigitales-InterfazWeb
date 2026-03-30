'use client';

import { useState } from 'react';

interface UserFormProps {
  onSubmit: (data: { name: string; rfid_tag: string; role: string }) => Promise<void>;
  initialData?: { name: string; rfid_tag: string; role: string };
  submitLabel?: string;
  onCancel?: () => void;
}

const ROLES = ['user', 'admin', 'guardia', 'mantenimiento', 'visitante'];

export default function UserForm({
  onSubmit,
  initialData,
  submitLabel = 'Registrar Usuario',
  onCancel,
}: UserFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [rfidTag, setRfidTag] = useState(initialData?.rfid_tag ?? '');
  const [role, setRole] = useState(initialData?.role ?? 'user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

    // Basic RFID tag validation (alphanumeric hex)
    const cleanTag = rfidTag.trim().toUpperCase();
    if (!/^[A-F0-9]{2,20}$/.test(cleanTag)) {
      setError('El tag RFID debe ser un valor hexadecimal válido (ej: A1B2C3D4)');
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
        <div>
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
            Tag RFID
          </label>
          <input
            id="user-rfid"
            type="text"
            className="form-input"
            placeholder="Ej: A1B2C3D4"
            value={rfidTag}
            onChange={(e) => setRfidTag(e.target.value.toUpperCase())}
            disabled={isSubmitting}
            autoComplete="off"
            style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Valor hexadecimal del tag RFID (2-20 caracteres)
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
