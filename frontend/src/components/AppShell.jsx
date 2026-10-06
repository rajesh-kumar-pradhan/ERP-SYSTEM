import React from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AppShell() {
  const { user, ready, logout } = useAuth();

  if (!ready) return <div className="screen-center">Loading IndustrialFlow…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = user.role === 'ADMIN';
  const roleLabel = isAdmin ? 'Administrator' : 'Sales user';
  const navItems = [
    { to: '/dashboard', label: 'Overview' },
    { to: '/enquiries', label: 'Enquiries' },
    { to: '/quotations', label: 'Quotations' },
    { to: '/orders', label: isAdmin ? 'Order control' : 'Sales orders' },
    { to: '/inventory', label: isAdmin ? 'Stock control' : 'Inventory availability' },
  ];
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className={`app-shell ${isAdmin ? 'role-admin' : 'role-sales'}`}>
      <aside className="sidebar">
        <Link className="brand-block" to="/dashboard" aria-label="IndustrialFlow home">
          <div className="brand-mark">IF</div>
          <div className="brand-copy">
            <strong>IndustrialFlow</strong>
            <small>Manufacturing ERP</small>
          </div>
        </Link>

        <p className="workspace-label">{isAdmin ? 'OPERATIONS CONTROL' : 'COMMERCIAL WORKSPACE'}</p>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>
          <button className="link-button" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">{isAdmin ? 'ADMINISTRATION' : 'SALES DESK'}</span>
            <h2>{isAdmin ? 'Operations control' : 'Commercial workspace'}</h2>
          </div>

          <div className="topbar-actions">
            <span className="status-pill live">Live</span>
            <div className="user-chip">
              <div className="avatar small">{initials}</div>
              <div>
                <strong>{user.name}</strong>
                <small>{roleLabel}</small>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

