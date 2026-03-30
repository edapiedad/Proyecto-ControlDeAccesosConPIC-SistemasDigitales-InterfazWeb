'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          router.replace('/login');
        } else {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Error checking auth:', err);
        router.replace('/login');
      }
    };

    checkAuth();

    // Escuchar si el usuario cierra la sesión manualmente para patearlo al login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.replace('/login');
        } else if (session) {
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, router]);

  // Mientras verificamos (1-2 ms), no mostramos el contenido confidencial del dashboard
  if (!isAuthenticated) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }}></div>
    </div>
  );

  return <>{children}</>;
}
