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
const PORT = process.env.PORT || 3003;
const IDP_URL = process.env.IDP_URL || 'http://localhost:3000';

app.use(cors({
  origin: 'http://localhost:3003',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

let cachedPublicKey = null;

// Helper to fetch public key from IdP
async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;

  console.log(`Fetching public key from IdP: ${IDP_URL}/public-key`);
  try {
    const res = await fetch(`${IDP_URL}/public-key`);
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
  const token = req.cookies.music_token;

  if (!token) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'Access token missing',
      loginUrl: `${IDP_URL}/?client_id=music&redirect_uri=http://localhost:3003/auth/callback`
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
    res.clearCookie('music_token');
    return res.status(401).json({ 
      error: 'invalid_token', 
      message: 'Access token invalid or expired',
      loginUrl: `${IDP_URL}/?client_id=music&redirect_uri=http://localhost:3003/auth/callback`
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
    console.log('Exchanging code with IdP...');
    const tokenRes = await fetch(`${IDP_URL}/oauth/token`, {
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
    res.cookie('music_token', access_token, {
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

// 2. Local logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('music_token');
  res.json({
    logoutUrl: `${IDP_URL}/logout?redirect_uri=http://localhost:3003`
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

// 4. Dynamic Tracks list based on role
app.get('/api/tracks', authenticateJWT, (req, res) => {
  const isPremium = req.user.role === 'premium';

  const tracks = [
    { id: 1, title: 'Midnight City Synth', artist: 'Neon Horizon', duration: '3:45', premiumOnly: false, locked: false },
    { id: 2, title: 'Ocean Drive Chillout', artist: 'Sunset Blvd', duration: '4:12', premiumOnly: false, locked: false },
    { id: 3, title: 'Retro Groove (Remix)', artist: 'DJ 1984', duration: '3:22', premiumOnly: false, locked: false },
    // Premium Only tracks
    { 
      id: 4, 
      title: '👑 Golden Hour Symphony', 
      artist: 'Acoustic Dreams', 
      duration: '5:01', 
      premiumOnly: true, 
      locked: !isPremium 
    },
    { 
      id: 5, 
      title: '👑 Dark Side of the Synth (FLAC)', 
      artist: 'Laser Grid', 
      duration: '6:15', 
      premiumOnly: true, 
      locked: !isPremium 
    }
  ];

  res.json(tracks);
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
    res.send('Music Service server running (Frontend dist not built yet).');
  });
}

app.listen(PORT, () => {
  console.log(`Music Service running at http://localhost:${PORT}`);
});
