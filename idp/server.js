import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { initializeDatabase } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend clients
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 1. RSA Key Pair Setup for token signing (RS256)
let privateKey;
let publicKey;

function loadOrGenerateKeys() {
  const keysDir = path.join(__dirname, 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  const privateKeyPath = path.join(keysDir, 'private.pem');
  const publicKeyPath = path.join(keysDir, 'public.pem');

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log('Loading existing RSA key pair...');
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    publicKey = fs.readFileSync(publicKeyPath, 'utf8');
  } else {
    console.log('Keys do not exist. Generating 2048-bit RSA key pair...');
    const keys = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log('RSA key pair generated and saved to idp/keys/');
  }
}

// 2. Memory Stores for OIDC Flows
const authCodes = new Map(); // code -> { userId, email, role, expiresAt }

// 3. Database Pool
let dbPool;

// Start Server
async function startServer() {
  loadOrGenerateKeys();
  
  try {
    dbPool = await initializeDatabase();
  } catch (err) {
    console.error('Failed to initialize database. Server starting without database capabilities. Retrying on requests...', err);
  }

  app.listen(PORT, () => {
    console.log(`Identity Provider running at http://localhost:${PORT}`);
  });
}

// Middleware to ensure DB pool is available
const checkDb = (req, res, next) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'database_unavailable', error_description: 'Database is still initializing' });
  }
  next();
};

// 4. API Endpoints

// Expose public key for signature validation
app.get('/public-key', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(publicKey);
});

// Check if there is an active session
app.get('/api/check-session', checkDb, async (req, res) => {
  const { idp_session } = req.cookies;
  if (!idp_session) {
    return res.json({ authenticated: false });
  }

  try {
    const result = await dbPool.query(
      `SELECT s.id, s.user_id, u.email, u.role, s.expires_at 
       FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.refresh_token = $1`,
      [idp_session]
    );

    if (result.rowCount === 0) {
      res.clearCookie('idp_session');
      return res.json({ authenticated: false });
    }

    const session = result.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      // Session expired, delete it
      await dbPool.query('DELETE FROM sessions WHERE id = $1', [session.id]);
      res.clearCookie('idp_session');
      return res.json({ authenticated: false });
    }

    // Session is valid, generate authorization code for redirection if client requested
    const { redirect_uri } = req.query;
    let code = null;
    if (redirect_uri) {
      code = crypto.randomBytes(20).toString('hex');
      authCodes.set(code, {
        userId: session.user_id,
        email: session.email,
        role: session.role,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });
    }

    res.json({
      authenticated: true,
      user: {
        id: session.user_id,
        email: session.email,
        role: session.role
      },
      code
    });
  } catch (err) {
    console.error('Error checking session:', err);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
});

// Handle Login Credentials Form submission
app.post('/api/login', checkDb, async (req, res) => {
  const { email, password, redirect_uri } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'invalid_request', message: 'Email and password are required' });
  }

  try {
    const result = await dbPool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }

    // Create central session
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await dbPool.query(
      'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Set HTTP-only session cookie
    res.cookie('idp_session', refreshToken, {
      httpOnly: true,
      secure: false, // Set to true if HTTPS
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Generate authorization code for OIDC redirect
    let code = null;
    if (redirect_uri) {
      code = crypto.randomBytes(20).toString('hex');
      authCodes.set(code, {
        userId: user.id,
        email: user.email,
        role: user.role,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      code
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
});

// OAuth2 Token Exchange endpoint: Code -> JWT tokens
app.post('/oauth/token', (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Authorization code is required' });
  }

  const cachedSession = authCodes.get(code);
  if (!cachedSession) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
  }

  // Single-use code verification
  authCodes.delete(code);

  if (cachedSession.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
  }

  // Issue tokens
  const payload = {
    sub: cachedSession.userId,
    email: cachedSession.email,
    role: cachedSession.role,
    iss: 'central-idp',
    aud: 'all-services'
  };

  // Sign JWT Access Token and ID Token
  const accessToken = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
  const idToken = jwt.sign(
    {
      ...payload,
      auth_time: Math.floor(Date.now() / 1000)
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h' }
  );

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 900 // 15 mins
  });
});

// Central Profile endpoint
app.get('/api/me', checkDb, async (req, res) => {
  const { idp_session } = req.cookies;
  if (!idp_session) {
    return res.status(401).json({ error: 'unauthorized', message: 'No active session' });
  }

  try {
    const result = await dbPool.query(
      `SELECT s.id, u.email, u.role, s.expires_at 
       FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.refresh_token = $1`,
      [idp_session]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid session' });
    }

    const session = result.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await dbPool.query('DELETE FROM sessions WHERE id = $1', [session.id]);
      res.clearCookie('idp_session');
      return res.status(401).json({ error: 'unauthorized', message: 'Session expired' });
    }

    res.json({
      email: session.email,
      role: session.role
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
});

// Central Logout
app.get('/logout', checkDb, async (req, res) => {
  const { idp_session } = req.cookies;
  const { redirect_uri } = req.query;

  if (idp_session) {
    try {
      await dbPool.query('DELETE FROM sessions WHERE refresh_token = $1', [idp_session]);
    } catch (err) {
      console.error('Error deleting session during logout:', err);
    }
  }

  res.clearCookie('idp_session');

  if (redirect_uri) {
    return res.redirect(redirect_uri);
  }

  res.json({ message: 'Logged out successfully' });
});

// Serve frontend build files in production mode
const distPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // If not built yet, return simple message
  app.get('/', (req, res) => {
    res.send('Identity Provider server running (Frontend dist not built yet).');
  });
}

startServer();
