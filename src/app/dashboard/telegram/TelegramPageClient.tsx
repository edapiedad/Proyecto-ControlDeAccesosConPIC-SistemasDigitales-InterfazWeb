'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { TelegramAuthorizedUser } from '@/types/database';

export default function TelegramUsersPage() {
  const [users, setUsers] = useState<TelegramAuthorizedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const supabase = createBrowserClient();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('telegram_authorized_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Telegram Users] Error fetching:', error);
        setError('Error de DB al cargar: ' + error.message);
      } else {
        setUsers(data ?? []);
      }
    } catch (err: unknown) {
      console.error('[Telegram Users] Exception fetching:', err);
      // It might be a network error or adblocker
      setError('Error de conexión. ¿Puede que Brave Shields esté bloqueando Supabase?');
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const telegramId = parseInt(newTelegramId.trim(), 10);
    if (isNaN(telegramId) || telegramId <= 0) {
      setError('El ID de Telegram debe ser un número válido');
      return;
    }

    if (!newName.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('telegram_authorized_users')
        .insert({
          telegram_id: telegramId,
          name: newName.trim(),
          is_active: true,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Este ID de Telegram ya está registrado');
        } else {
          setError(insertError.message);
        }
        return;
      }

      showSuccess('✅ Usuario de Telegram autorizado exitosamente');
      setNewTelegramId('');
      setNewName('');
      setShowForm(false);
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Telegram Users] Exception insert:', err);
      setError('Error de conexión al agregar usuario.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(userId: string, currentState: boolean) {
    setError('');
    try {
      const { error } = await supabase
        .from('telegram_authorized_users')
        .update({ is_active: !currentState })
        .eq('id', userId);

      if (error) {
        setError(error.message);
        return;
      }

      showSuccess(currentState ? '🔴 Usuario desactivado' : '🟢 Usuario activado');
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Telegram Users] Exception toggle:', err);
      setError('Error de conexión al actualizar.');
    }
  }

  async function handleDelete(userId: string) {
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('telegram_authorized_users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      showSuccess('🗑️ Usuario eliminado');
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[Telegram Users] Exception delete:', err);
      setError('Error de conexión al eliminar.');
    }
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
            Usuarios de Telegram
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Gestiona quién puede usar el bot de Telegram para consultas
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          id="toggle-telegram-form"
        >
          {showForm ? '✕ Cerrar' : '+ Autorizar Usuario'}
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

      {/* Info box */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          borderLeft: '3px solid var(--accent-cyan)',
        }}
      >
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          💡 Los usuarios autorizados pueden enviar mensajes al bot de Telegram para consultar
          registros de acceso usando lenguaje natural. Para obtener el ID de Telegram de un
          usuario, pídele que escriba <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '4px' }}>/myid</code> al bot.
        </p>
      </div>

      {/* Add form */}
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
            Autorizar Nuevo Usuario
          </h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="telegram-name"
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Nombre
                </label>
                <input
                  id="telegram-name"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Juan Pérez"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label
                  htmlFor="telegram-id"
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Telegram ID
                </label>
                <input
                  id="telegram-id"
                  type="text"
                  className="form-input"
                  placeholder="Ej: 123456789"
                  value={newTelegramId}
                  onChange={(e) => setNewTelegramId(e.target.value.replace(/\D/g, ''))}
                  disabled={isSubmitting}
                  style={{ fontFamily: 'monospace' }}
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  El usuario puede obtener su ID enviando /myid al bot
                </p>
              </div>
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
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  id="submit-telegram-user"
                >
                  {isSubmitting ? 'Guardando...' : 'Autorizar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: 20, width: '60%', margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ height: 20, width: '80%', margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ height: 20, width: '70%', margin: '0 auto' }} />
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Telegram ID</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay usuarios de Telegram autorizados
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {user.name}
                    </td>
                    <td>
                      <code
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                        }}
                      >
                        {user.telegram_id}
                      </code>
                    </td>
                    <td>
                      <span
                        className={`badge ${user.is_active ? 'badge-granted' : 'badge-denied'}`}
                      >
                        {user.is_active ? '🟢 Activo' : '🔴 Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {new Date(user.created_at).toLocaleDateString('es-VE', {
                        timeZone: 'America/Caracas',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleActive(user.id, user.is_active)}
                          title={user.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {user.is_active ? '🔴 Desactivar' : '🟢 Activar'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(user.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p
        style={{
          marginTop: '12px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'right',
        }}
      >
        {users.length} usuarios de Telegram registrados
      </p>
    </div>
  );
}
