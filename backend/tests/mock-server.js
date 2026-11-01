if (process.env.NODE_ENV !== 'test' || process.env.ALLOW_TEST_MOCK_SERVER !== '1') {
  console.error('Refusing to start. This in-memory fixture requires NODE_ENV=test and ALLOW_TEST_MOCK_SERVER=1.');
  process.exit(1);
}

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { createApp, configFromEnv } = require('../app');
const { createMemoryPool } = require('./memoryPool');

async function main() {
  const studentPassword = 'StudentPassword123';
  const adminPassword = 'AdminPassword123';
  const [studentHash, adminHash] = await Promise.all([bcrypt.hash(studentPassword, 4), bcrypt.hash(adminPassword, 4)]);
  const pool = createMemoryPool({
    users: [
      { user_id: 1, full_name: 'Test Student', email: 'student@example.test', password_hash: studentHash, role: 'student', created_at: '2026-10-01T00:00:00.000Z' },
      { user_id: 2, full_name: 'Test Administrator', email: 'admin@example.test', password_hash: adminHash, role: 'admin', created_at: '2026-10-01T00:00:00.000Z' },
    ],
  });
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luf-browser-test-'));
  const config = configFromEnv({
    JWT_SECRET: 'test-only-secret-never-use-outside-in-memory-testing-0123456789',
    JWT_EXPIRES_IN: '2h',
    SESSION_MAX_AGE_MS: '7200000',
    AUTH_COOKIE_NAME: 'luf_browser_test_session',
    CSRF_COOKIE_NAME: 'luf_browser_test_csrf',
    COOKIE_SAME_SITE: process.env.MOCK_COOKIE_SAME_SITE || 'lax',
    COOKIE_SECURE: process.env.MOCK_COOKIE_SECURE || 'false',
    FRONTEND_ORIGINS: process.env.MOCK_FRONTEND_ORIGINS || 'http://localhost:3000',
    UPLOAD_DIR: uploadDir,
  });
  const port = Number(process.env.MOCK_PORT || 5001);
  const server = createApp({ pool, config, uploadDir }).listen(port, '127.0.0.1', () => {
    console.log(`Test-only in-memory API listening on 127.0.0.1:${port}. No MySQL connection is used.`);
  });
  const shutdown = () => server.close(async () => {
    await pool.end();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    process.exit(0);
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Test-only mock server failed:', error.code || error.name);
  process.exitCode = 1;
});
