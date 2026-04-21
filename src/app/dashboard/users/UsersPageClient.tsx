'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import UserForm from '@/components/UserForm';
import UsersTable from '@/components/UsersTable';
import type { User } from '@/types/database';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orphanedTags, setOrphanedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const supabase = createBrowserClient();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Users] Error fetching:', error);
      } else {
        setUsers(data ?? []);
      }

      // Fetch orphan tags (from access logs without users)
      const { data: tagsData } = await supabase
        .from('access_logs')
        .select('rfid_tag_used')
        .is('user_id', null)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (tagsData) {
        const uniqueTags = Array.from(new Set(tagsData.map(t => t.rfid_tag_used)));
        setOrphanedTags(uniqueTags);
      }
    } catch (err: unknown) {
      console.error('[Users] Exception fetching:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  }

  async function handleCreate(data: { name: string; rfid_tag: string; role: string }) {
    try {
      const { error } = await supabase.from('users').insert(data);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este tag RFID ya está registrado');
        }
        throw new Error(error.message);
      }

      showSuccess('Usuario registrado exitosamente');
      setShowForm(false);
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Users] Exception creating:', err);
      throw err;
    }
  }

  async function handleEdit(data: { name: string; rfid_tag: string; role: string }) {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', editingUser.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este tag RFID ya está registrado por otro usuario');
        }
        throw new Error(error.message);
      }

      // Reconciliar logs huérfanos: vincular registros con el mismo rfid_tag pero sin user_id
      await supabase
        .from('access_logs')
        .update({ user_id: editingUser.id })
        .eq('rfid_tag_used', data.rfid_tag)
        .is('user_id', null);

      showSuccess('Usuario actualizado exitosamente');
      setEditingUser(null);
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Users] Exception editing:', err);
      throw err;
    }
  }

  async function handleDelete(userId: string) {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);

      if (error) {
        console.error('[Users] Delete error:', error);
        return;
      }

      showSuccess('Usuario eliminado');
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Users] Exception deleting:', err);
    }
  }

  function handleStartEdit(user: User) {
    setEditingUser(user);
    setShowForm(false);
  }

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}
          >
            Gestión de Usuarios
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Registra, edita y elimina usuarios del sistema de control de acceso
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingUser(null);
          }}
          id="toggle-user-form"
        >
          {showForm ? (
            '✕ Cerrar'
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo Usuario
            </>
          )}
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div
          className="animate-slide-in-up"
          style={{
            padding: '12px 16px',
            background: 'var(--status-granted-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: 'var(--status-granted)',
            fontSize: '0.85rem',
            marginBottom: '20px',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* New user form */}
      {showForm && (
        <div
          className="glass-card animate-slide-in-up"
          style={{ padding: '24px', marginBottom: '24px' }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}
          >
            Registrar Nuevo Usuario
          </h2>
          <UserForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            availableTags={orphanedTags}
          />
        </div>
      )}

      {/* Edit user form */}
      {editingUser && (
        <div
          className="glass-card animate-slide-in-up"
          style={{ padding: '24px', marginBottom: '24px' }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}
          >
            Editar Usuario: {editingUser.name}
          </h2>
          <UserForm
            onSubmit={handleEdit}
            initialData={editingUser}
            submitLabel="Guardar Cambios"
            onCancel={() => setEditingUser(null)}
            availableTags={orphanedTags}
          />
        </div>
      )}

      {/* Users table */}
      {isLoading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: 20, width: '60%', margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ height: 20, width: '80%', margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ height: 20, width: '70%', margin: '0 auto' }} />
        </div>
      ) : (
        <UsersTable
          users={users}
          onDelete={handleDelete}
          onEdit={handleStartEdit}
        />
      )}

      <p
        style={{
          marginTop: '12px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'right',
        }}
      >
        {users.length} usuarios registrados
      </p>
    </div>
  );
}
