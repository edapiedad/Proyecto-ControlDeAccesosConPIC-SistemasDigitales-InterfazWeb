'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { ChevronLeft, ChevronRight, ShieldAlert, UserPlus, UserMinus, KeyRound, Trash2 } from 'lucide-react';

interface AdminEvent {
  id: string;
  rfid_tag_used: string;
  timestamp: string;
  status: string;
  users?: { name: string } | null;
}

const ADMIN_STATUSES = ['ADMIN_START', 'ADMIN_END', 'USER_ADDED', 'USER_REMOVED', 'FACTORY_RESET'];
const ITEMS_PER_PAGE = 10;

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function EventIcon({ status }: { status: string }) {
  const iconProps = { size: 18, strokeWidth: 2 };
  switch (status) {
    case 'ADMIN_START':
    case 'ADMIN_END':
      return <KeyRound {...iconProps} />;
    case 'USER_ADDED':
      return <UserPlus {...iconProps} />;
    case 'USER_REMOVED':
      return <UserMinus {...iconProps} />;
    case 'FACTORY_RESET':
      return <Trash2 {...iconProps} />;
    default:
      return <ShieldAlert {...iconProps} />;
  }
}

function EventBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    ADMIN_START: { bg: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', label: '🔐 Modo Admin ON' },
    ADMIN_END: { bg: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', label: '🔓 Modo Admin OFF' },
    USER_ADDED: { bg: 'var(--status-granted-bg)', color: 'var(--status-granted)', label: '➕ Credencial Añadida' },
    USER_REMOVED: { bg: 'var(--status-denied-bg)', color: 'var(--status-denied)', label: '➖ Credencial Eliminada' },
    FACTORY_RESET: { bg: 'var(--status-anomaly-bg)', color: 'var(--status-anomaly)', label: '🗑️ Factory Reset' },
  };

  const c = config[status] || { bg: '#333', color: '#fff', label: status };

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '99px',
      fontSize: '0.72rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      background: c.bg,
      color: c.color,
    }}>
      {c.label}
    </span>
  );
}

export default function AdminActivityClient() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const supabase = createBrowserClient();

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('id, rfid_tag_used, timestamp, status, users(name)')
        .in('status', ADMIN_STATUSES)
        .order('timestamp', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[AdminActivity] Fetch error:', error);
      } else {
        setEvents((data as unknown as AdminEvent[]) ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription for admin events
  useEffect(() => {
    const channel = supabase
      .channel('admin-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_logs' },
        (payload) => {
          const newEvent = payload.new as AdminEvent;
          if (ADMIN_STATUSES.includes(newEvent.status)) {
            setEvents((prev) => [newEvent, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Filter and paginate
  const filteredEvents = filterStatus === 'all'
    ? events
    : events.filter((e) => e.status === filterStatus);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats
  const stats = {
    added: events.filter(e => e.status === 'USER_ADDED').length,
    removed: events.filter(e => e.status === 'USER_REMOVED').length,
    adminSessions: events.filter(e => e.status === 'ADMIN_START').length,
    resets: events.filter(e => e.status === 'FACTORY_RESET').length,
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={28} />
          Actividad Administrativa
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Historial de eventos del modo administrador del PIC (tarjetas añadidas, eliminadas, resets)
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Credenciales Añadidas', value: stats.added, color: 'var(--status-granted)' },
          { label: 'Credenciales Eliminadas', value: stats.removed, color: 'var(--status-denied)' },
          { label: 'Sesiones Admin', value: stats.adminSessions, color: 'var(--accent-cyan)' },
          { label: 'Factory Resets', value: stats.resets, color: 'var(--status-anomaly)' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar:</span>
        {[
          { value: 'all', label: 'Todos' },
          { value: 'USER_ADDED', label: '➕ Añadidos' },
          { value: 'USER_REMOVED', label: '➖ Eliminados' },
          { value: 'ADMIN_START', label: '🔐 Admin ON' },
          { value: 'ADMIN_END', label: '🔓 Admin OFF' },
          { value: 'FACTORY_RESET', label: '🗑️ Reset' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilterStatus(f.value); setCurrentPage(1); }}
            style={{
              padding: '6px 14px',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px solid',
              borderColor: filterStatus === f.value ? 'var(--accent-cyan)' : 'var(--border-subtle)',
              background: filterStatus === f.value ? 'var(--accent-cyan-glow)' : 'transparent',
              color: filterStatus === f.value ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="skeleton" style={{ height: 20, width: '60%', margin: '0 auto 12px' }} />
            <div className="skeleton" style={{ height: 20, width: '80%', margin: '0 auto 12px' }} />
            <div className="skeleton" style={{ height: 20, width: '70%', margin: '0 auto' }} />
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <ShieldAlert size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay eventos administrativos registrados</p>
          </div>
        ) : (
          <div>
            {paginatedEvents.map((event, idx) => (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  borderBottom: idx < paginatedEvents.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'var(--transition-fast)',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: event.status === 'USER_ADDED' ? 'var(--status-granted-bg)'
                    : event.status === 'USER_REMOVED' ? 'var(--status-denied-bg)'
                    : event.status === 'FACTORY_RESET' ? 'var(--status-anomaly-bg)'
                    : 'rgba(6, 182, 212, 0.15)',
                  color: event.status === 'USER_ADDED' ? 'var(--status-granted)'
                    : event.status === 'USER_REMOVED' ? 'var(--status-denied)'
                    : event.status === 'FACTORY_RESET' ? 'var(--status-anomaly)'
                    : 'var(--accent-cyan)',
                  flexShrink: 0,
                }}>
                  <EventIcon status={event.status} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <EventBadge status={event.status} />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Credencial: <code style={{ fontSize: '0.75rem', background: 'var(--border-subtle)', padding: '2px 6px', borderRadius: '4px' }}>{event.rfid_tag_used}</code>
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                  {formatTimestamp(event.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '16px',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.4 : 1,
                fontSize: '0.8rem',
              }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.4 : 1,
                fontSize: '0.8rem',
              }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <p style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
        {filteredEvents.length} eventos administrativos
      </p>
    </div>
  );
}
