const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

function createPool(env = process.env) {
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT must be a valid TCP port.');
  return mysql.createPool({
    host: env.DB_HOST || 'localhost',
    port,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME || 'university_lost_found',
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
