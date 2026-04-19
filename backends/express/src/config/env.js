import dotenv from 'dotenv';

// Load environment variables from .env into process.env.
dotenv.config();

// Read a string environment variable.
// If it is missing, either return the default value or throw an error.
function getEnv(name, defaultValue = undefined) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// Read a numeric environment variable and validate that it is a real number.
function getNumberEnv(name, defaultValue) {
  const raw = getEnv(name, String(defaultValue));
  const value = Number(raw);

  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }

  return value;
}

// Centralized application configuration.
// Keeping all environment-based settings here makes the rest of the code cleaner.
const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getNumberEnv('PORT', 3001),

  db: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getNumberEnv('DB_PORT', 5432),
    database: getEnv('DB_NAME', 'todo_express'),
    user: getEnv('DB_USER'),
    password: getEnv('DB_PASSWORD'),
    max: getNumberEnv('DB_POOL_MAX', 10),
    idleTimeoutMillis: getNumberEnv('DB_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: getNumberEnv('DB_CONNECTION_TIMEOUT_MS', 2000)
  }
};

export default env;