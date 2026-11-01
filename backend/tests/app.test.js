const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createApp, configFromEnv } = require('../app');
const { createMemoryPool } = require('./memoryPool');

const origin = 'http://localhost:3000';
const config = configFromEnv({
  JWT_SECRET: 'test-only-secret-do-not-use-outside-tests-0123456789',
  JWT_EXPIRES_IN: '2h',
  SESSION_MAX_AGE_MS: '7200000',
  AUTH_COOKIE_NAME: 'luf_test_session',
  CSRF_COOKIE_NAME: 'luf_test_csrf',
  COOKIE_SAME_SITE: 'lax',
  COOKIE_SECURE: 'false',
  FRONTEND_ORIGINS: origin,
  UPLOAD_DIR: '/tmp/luf-api-test-uploads',
});
const studentEmail = 'student@example.test';
const studentPassword = 'StudentPassword123';
const adminEmail = 'admin@example.test';
const adminPassword = 'AdminPassword123';

async function makeApp() {
  const adminHash = await bcrypt.hash(adminPassword, 4);
  const pool = createMemoryPool({ users: [{ user_id: 2, full_name: 'Test Admin', email: adminEmail, password_hash: adminHash, role: 'admin', created_at: '2026-10-01T00:00:00.000Z' }] });
  const app = createApp({ pool, config, uploadDir: config.uploadDir });
  return { app, pool };
}

async function csrf(agent) {
  const response = await agent.get('/api/auth/csrf').set('Origin', origin).expect(200);
  return response.body.csrfToken;
}

async function register(agent, email = studentEmail) {
  const token = await csrf(agent);
  const response = await agent.post('/api/auth/register').set('Origin', origin).set('X-CSRF-Token', token).send({
    fullName: 'Test Student', email, password: studentPassword, confirmPassword: studentPassword, role: 'admin', userId: 2,
  }).expect(201);
  return { ...response.body, cookies: response.headers['set-cookie'] || [] };
}

async function login(agent, email, password) {
  const token = await csrf(agent);
  return agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
}

test('health route is preserved, and CSRF is issued as a readable companion cookie', async () => {
  const { app } = await makeApp();
  await request(app).get('/').expect(200).expect(({ body }) => assert.match(body.message, /API is running/));
  await request(app).get('/api/ping').expect(200).expect(({ body }) => assert.equal(body.success, true));
  const result = await request(app).get('/api/auth/csrf').set('Origin', origin).expect(200);
  assert.equal(typeof result.body.csrfToken, 'string');
  assert.ok(result.body.csrfToken.length >= 40);
  assert.ok(result.headers['set-cookie'].some((cookie) => cookie.includes('luf_test_csrf=')));
});

test('registration hashes passwords, ignores role/user ID spoofing, and restores a cookie session', async () => {
  const { app, pool } = await makeApp();
  const agent = request.agent(app);
  const result = await register(agent);
  assert.equal(result.user.role, 'student');
  assert.notEqual(pool.state.users.find((user) => user.email === studentEmail).password_hash, studentPassword);
  assert.equal(await bcrypt.compare(studentPassword, pool.state.users.find((user) => user.email === studentEmail).password_hash), true);
  const session = await agent.get('/api/auth/me').set('Origin', origin).expect(200);
  assert.equal(session.body.user.email, studentEmail);
  assert.equal(session.body.user.role, 'student');
  assert.ok(result.cookies.some((cookie) => cookie.includes('luf_test_session=') && /HttpOnly/i.test(cookie)));
  assert.equal((await agent.get('/api/users/me').set('Origin', origin).expect(200)).body.user.id, result.user.id);
});

