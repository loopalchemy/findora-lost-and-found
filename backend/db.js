
const mysql = require('mysql2/promise');
const path = require('node:path');
const fs = require('node:fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

function createPool(env = process.env) {
  const port = Number(env.DB_PORT || 3306);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port.');
  }

  const ssl = env.DB_SSL === 'true'
    ? {
        ca: fs.readFileSync(env.DB_SSL_CA_PATH, 'utf8'),
        minVersion: 'TLSv1.2',
      }
    : undefined;

  return mysql.createPool({
    host: env.DB_HOST || 'localhost',
    port,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME || 'university_lost_found',
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    enableKeepAlive: true,
    decimalNumbers: true,
    charset: 'utf8mb4',
  });
}

const pool = createPool();

module.exports = pool;
module.exports.createPool = createPool;
