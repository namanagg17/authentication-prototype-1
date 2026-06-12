import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE = 'http://localhost:3001';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        // Not authenticated, redirect to central login
        if (data.loginUrl) {
          window.location.href = data.loginUrl;
          return;
        }
        throw new Error(data.message || 'Failed to authenticate');
      }

      setUser(data);
      fetchProducts();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/products`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
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
        <p className="loading-text">Loading secure store data...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">🛒 SHOPPING SERVICE</div>
        <div className="nav-user">
          {user && (
            <>
              <span className="user-email">{user.email}</span>
              <span className="user-role-badge">{user.role.toUpperCase()}</span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        <header className="page-header">
          <h1>Product Catalog</h1>
          <p className="description">
            All authenticated users are authorized to browse products here.
          </p>
        </header>

        {error ? (
          <div className="error-card">
            <h3>Authorization Required</h3>
            <p>{error}</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                <div className="category-tag">{product.category}</div>
                <h3>{product.name}</h3>
                <div className="price-tag">${product.price.toFixed(2)}</div>
                <button className="buy-btn">Add to Cart</button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Unified Auth Demo • Shopping Service (Port 3001)</p>
      </footer>
    </div>
  );
}

export default App;
