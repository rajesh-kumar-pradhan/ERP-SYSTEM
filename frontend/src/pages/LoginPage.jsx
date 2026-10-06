import { Navigate, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiError } from '../api/client.js';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (ready && user) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand-block">
          <div className="brand-mark large">IF</div>
          <div>
            <p className="eyebrow light">Manufacturing & supply ERP</p>
            <h1>IndustrialFlow</h1>
          </div>
        </div>
        <div className="login-visual-copy">
          <span className="login-kicker">Operations, connected</span>
          <h2>Keep every part of your business moving.</h2>
          <p>Bring customer demand, inventory, quotations, and fulfilment together in one clear workspace.</p>
        </div>
        <div className="login-visual-footer">
          <span className="footer-mark" aria-hidden="true">↗</span>
          <span>Clarity from first enquiry to final dispatch</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="panel-header">
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your workspace</h2>
        </div>

        {error && <div className="notice error">{error}</div>}

        <form onSubmit={submit} className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={email}
              placeholder="sales@industrialflow.local"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              placeholder="IndustrialFlow@123"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="primary-button" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-meta">
          <span>Demo user: sales@industrialflow.local</span>
          <span>Admin user: admin@industrialflow.local</span>
          <span>Password: IndustrialFlow@123</span>
        </div>
      </section>
    </main>
  );
}
