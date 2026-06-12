import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const IDP_INTERNAL_URL =
  process.env.IDP_INTERNAL_URL || 'http://localhost:3000';

const IDP_PUBLIC_URL =
  process.env.IDP_PUBLIC_URL || 'http://localhost:3000';

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

let cachedPublicKey = null;

// Helper to fetch the IdP's public key
async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;

  console.log(`Fetching public key from IdP: ${IDP_INTERNAL_URL}/public-key`);
  try {
    const res = await fetch(`${IDP_INTERNAL_URL}/public-key`);
    if (!res.ok) {
      throw new Error(`Failed to fetch public key, status: ${res.status}`);
    }
    const key = await res.text();
    cachedPublicKey = key;
    console.log('Public key fetched and cached successfully.');
    return cachedPublicKey;
  } catch (err) {
    console.error('Error fetching public key from IdP:', err.message);
    throw err;
  }
}

// Middleware: Validate JWT from local HTTP-Only Cookie
const authenticateJWT = async (req, res, next) => {
  const token = req.cookies.shopping_token;

  if (!token) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'Access token missing',
      loginUrl: `${IDP_PUBLIC_URL}/?client_id=shopping&redirect_uri=http://localhost:3001/auth/callback`
    });
  }

  try {
    const publicKey = await getPublicKey();
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'central-idp',
      audience: 'all-services'
    });

    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification failed:', err.message);
    res.clearCookie('shopping_token');
    return res.status(401).json({ 
      error: 'invalid_token', 
      message: 'Access token invalid or expired',
      loginUrl: `${IDP_PUBLIC_URL}/?client_id=shopping&redirect_uri=http://localhost:3001/auth/callback`
    });
  }
};

// 1. OIDC callback: Exchange code for token
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }

  try {
    // Server-to-server request to exchange code for tokens
    console.log('Exchanging code with IdP...');
    const tokenRes = await fetch(`${IDP_INTERNAL_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || 'Token exchange failed');
    }

    const { access_token } = tokenData;

    // Set the access token in an HTTP-only cookie
    res.cookie('shopping_token', access_token, {
      httpOnly: true,
      secure: false, // set to true if HTTPS
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    console.log('Token successfully exchanged and cookie set.');
    res.redirect('/');
  } catch (err) {
    console.error('Error exchanging authorization code:', err.message);
    res.status(500).send(`Authentication Error: ${err.message}`);
  }
});

// 2. Local logout: Clear service cookie and redirect to central logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('shopping_token');
  res.json({
    logoutUrl: `${IDP_PUBLIC_URL}/logout?redirect_uri=http://localhost:3001`
  });
});

// 3. Authenticated profile endpoint
app.get('/api/me', authenticateJWT, (req, res) => {
  res.json({
    email: req.user.email,
    role: req.user.role,
    sub: req.user.sub
  });
});

// 4. Products Endpoint (all authenticated users allowed)
app.get('/api/products', authenticateJWT, (req, res) => {
  res.json([
    { id: 1, name: 'Minimalist Mech Keyboard', price: 129.99, category: 'Electronics' },
    { id: 2, name: 'Active Noise Cancelling Buds', price: 199.99, category: 'Electronics' },
    { id: 3, name: 'Ergonomic Mesh Desk Chair', price: 349.99, category: 'Office' }
  ]);
});

// Serve frontend build files in production mode
const distPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Shopping Service server running (Frontend dist not built yet).');
  });
}

app.listen(PORT, () => {
  console.log(`Shopping Service running at http://localhost:${PORT}`);
});
