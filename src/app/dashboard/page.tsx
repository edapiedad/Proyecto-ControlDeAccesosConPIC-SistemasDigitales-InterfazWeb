import { supabaseAdmin } from '@/lib/supabase/server';
import AccessLogsTable from '@/components/AccessLogsTable';
import { ClipboardList, CircleCheck, CircleX, TriangleAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Fetch latest 50 logs with user name joined
  const { data: logs, error } = await supabaseAdmin
    .from('access_logs')
    .select('*, users(name)')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Dashboard] Error fetching logs:', error);
  }

  // Compute summary stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { count: totalToday } = await supabaseAdmin
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', todayISO);

  const { count: grantedToday } = await supabaseAdmin
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', todayISO)
    .eq('status', 'GRANTED');

  const { count: deniedToday } = await supabaseAdmin
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', todayISO)
    .eq('status', 'DENIED');

  const { count: anomaliesToday } = await supabaseAdmin
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', todayISO)
    .eq('status', 'ANOMALY');

  const stats = [
    {
      label: 'Accesos Hoy',
      value: totalToday ?? 0,
      icon: <ClipboardList size={24} />,
      color: 'var(--accent-cyan)',
      bgColor: 'rgba(6, 182, 212, 0.12)',
    },
    {
      label: 'Concedidos',
      value: grantedToday ?? 0,
      icon: <CircleCheck size={24} />,
      color: 'var(--status-granted)',
      bgColor: 'var(--status-granted-bg)',
    },
    {
      label: 'Denegados',
      value: deniedToday ?? 0,
      icon: <CircleX size={24} />,
      color: 'var(--status-denied)',
      bgColor: 'var(--status-denied-bg)',
    },
    {
      label: 'Anomalías',
      value: anomaliesToday ?? 0,
      icon: <TriangleAlert size={24} />,
      color: 'var(--status-anomaly)',
      bgColor: 'var(--status-anomaly-bg)',
    },
  ];

  return (
    <div className="animate-in">
      {/* Page header */}
      <div className="animate-in animate-in-delay-1" style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}
        >
          Registros de Acceso
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Monitoreo en tiempo real del sistema de control de acceso IoT
        </p>
      </div>

      {/* Stats cards */}
      <div
        className="animate-in animate-in-delay-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`card stat-card`}
            style={{ padding: '24px', position: 'relative' }}
          >
            <div 
              style={{
                position: 'absolute',
                top: 0, left: 24, right: 24, height: 2,
                background: stat.color,
                opacity: 0.8,
                borderRadius: '0 0 4px 4px'
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                  }}
                >
                  {stat.label}
                </p>
                <p
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    color: stat.color,
                    lineHeight: 1,
                    letterSpacing: '-1px'
                  }}
                >
                  {stat.value}
                </p>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: stat.bgColor,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Realtime logs table */}
      <AccessLogsTable initialLogs={logs ?? []} />
    </div>
  );
}
