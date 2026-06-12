import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [primeData, setPrimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = 'http://localhost:3002';

  useEffect(() => {
    fetchProfileAndContent();
  }, []);

  const fetchProfileAndContent = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        if (data.loginUrl) {
          window.location.href = data.loginUrl;
          return;
        }
        throw new Error(data.message || 'Failed to authenticate');
      }

      setUser(data);
      
      // Attempt to load prime content
      const contentRes = await fetch(`${API_BASE}/api/prime-content`, { credentials: 'include' });
      const contentData = await contentRes.json();

      if (contentRes.status === 403) {
        setForbidden(true);
      } else if (!contentRes.ok) {
        throw new Error(contentData.message || 'Failed to fetch prime content');
      } else {
        setPrimeData(contentData);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.logoutUrl) {
        window.location.href = data.logoutUrl;
      }
    } catch (err) {
      console.error('Logout error:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
        <p className="loading-text">Verifying security credentials...</p>
      </div>
    );
  }

  // 1. Forbidden state: User logged in but is 'free', show lock screen
  if (forbidden) {
    return (
      <div className="app-container gate-bg">
        <nav className="navbar">
          <div className="nav-brand">👑 PRIME SERVICE</div>
          <div className="nav-user">
            {user && (
              <>
                <span className="user-email">{user.email}</span>
                <span className="user-role-badge role-free">FREE MEMBER</span>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>
        </nav>

        <main className="gate-main">
          <div className="gate-card">
            <div className="lock-icon">🔒</div>
            <h1>Premium Access Required</h1>
            <p className="gate-subtitle">This exclusive dashboard is reserved for Prime subscribers.</p>
            
            <div className="account-details">
              <p>Logged in as: <strong>{user?.email}</strong></p>
              <p>Current Authorization level: <span className="text-free">FREE</span></p>
            </div>

            <div className="paywall-pitch">
              <h3>Upgrade to Prime to unlock:</h3>
              <ul>
                <li>✨ Unlimited UHD Video Streaming</li>
                <li>📦 Zero-cost express delivery on Shopping</li>
                <li>🎧 Exclusive Hi-Res audio tracks on Music</li>
              </ul>
            </div>

            <button className="upgrade-btn" onClick={() => alert('Upgrade flow placeholder')}>
              Upgrade to Premium
            </button>
          </div>
        </main>
        
        <footer className="footer">
          <p>Unified Auth Demo • Prime Service (Port 3002)</p>
        </footer>
      </div>
    );
  }

  // 2. Allowed state: Premium user dashboard
  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">👑 PRIME SERVICE</div>
        <div className="nav-user">
          {user && (
            <>
              <span className="user-email">{user.email}</span>
              <span className="user-role-badge role-premium">PRIME MEMBER</span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        <header className="page-header">
          <div className="welcome-banner">Welcome back, Prime Member</div>
          <h1>{primeData?.title || 'Prime Dashboard'}</h1>
          <p className="description">
            Distributed authorization verified. You are authorized to access premium movies and exclusive deals.
          </p>
        </header>

        <div className="prime-grid">
          {/* Movies Section */}
          <section className="prime-section">
            <h2>Featured Prime Movies</h2>
            <div className="movie-list">
              {primeData?.featuredMovies?.map(movie => (
                <div key={movie.id} className="movie-card">
                  <div className="movie-thumbnail">🎬</div>
                  <div className="movie-details">
                    <h3>{movie.title}</h3>
                    <div className="movie-meta">
                      <span>{movie.duration}</span>
                      <span className="rating-badge">{movie.rating}</span>
                    </div>
                  </div>
                  <button className="play-btn">Play Now</button>
                </div>
              ))}
            </div>
          </section>

          {/* Deals Section */}
          <section className="prime-section">
            <h2>Exclusive Member Deals</h2>
            <div className="deals-list">
              {primeData?.premiumDeals?.map((deal, idx) => (
                <div key={idx} className="deal-card">
                  <div className="deal-badge">{deal.discount}</div>
                  <h3>{deal.item}</h3>
                  <div className="promo-code">
                    Code: <code>{deal.code}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <p>Unified Auth Demo • Prime Service (Port 3002)</p>
      </footer>
    </div>
  );
}

export default App;
