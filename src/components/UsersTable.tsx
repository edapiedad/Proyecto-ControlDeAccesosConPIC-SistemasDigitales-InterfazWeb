'use client';

import { useState } from 'react';
import type { User } from '@/types/database';
import { KeyRound, CreditCard, Pencil, Trash2 } from 'lucide-react';

interface UsersTableProps {
  users: User[];
  onDelete: (userId: string) => Promise<void>;
  onEdit: (user: User) => void;
  retiredView?: boolean;
}

export default function UsersTable({ users, onDelete, onEdit, retiredView = false }: UsersTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDelete(userId: string) {
    if (confirmDeleteId !== userId) {
      setConfirmDeleteId(userId);
      return;
    }

    setDeletingId(userId);
    try {
      await onDelete(userId);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <div className="onyx-card" style={{ overflow: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID Interno</th>
            <th>Nombre</th>
            {!retiredView && <th>Tipo</th>}
            {!retiredView && <th>Credencial</th>}
            <th>Rol</th>
            <th>Registrado</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No hay usuarios registrados
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} style={{ background: (user.name.includes('Teclado') || user.name.includes('RFID') || user.name.includes('Desconocido')) ? 'var(--surface)' : 'transparent' }}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {user.id.substring(0, 8).toUpperCase()}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.name}</span>
                    {(user.name.includes('Teclado') || user.name.includes('RFID') || user.name.includes('Desconocido')) && !retiredView && (
                      <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-high)', color: 'var(--status-anomaly)', fontWeight: 700, letterSpacing: '0.05em' }}>REQUERIDO</span>
                    )}
                  </div>
                </td>
                {!retiredView && (
                  <>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        {user.rfid_tag?.startsWith('KEY') ? <><KeyRound size={14} style={{ color: 'var(--text-muted)' }} /> Teclado</> : <><CreditCard size={14} style={{ color: 'var(--text-muted)' }} /> Tarjeta</>}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {user.rfid_tag}
                      </code>
                    </td>
                  </>
                )}
                <td>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      color: user.role === 'admin' ? 'var(--accent-teal)' : 'var(--text-secondary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {user.role === 'admin' ? 'Administrador' : 'Colaborador'}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{formatDate(user.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    {!retiredView && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onEdit(user)}
                        title="Editar información"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      className={`btn btn-sm ${confirmDeleteId === user.id ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingId === user.id}
                      title={retiredView ? "Borrar del historial" : "Desvincular credencial"}
                    >
                      {deletingId === user.id
                        ? '...'
                        : confirmDeleteId === user.id
                          ? '¿Seguro?'
                          : <Trash2 size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
