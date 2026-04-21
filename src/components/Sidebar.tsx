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
    href: '/dashboard/admin-activity',
    label: 'Actividad Admin',
    icon: ShieldAlert,
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
            padding: '28px 24px',
            background: 'var(--bg-primary)', /* Sidebar header gets deepest background */
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 24,
                height: 24,
                background: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary)',
                fontWeight: 900,
                fontSize: '14px',
              }}
            >
              <div style={{ width: 8, height: 8, background: 'var(--bg-primary)', borderRadius: '50%' }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  textTransform: 'uppercase'
                }}
              >
                Onyx Access
              </h1>
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
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    transition: 'color 0.2s ease',
                  }}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>{item.label}</span>
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
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--text-muted)' }}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </span>
              <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                Theme Toggle
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
               (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseOut={(e) => {
               (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--text-muted)' }}>
              <LogOut size={18} />
            </span>
            <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Sign Out</span>
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
