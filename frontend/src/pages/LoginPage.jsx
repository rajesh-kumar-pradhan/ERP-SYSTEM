import { Navigate, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiError } from '../api/client.js';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('sales@industrialflow.local');
  const [password, setPassword] = useState('IndustrialFlow@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (ready && user) return <Navigate to="/enquiries" replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/enquiries');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">IF</span>
          <div>
            <h1>IndustrialFlow</h1>
            <p>ERP</p>
          </div>
        </div>

        <h2>Sign in</h2>
        {error && <div className="notice error">{error}</div>}

        <form onSubmit={submit} className="form-grid">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <button className="primary-button" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-tip">
          Demo user: sales@industrialflow.local
          <br />
          Password: IndustrialFlow@123
        </p>
      </section>
    </main>
  );
}
