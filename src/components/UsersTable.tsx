'use client';

import { useState } from 'react';
import type { User } from '@/types/database';

interface UsersTableProps {
  users: User[];
  onDelete: (userId: string) => Promise<void>;
  onEdit: (user: User) => void;
}

export default function UsersTable({ users, onDelete, onEdit }: UsersTableProps) {
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
    <div className="glass-card" style={{ overflow: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Credencial</th>
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
              <tr key={user.id} style={{ background: (user.name.includes('Teclado') || user.name.includes('RFID') || user.name.includes('Desconocido')) ? 'rgba(245, 158, 11, 0.06)' : 'transparent' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.name}</span>
                    {(user.name.includes('Teclado') || user.name.includes('RFID') || user.name.includes('Desconocido')) && (
                      <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '99px', background: 'var(--status-anomaly-bg)', color: 'var(--status-anomaly)', fontWeight: 700 }}>ASIGNAR NOMBRE</span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.85rem' }}>{user.rfid_tag.startsWith('KEY') ? '🔑 Teclado' : '💳 Tarjeta'}</span>
                </td>
                <td>
                  <code
                    style={{
                      background: 'rgba(0,0,0,0.05)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {user.rfid_tag}
                  </code>
                </td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: user.role === 'admin' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: user.role === 'admin' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {user.role}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{formatDate(user.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onEdit(user)}
                      id={`edit-user-${user.id}`}
                    >
                      ✏️
                    </button>
                    <button
                      className={`btn btn-sm ${confirmDeleteId === user.id ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingId === user.id}
                      id={`delete-user-${user.id}`}
                    >
                      {deletingId === user.id
                        ? '...'
                        : confirmDeleteId === user.id
                          ? '¿Seguro?'
                          : '🗑️'}
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
