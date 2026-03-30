import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main
          className="main-content"
          style={{
            flex: 1,
            marginLeft: 260,
            padding: '32px',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
