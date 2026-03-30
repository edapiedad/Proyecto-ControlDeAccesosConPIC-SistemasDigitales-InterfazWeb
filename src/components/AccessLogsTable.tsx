'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

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
  };

  const labels: Record<string, string> = {
    GRANTED: '✅ Concedido',
    DENIED: '❌ Denegado',
    ANOMALY: '⚠️ Anomalía',
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

  const handleNewLog = useCallback((payload: { new: AccessLogWithUser }) => {
    const newLog = payload.new;
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
    setNewLogIds((prev) => new Set(prev).add(newLog.id));

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
            prev.map((log) => (log.id === updated.id ? updated : log))
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

  const filteredLogs = filterStatus === 'all' ? logs : logs.filter((l) => l.status === filterStatus);

  return (
    <div>
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
              id={`filter-${status.toLowerCase()}`}
              onClick={() => setFilterStatus(status)}
              className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
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
            gap: '6px',
            fontSize: '0.75rem',
            color: isConnected ? 'var(--status-granted)' : 'var(--text-muted)',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? 'var(--status-granted)' : 'var(--text-muted)',
              boxShadow: isConnected ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none',
              transition: 'all 300ms',
            }}
          />
          {isConnected ? 'Tiempo real activo' : 'Conectando...'}
        </div>
      </div>

      {/* Table */}
      <div
        className="glass-card"
        style={{ overflow: 'auto', maxHeight: 'calc(100vh - 240px)' }}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Tag RFID</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No hay registros {filterStatus !== 'all' ? `con estado "${filterStatus}"` : ''}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className={newLogIds.has(log.id) ? 'new-row' : ''}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td style={{ color: log.users?.name ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: log.users?.name ? 500 : 400 }}>
                    {log.users?.name || '— Desconocido —'}
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
                      {log.rfid_tag_used}
                    </code>
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

      <p
        style={{
          marginTop: '12px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'right',
        }}
      >
        Mostrando {filteredLogs.length} registros
      </p>
    </div>
  );
}
