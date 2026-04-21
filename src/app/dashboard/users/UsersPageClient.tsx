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
  const [activeTab, setActiveTab] = useState<'actives' | 'retired'>('actives');

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

      // Obtener últimos logs para extraer tags huérfanos activos
      const { data: logsData } = await supabase
        .from('access_logs')
        .select('rfid_tag_used, status, timestamp')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (logsData) {
        // Encontrar el último FACTORY_RESET para ignorar claves anteriores
        const resetIdx = logsData.findIndex(l => l.status === 'FACTORY_RESET');
        const validLogs = resetIdx !== -1 ? logsData.slice(0, resetIdx) : logsData;

        // Determinar el último estado de cada tag
        const tagStatusMap = new Map<string, string>();
        for (const log of validLogs) {
          if (!tagStatusMap.has(log.rfid_tag_used)) {
            tagStatusMap.set(log.rfid_tag_used, log.status);
          }
        }

        // Obtener solo las claves que NO han sido eliminadas y que NO están ya registradas en la tabla 'users'
        const activeOrphanTags: string[] = [];
        const existingTags = new Set((data ?? []).map(u => u.rfid_tag));

        for (const [tag, status] of Array.from(tagStatusMap.entries())) {
          if (
            status !== 'USER_REMOVED' && 
            tag !== 'ADMIN_CTRL' && 
            tag !== 'SYSTEM' && 
            tag !== 'UNKNOWN' &&
            !existingTags.has(tag)
          ) {
            activeOrphanTags.push(tag);
          }
        }
        setOrphanedTags(activeOrphanTags);
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

  async function handleSoftRelease(userId: string) {
    try {
      // Liberar la tarjeta pero mantener el usuario
      const { error } = await supabase
        .from('users')
        .update({ rfid_tag: null })
        .eq('id', userId);

      if (error) {
        console.error('[Users] Release error:', error);
        return;
      }

      showSuccess('Credencial desvinculada del usuario. Ahora es histórica.');
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Users] Exception releasing:', err);
    }
  }

  async function handlePermanentDelete(userId: string) {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);

      if (error) {
        console.error('[Users] Permanent delete error:', error);
        return;
      }

      showSuccess('Registro eliminado permanentemente del historial');
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Users] Exception deleting permanent:', err);
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
              letterSpacing: '-0.02em'
            }}
          >
            Gestión de Personal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Administra las credenciales activas y consulta el historial de registros del sistema.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingUser(null);
          }}
          id="toggle-user-form"
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}
        >
          {showForm ? '✕ Cancelar' : 'Nuevo Usuario'}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-ghost)' }}>
        <button 
          onClick={() => setActiveTab('actives')}
          style={{
            padding: '12px 4px',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            background: 'none',
            border: 'none',
            color: activeTab === 'actives' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'actives' ? '2px solid var(--text-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'var(--transition-fast)'
          }}
        >
          PERSONAL ACTIVO
        </button>
        <button 
          onClick={() => setActiveTab('retired')}
          style={{
            padding: '12px 4px',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            background: 'none',
            border: 'none',
            color: activeTab === 'retired' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'retired' ? '2px solid var(--text-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'var(--transition-fast)'
          }}
        >
          HISTORIAL / RETIRADOS
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
          users={users.filter(u => activeTab === 'actives' ? u.rfid_tag !== null : u.rfid_tag === null)}
          onDelete={activeTab === 'actives' ? handleSoftRelease : handlePermanentDelete}
          onEdit={handleStartEdit}
          retiredView={activeTab === 'retired'}
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
