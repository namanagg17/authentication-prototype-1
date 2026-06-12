import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Client, Pool } = pg;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || process.env.USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

const DB_NAME = 'unified_auth_db';

export async function initializeDatabase() {
  console.log('Connecting to PostgreSQL to check database...');
  
  // 1. Connect to default 'postgres' database first to create the target DB if it doesn't exist
  const client = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
    
    if (res.rowCount === 0) {
      console.log(`Database "${DB_NAME}" does not exist. Creating it...`);
      // CREATE DATABASE cannot run inside a transaction block, and pg Client allows it
      await client.query(`CREATE DATABASE ${DB_NAME}`);
      console.log(`Database "${DB_NAME}" created successfully.`);
    } else {
      console.log(`Database "${DB_NAME}" already exists.`);
    }
  } catch (err) {
    console.error('Error checking/creating database:', err);
    throw err;
  } finally {
    await client.end();
  }

  // 2. Connect to the target 'unified_auth_db' and initialize tables
  const pool = new Pool({
    ...dbConfig,
    database: DB_NAME,
  });

  try {
    console.log('Initializing tables...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL
      )
    `);

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(512) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    console.log('Tables initialized successfully.');

    // Seed default users if they don't exist
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      console.log('Seeding default users...');
      
      const salt = await bcrypt.genSalt(10);
      const defaultPasswordHash = await bcrypt.hash('password123', salt);

      // Seed Free User
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        ['free@email.com', defaultPasswordHash, 'free']
      );

      // Seed Premium User
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        ['premium@email.com', defaultPasswordHash, 'premium']
      );

      console.log('Default users seeded:');
      console.log(' - free@email.com / password123 (role: free)');
      console.log(' - premium@email.com / password123 (role: premium)');
    }
  } catch (err) {
    console.error('Error during table initialization/seeding:', err);
    throw err;
  }

  return pool;
}