test('login rejects invalid credentials, rotates the session, and logout clears it', async () => {
  const { app } = await makeApp();
  const agent = request.agent(app);
  await register(agent);
  const sessionToken = (await agent.get('/api/auth/me').expect(200)).body.csrfToken;
  await agent.post('/api/auth/logout').set('Origin', origin).set('X-CSRF-Token', sessionToken).expect(200);
  const afterLogout = await agent.get('/api/auth/me').set('Origin', origin).expect(200);
  assert.equal(afterLogout.body.user, null);
  const invalidAgent = request.agent(app);
  const token = await csrf(invalidAgent);
  await invalidAgent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email: studentEmail, password: 'wrong' }).expect(401);
  const loginAgent = request.agent(app);
  await login(loginAgent, studentEmail, studentPassword);
  assert.equal((await loginAgent.get('/api/auth/me').expect(200)).body.user.role, 'student');
});

test('public visitors see only approved/recovered reports; owners can see their own pending records', async () => {
  const { app } = await makeApp();
  const owner = request.agent(app);
  await register(owner);
  const csrfToken = (await owner.get('/api/auth/me').expect(200)).body.csrfToken;
  const created = await owner.post('/api/reports').set('Origin', origin).set('X-CSRF-Token', csrfToken).field('userId', '2').field('type', 'lost').field('title', 'Lost card case').field('category', 'Electronics').field('description', 'A black card case with a campus sticker.').field('location', 'Library stairs').field('date', '2026-10-20').expect(201);
  const report = created.body.report;
  assert.equal(report.status, 'Pending review');
  assert.notEqual(report.ownerId, '2');
  const publicReports = await request(app).get('/api/reports').expect(200);
  assert.ok(publicReports.body.reports.every((row) => ['Approved', 'Recovered'].includes(row.status)));
  assert.ok(!publicReports.body.reports.some((row) => row.id === report.id));
  const filteredReports = await request(app).get('/api/reports?scope=public&q=notebook&type=found&sort=newest&limit=500').expect(200);
  assert.deepEqual(filteredReports.body.reports.map((row) => row.id), ['1']);
  const locationReports = await request(app).get('/api/reports?scope=public&location=Library').expect(200);
  assert.deepEqual(locationReports.body.reports.map((row) => row.id), ['1']);
  const privateReports = await owner.get('/api/reports/mine').expect(200);
  assert.ok(privateReports.body.reports.some((row) => row.id === report.id));
  await request(app).get(`/api/reports/${report.id}`).expect(404);
  await owner.get(`/api/reports/${report.id}`).expect(200);
});

test('only administrators can review reports, list all claims/users and read database statistics', async () => {
  const { app, pool } = await makeApp();
  const student = request.agent(app);
  await register(student);
  const studentToken = (await student.get('/api/auth/me')).body.csrfToken;
  await student.get('/api/claims').expect(403);
  await student.get('/api/users').expect(403);
  await student.get('/api/admin/statistics').expect(403);
  await student.get('/api/reports?scope=admin').expect(403);
  await student.patch('/api/reports/3/status').set('Origin', origin).set('X-CSRF-Token', studentToken).send({ status: 'Approved', role: 'admin', userId: 2 }).expect(403);
  assert.equal(pool.state.items.find((item) => item.item_id === 3).status, 'Pending review');
  const admin = request.agent(app);
  await login(admin, adminEmail, adminPassword);
  await admin.get('/api/users').expect(200).expect(({ body }) => assert.equal(body.users.length, 2));
  await admin.get('/api/admin/statistics').expect(200).expect(({ body }) => assert.equal(body.statistics.reports.pending, 1));
  const publicBrowse = await admin.get('/api/reports?scope=public').expect(200);
  assert.ok(!publicBrowse.body.reports.some((row) => row.id === '3'));
  const adminQueue = await admin.get('/api/reports?scope=admin').expect(200);
  assert.ok(adminQueue.body.reports.some((row) => row.id === '3' && row.status === 'Pending review'));
  const token = (await admin.get('/api/auth/me')).body.csrfToken;
  await admin.patch('/api/reports/3/status').set('Origin', origin).set('X-CSRF-Token', token).send({ status: 'Approved' }).expect(200);
  assert.equal(pool.state.items.find((item) => item.item_id === 3).status, 'Approved');
});

