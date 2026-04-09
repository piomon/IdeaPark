import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

export function AuthGate({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('ideapark_admin_token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  return <>{children}</>;
}
