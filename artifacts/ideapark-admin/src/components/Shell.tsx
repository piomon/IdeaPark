import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { clearSession, readSessionUser } from '../lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/spaces', label: 'Miejsca' },
  { href: '/reservations', label: 'Rezerwacje' },
  { href: '/guests', label: 'Goscie' },
  { href: '/reports', label: 'Raporty' },
];

export function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [location, navigate] = useLocation();
  const userName = readSessionUser() ?? 'Administrator';

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">IP</div>
          <div>
            <div className="brand-title">IdeaPark</div>
            <div className="brand-subtitle">Admin Console</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${location === item.href ? 'nav-link-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-chip">
            <div className="profile-avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="profile-name">{userName}</div>
              <div className="profile-role">Panel operacyjny</div>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Wyloguj
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-status">
            <span className="dot" />
            Tryb pilotowy
          </div>
        </header>
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