test('claims require a different user and an approved found report; duplicates and state coupling are prevented', async () => {
  const { app, pool } = await makeApp();
  const student = request.agent(app);
  const account = await register(student);
  pool.state.items.find((item) => item.item_id === 2).user_id = Number(account.user.id);
  const token = (await student.get('/api/auth/me')).body.csrfToken;
  const self = await student.post('/api/claims').set('Origin', origin).set('X-CSRF-Token', token).send({ reportId: 2, explanation: 'This is mine and I can describe the label.' }).expect(403);
  assert.match(self.body.message, /own report/i);
  await student.post('/api/claims').set('Origin', origin).set('X-CSRF-Token', token).send({ reportId: 3, explanation: 'I can identify the blue cover and a mark inside.' }).expect(409);
  const created = await student.post('/api/claims').set('Origin', origin).set('X-CSRF-Token', token).send({ reportId: 1, explanation: 'I can identify the blue cover and the writing on its inside page.' }).expect(201);
  assert.equal(created.body.claim.status, 'Pending review');
  await student.post('/api/claims').set('Origin', origin).set('X-CSRF-Token', token).send({ reportId: 1, explanation: 'A second detailed description of this same item.' }).expect(409);
  const ownClaims = await student.get('/api/claims/mine').expect(200);
  assert.equal(ownClaims.body.claims.length, 1);
  const admin = request.agent(app);
  await login(admin, adminEmail, adminPassword);
  const adminToken = (await admin.get('/api/auth/me')).body.csrfToken;
  await admin.patch(`/api/claims/${created.body.claim.id}/status`).set('Origin', origin).set('X-CSRF-Token', adminToken).send({ status: 'approved' }).expect(200).expect(({ body }) => assert.equal(body.reportStatusChanged, false));
  assert.equal(pool.state.claims[0].status, 'approved');
  assert.equal(pool.state.items.find((item) => item.item_id === 1).status, 'Approved');
});

test('categories are database-backed, admin-only to mutate, and in-use categories cannot be removed', async () => {
  const { app, pool } = await makeApp();
  await request(app).get('/api/categories').expect(200).expect(({ body }) => assert.equal(body.categories.length, 2));
  const student = request.agent(app);
  await register(student);
  const studentToken = (await student.get('/api/auth/me')).body.csrfToken;
  await student.post('/api/categories').set('Origin', origin).set('X-CSRF-Token', studentToken).send({ name: 'New category' }).expect(403);
  const admin = request.agent(app);
  await login(admin, adminEmail, adminPassword);
  const adminToken = (await admin.get('/api/auth/me')).body.csrfToken;
  const added = await admin.post('/api/categories').set('Origin', origin).set('X-CSRF-Token', adminToken).send({ name: 'Sports gear' }).expect(201);
  await admin.delete(`/api/categories/${added.body.category.id}`).set('Origin', origin).set('X-CSRF-Token', adminToken).expect(200);
  await admin.delete('/api/categories/1').set('Origin', origin).set('X-CSRF-Token', adminToken).expect(409);
  assert.ok(pool.state.categories.some((category) => category.category_id === 1));
});

test('untrusted origins, missing CSRF and false image signatures are rejected', async () => {
  const { app } = await makeApp();
  const guest = request.agent(app);
  const token = await csrf(guest);
  await guest.post('/api/auth/register').set('Origin', 'https://attacker.example').set('X-CSRF-Token', token).send({ fullName: 'Blocked', email: 'blocked@example.test', password: studentPassword, confirmPassword: studentPassword }).expect(403);
  await guest.post('/api/auth/register').set('Origin', origin).send({ fullName: 'Blocked', email: 'blocked@example.test', password: studentPassword, confirmPassword: studentPassword }).expect(403);
  const user = request.agent(app);
  await register(user);
  const userToken = (await user.get('/api/auth/me')).body.csrfToken;
  await user.post('/api/reports').set('Origin', origin).set('X-CSRF-Token', userToken).field('type', 'found').field('title', 'Fake picture').field('category', 'Electronics').field('description', 'This fake file must not be saved.').field('location', 'Library').field('date', '2026-10-20').attach('image', Buffer.from('not really a PNG'), { filename: 'fake.png', contentType: 'image/png' }).expect(415);
});
