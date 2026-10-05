import React from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AppShell() {
  const { user, ready, logout } = useAuth();

  if (!ready) return <div className="screen-center">Loading IndustrialFlow…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const roleLabel = user.role === 'ADMIN' ? 'Administrator' : 'Sales user';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">IF</span>
          <span>
            IndustrialFlow
            <small>ERP</small>
          </span>
        </div>

        <nav>
          <NavLink to="/enquiries">Enquiries</NavLink>
          <NavLink to="/quotations">Quotations</NavLink>
          <NavLink to="/orders">Sales orders</NavLink>
          <NavLink to="/inventory">Inventory</NavLink>
        </nav>

        <div className="account">
          <strong>{user.name}</strong>
          <span>{roleLabel}</span>
          <button className="link-button" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

