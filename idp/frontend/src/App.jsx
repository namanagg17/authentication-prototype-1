import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Parse query params for OIDC redirection flow
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';

  // API Base URL
  const API_BASE = 'http://localhost:3000';

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/check-session?redirect_uri=${encodeURIComponent(redirectUri)}`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.authenticated) {
        setUser(data.user);
        // If there's an authorization code and redirect_uri, redirect immediately (SSO)
        if (data.code && redirectUri) {
          console.log('Active session found. Redirecting back to service with auth code...');
          window.location.href = `${redirectUri}?code=${data.code}`;
          return;
        }
      }
    } catch (err) {
      console.error('Error checking session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, redirect_uri: redirectUri }),
        credentials: 'include'
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Successful login
      setUser(data.user);
      if (data.code && redirectUri) {
        window.location.href = `${redirectUri}?code=${data.code}`;
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/logout`, { credentials: 'include' });
      setUser(null);
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
        <p className="loading-text">Establishing Secure Connection...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="auth-header">
        <div className="logo-badge">CENTRAL IDP</div>
        <h1>Unified Authentication Portal</h1>
        <p className="subtitle">Prototype 1 • Secure Single Sign-On</p>
      </header>

      {user ? (
        <div className="card profile-card">
          <div className="status-indicator active">SSO Active</div>
          <h2>Session Established</h2>
          
          <div className="user-info">
            <div className="info-row">
              <span className="label">Identity (Subject)</span>
              <span className="value">{user.id || 'N/A'}</span>
            </div>
            <div className="info-row">
              <span className="label">Email Address</span>
              <span className="value font-highlight">{user.email}</span>
            </div>
            <div className="info-row">
              <span className="label">Assigned Role</span>
              <span className="value role-badge" data-role={user.role}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>

          <p className="helper-text">
            You are securely logged into the central network. Navigating to any registered service will sign you in automatically.
          </p>

          <button className="btn btn-secondary" onClick={handleLogout}>
            Terminate All Sessions (Logout)
          </button>
        </div>
      ) : (
        <div className="card login-card">
          {clientId && (
            <div className="client-banner">
              Authenticating access request for <strong className="client-name">{clientId.toUpperCase()}</strong>
            </div>
          )}
          
          <h2>Sign In</h2>
          <p className="card-subtitle">Enter your centralized credentials</p>

          {error && <div className="error-alert">{error}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="e.g. premium@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Verify Credentials
            </button>
          </form>

          <div className="credentials-tip">
            <p><strong>Demo Accounts:</strong></p>
            <ul>
              <li>Premium user: <code>premium@email.com</code> / <code>password123</code></li>
              <li>Free user: <code>free@email.com</code> / <code>password123</code></li>
            </ul>
          </div>
        </div>
      )}
      
      <footer className="portal-footer">
        <p>Central Identity Provider • Distributed Authorization Protocol</p>
      </footer>
    </div>
  );
}

export default App;
