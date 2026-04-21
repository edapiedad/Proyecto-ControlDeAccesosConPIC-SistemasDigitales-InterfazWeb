'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Extended type for access logs with joined user data
interface AccessLogWithUser {
  id: string;
  user_id: string | null;
  rfid_tag_used: string;
  timestamp: string;
  status: string;
  users?: { name: string } | null;
}

interface AccessLogsTableProps {
  initialLogs: AccessLogWithUser[];
}

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

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    GRANTED: 'badge badge-granted',
    DENIED: 'badge badge-denied',
    ANOMALY: 'badge badge-anomaly',
    ADMIN_START: 'badge badge-admin',
    ADMIN_END: 'badge badge-admin',
    USER_ADDED: 'badge badge-granted',
    USER_REMOVED: 'badge badge-denied',
    FACTORY_RESET: 'badge badge-anomaly',
  };

  const labels: Record<string, string> = {
    GRANTED: '✅ Concedido',
    DENIED: '❌ Denegado',
    ANOMALY: '⚠️ Anomalía',
    ADMIN_START: '🔐 Admin ON',
    ADMIN_END: '🔓 Admin OFF',
    USER_ADDED: '➕ Añadido',
    USER_REMOVED: '➖ Eliminado',
    FACTORY_RESET: '🗑️ Reset',
  };

  return (
    <span className={classes[status] || 'badge'}>
      {labels[status] || status}
    </span>
  );
}

export default function AccessLogsTable({ initialLogs }: AccessLogsTableProps) {
  const [logs, setLogs] = useState<AccessLogWithUser[]>(initialLogs);
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(false);
  
  // Pagination Status
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleNewLog = useCallback((payload: { new: AccessLogWithUser }) => {
    const newLog = payload.new;
    setLogs((prev) => {
      // Avoid inserting duplicate IDs
      if (prev.some((log) => log.id === newLog.id)) return prev;
      return [newLog, ...prev];
    });
    setNewLogIds((prev) => new Set(prev).add(newLog.id));

    // Si estás en la primera página, empujamos a la vista
    // de lo contrario se añadirá pero no se forzará salto.
    
    // Remove "new" highlight after animation
    setTimeout(() => {
      setNewLogIds((prev) => {
        const next = new Set(prev);
        next.delete(newLog.id);
        return next;
      });
    }, 3000);
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel('access-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'access_logs',
        },
        (payload) => {
           // We might not get the user relation instantly, so it falls back to "Desconocido"
          handleNewLog(payload as unknown as { new: AccessLogWithUser });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'access_logs',
        },
        (payload) => {
          const updated = payload.new as AccessLogWithUser;
          setLogs((prev) =>
            prev.map((log) => (log.id === updated.id ? { ...log, ...updated } : log))
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleNewLog]);

  // Derived filtered state
  const filteredLogs = filterStatus === 'all' ? logs : logs.filter((l) => l.status === filterStatus);

  // Derived pagination variables
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedLogs = filteredLogs.slice(
    (validCurrentPage - 1) * ITEMS_PER_PAGE,
    validCurrentPage * ITEMS_PER_PAGE
  );

  // Resets to page 1 whenever filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  return (
    <div className="animate-in animate-in-delay-3">
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Status filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'GRANTED', 'DENIED', 'ANOMALY'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                background: filterStatus === status ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-teal))' : 'transparent',
                border: filterStatus === status ? 'none' : '1px solid var(--border-medium)',
                color: filterStatus === status ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: filterStatus === status ? 700 : 500,
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {status === 'all' ? 'Todos' : status}
            </button>
          ))}
        </div>

        {/* Realtime connection indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isConnected ? 'var(--status-granted)' : 'var(--text-muted)',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? 'var(--status-granted)' : 'var(--text-muted)',
              boxShadow: isConnected ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
              transition: 'all 300ms',
            }}
          />
          {isConnected ? 'Tiempo real' : 'Conectando...'}
        </div>
      </div>

      {/* Table Card */}
      <div
        className="card"
        style={{ overflow: 'hidden' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Credencial</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    No hay registros {filterStatus !== 'all' ? `con estado "${filterStatus}"` : ''}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className={newLogIds.has(log.id) ? 'new-row animate-pulse-glow' : ''} style={{ transition: 'background-color 2s ease' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td style={{ color: log.users?.name ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: log.users?.name ? 600 : 400 }}>
                      {log.users?.name || '— Sin asignar —'}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem' }}>{log.rfid_tag_used.startsWith('KEY') ? '🔑' : '💳'}</span>
                        <code
                          style={{
                            background: 'rgba(15, 23, 42, 0.05)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {log.rfid_tag_used}
                        </code>
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(0,0,0,0.01)'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Mostrando pág {validCurrentPage} de {totalPages} ({filteredLogs.length} totales)
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="btn btn-secondary"
              style={{ padding: '6px 12px' }}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="btn btn-secondary"
              style={{ padding: '6px 12px' }}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

      <style jsx>{`
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .badge-granted { background: var(--status-granted-bg); color: var(--status-granted); }
        .badge-denied { background: var(--status-denied-bg); color: var(--status-denied); }
        .badge-anomaly { background: var(--status-anomaly-bg); color: var(--status-anomaly); }
        .badge-admin { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
        .new-row { background: rgba(6, 182, 212, 0.1) !important; }
        .dark .new-row { background: rgba(6, 182, 212, 0.15) !important; }
      `}</style>
    </div>
  );
}
