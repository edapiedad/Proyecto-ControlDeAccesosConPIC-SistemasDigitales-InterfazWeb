import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
