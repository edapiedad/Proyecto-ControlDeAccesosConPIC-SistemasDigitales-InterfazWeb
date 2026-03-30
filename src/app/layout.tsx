import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IoT Access Control — Dashboard',
  description: 'Sistema de control de acceso IoT con IA para detección de anomalías y gestión de usuarios RFID.',
  keywords: ['IoT', 'access control', 'RFID', 'security', 'dashboard'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
