require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const pool = require('./db');
const { createApp, configFromEnv } = require('./app');

const config = configFromEnv();
const app = createApp({ pool, config });
const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`University Lost-and-Found API listening on port ${port}.`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; closing the API server.`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
