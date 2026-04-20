'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { 
  Server, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Moon, 
  Sun,
  ShieldAlert
} from 'lucide-react';

const navItems = [
  {
    href: '/dashboard',
    label: 'Registros de Acceso',
    icon: Server,
  },
  {
    href: '/dashboard/users',
    label: 'Gestión de Usuarios',
    icon: Users,
  },
  {
    href: '/dashboard/telegram',
    label: 'Usuarios Telegram',
    icon: MessageSquare,
  },
  {
    href: '/dashboard/settings',
    label: 'Ajustes',
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createBrowserClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg md:hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Logo area */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="animate-pulse-glow"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-teal))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px var(--accent-cyan-glow)'
              }}
            >
              <ShieldAlert size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                IoT Access
              </h1>
              <p
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Control Panel
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '24px 0', overflowY: 'auto' }}>
          <p
            style={{
              padding: '0 24px',
              marginBottom: '12px',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Navegación
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="icon-wrapper" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(20, 184, 166, 0.15))' : 'transparent',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
                    transition: 'all 0.2s ease',
                  }}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer with Theme Toggle & Sign Out */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {mounted && (
            <button
              onClick={toggleTheme}
              className="sidebar-link"
              style={{
                width: '100%',
                margin: 0,
                padding: '10px 12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span className="icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--text-muted)' }}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}
              </span>
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="sidebar-link"
            style={{
              width: '100%',
              margin: 0,
              padding: '10px 12px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseOver={(e) => {
               (e.currentTarget as HTMLElement).style.color = 'var(--status-denied)';
            }}
            onMouseOut={(e) => {
               (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            <span className="icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                <LogOut size={18} />
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Cerrar Sesión</span>
          </button>
          
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
              paddingLeft: '12px'
            }}
          >
            <div
              className="animate-pulse-glow"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--status-granted)',
              }}
            />
            Sistema activo
          </div>
        </div>
      </aside>
    </>
  );
}
