'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { ChevronLeft, ChevronRight, ShieldAlert, UserPlus, UserMinus, KeyRound, Trash2, Lock, Unlock, PlusCircle, MinusCircle, Activity, RefreshCcw } from 'lucide-react';

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
    ADMIN_START: { bg: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', label: 'Gestión Admin: Inicio' },
    ADMIN_END: { bg: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', label: 'Gestión Admin: Fin' },
    USER_ADDED: { bg: 'var(--status-granted-bg)', color: 'var(--status-granted)', label: 'Nuevo Usuario Vinculado' },
    USER_REMOVED: { bg: 'var(--status-denied-bg)', color: 'var(--status-denied)', label: 'Credencial Eliminada' },
    FACTORY_RESET: { bg: 'var(--status-anomaly-bg)', color: 'var(--status-anomaly)', label: 'Reseteo Total de Memoria' },
    WIFI_ON: { bg: 'rgba(20, 184, 166, 0.15)', color: 'var(--accent-teal)', label: 'Red: Conexión Restaurada' },
    WIFI_OFF: { bg: 'var(--status-denied-bg)', color: 'var(--status-denied)', label: 'Red: Conexión Perdida' },
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
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Actividad Administrativa
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Historial de eventos del modo administrador del PIC (tarjetas añadidas, eliminadas, resets)
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Credenciales Añadidas', value: stats.added, color: 'var(--status-granted)' },
          { label: 'Credenciales Eliminadas', value: stats.removed, color: 'var(--status-denied)' },
          { label: 'Sesiones Admin', value: stats.adminSessions, color: 'var(--accent-teal)' },
          { label: 'Factory Resets', value: stats.resets, color: 'var(--status-anomaly)' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: 'var(--surface-low)', padding: '24px 20px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: stat.color }} />
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      {/* Filter */}
      <div style={{ padding: '8px 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px' }}>
          Filtrar:
        </span>
        {[
          { value: 'all', label: 'Todos' },
          { value: 'USER_ADDED', label: 'Añadidos' },
          { value: 'USER_REMOVED', label: 'Eliminados' },
          { value: 'ADMIN_START', label: 'Admin ON' },
          { value: 'ADMIN_END', label: 'Admin OFF' },
          { value: 'FACTORY_RESET', label: 'Reset' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilterStatus(f.value); setCurrentPage(1); }}
            style={{
              padding: '6px 16px',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: 'none',
              background: filterStatus === f.value ? 'var(--text-primary)' : 'var(--surface-high)',
              color: filterStatus === f.value ? 'var(--surface)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'var(--surface-low)' }}>
            <div className="skeleton" style={{ height: 20, width: '60%', margin: '0 auto 12px' }} />
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--surface-low)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No events logged</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {paginatedEvents.map((event) => {
              const dateObj = new Date(event.timestamp);
              const dateStr = dateObj.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
              const timeStr = dateObj.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });
              
              const statusColors = {
                 USER_ADDED: 'var(--status-granted)',
                 USER_REMOVED: 'var(--status-denied)',
                 ADMIN_START: 'var(--text-primary)',
                 ADMIN_END: 'var(--text-muted)',
                 FACTORY_RESET: 'var(--status-anomaly)'
              };
              const pipColor = statusColors[event.status as keyof typeof statusColors] || 'var(--text-muted)';
              
              const icons = {
                 USER_ADDED: <UserPlus size={14} />,
                 USER_REMOVED: <UserMinus size={14} />,
                 ADMIN_START: <ShieldAlert size={14} />,
                 ADMIN_END: <Activity size={14} />,
                 FACTORY_RESET: <RefreshCcw size={14} />
              };
              const IconComp = icons[event.status as keyof typeof icons] || <Activity size={14} />;
              
              const textMap = {
                 USER_ADDED: 'Nueva Credencial Vinculada',
                 USER_REMOVED: 'Credencial Administrativa Revocada',
                 ADMIN_START: 'Sesión de Supervisión Iniciada',
                 ADMIN_END: 'Sesión de Supervisión Finalizada',
                 FACTORY_RESET: 'Reinicio Maestro de Nodo'
              };
              const textLabel = textMap[event.status as keyof typeof textMap] || event.status;

              return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  padding: '24px',
                  background: 'var(--surface-low)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* 1px Vertical Pip */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '2px',
                  height: '24px',
                  background: pipColor
                }} />

                {/* Date / Time */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '120px' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{timeStr}</span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '2px' }}>{dateStr}</span>
                </div>

                {/* Event Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: pipColor, display: 'flex' }}>
                       {IconComp}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                      {textLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Tag ID: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', marginLeft: '4px' }}>{event.rfid_tag_used}</span>
                  </div>
                </div>
              </div>
              );
            })}
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
