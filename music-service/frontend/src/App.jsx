import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = 'http://localhost:3003';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
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
      fetchTracks();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchTracks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracks`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setTracks(data);
      }
    } catch (err) {
      console.error('Error fetching tracks:', err);
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

  const selectTrack = (track) => {
    if (track.locked) {
      setShowPaywall(true);
      return;
    }
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
        <p className="loading-text">Verifying token signature...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">🎵 MUSIC SERVICE</div>
        <div className="nav-user">
          {user && (
            <>
              <span className="user-email">{user.email}</span>
              <span className={`user-role-badge ${user.role === 'premium' ? 'role-premium' : 'role-free'}`}>
                {user.role.toUpperCase()}
              </span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <h1>Music Library</h1>
          <p className="description">
            All authenticated users can listen to basic tracks. Premium High-Fidelity tracks are restricted to Prime accounts.
          </p>
        </header>

        {error ? (
          <div className="error-card">
            <h3>Authorization Failed</h3>
            <p>{error}</p>
          </div>
        ) : (
          <div className="track-list">
            {tracks.map(track => (
              <div 
                key={track.id} 
                className={`track-row ${track.locked ? 'track-locked' : ''} ${currentTrack?.id === track.id ? 'track-active' : ''}`}
                onClick={() => selectTrack(track)}
              >
                <div className="track-play-indicator">
                  {currentTrack?.id === track.id && isPlaying ? (
                    <div className="music-bars">
                      <span></span><span></span><span></span>
                    </div>
                  ) : (
                    <span>▶</span>
                  )}
                </div>
                <div className="track-details">
                  <div className="track-title">{track.title}</div>
                  <div className="track-artist">{track.artist}</div>
                </div>
                <div className="track-duration">{track.duration}</div>
                {track.locked && <div className="track-lock-badge">PREMIUM</div>}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Dynamic Player Footer */}
      {currentTrack && (
        <footer className="player-footer">
          <div className="player-track-info">
            <span className="player-emoji">💿</span>
            <div>
              <div className="player-title">{currentTrack.title}</div>
              <div className="player-artist">{currentTrack.artist}</div>
            </div>
          </div>
          <div className="player-controls">
            <button className="ctrl-btn" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <div className="player-progress-bar">
              <div className={`progress-fill ${isPlaying ? 'animating' : ''}`}></div>
            </div>
          </div>
          <div className="player-audio-quality">
            <span className="quality-tag">AAC 256kbps</span>
          </div>
        </footer>
      )}

      {/* Custom Paywall Modal */}
      {showPaywall && (
        <div className="modal-backdrop" onClick={() => setShowPaywall(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-crown">👑</div>
            <h2>Unlock Premium High-Fidelity</h2>
            <p>
              This track is recorded in studio FLAC quality. Upgrade your central account to <strong>premium</strong> to access it.
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-secondary" onClick={() => setShowPaywall(false)}>
                Maybe Later
              </button>
              <button className="modal-btn modal-btn-primary" onClick={() => { setShowPaywall(false); alert('Redirecting to account upgrades...'); }}>
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
