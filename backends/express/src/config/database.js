import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

// Create one shared PostgreSQL connection pool for the whole application.
// Using a pool avoids opening a brand-new database connection for every request.
const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  max: env.db.max,
  idleTimeoutMillis: env.db.idleTimeoutMillis,
  connectionTimeoutMillis: env.db.connectionTimeoutMillis
});

// Listen for unexpected pool-level errors.
// This is mainly a safety net for broken idle connections or database issues.
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

// Generic helper used by the repository layer to execute SQL queries.
export async function query(text, params = []) {
  return pool.query(text, params);
}

// Small startup check to verify the database is reachable before the server starts.
export async function testDatabaseConnection() {
  await pool.query('SELECT 1');
}

// Close the pool during graceful shutdown.
export async function closeDatabasePool() {
  await pool.end();
}