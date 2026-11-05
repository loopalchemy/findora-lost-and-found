const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCTION_DATABASE_NAME,
  TEST_DATABASE_NAME,
  firstAdminLockName,
  resolveDatabaseName,
} = require('../database/names');

test('production database is the canonical findora schema', () => {
  assert.equal(PRODUCTION_DATABASE_NAME, 'findora');
  assert.equal(resolveDatabaseName({}), 'findora');
  assert.equal(resolveDatabaseName({ DB_NAME: '' }), 'findora');
});

test('explicit database configuration is preserved', () => {
  assert.equal(resolveDatabaseName({ DB_NAME: 'custom_database' }), 'custom_database');
});

test('test database remains separate from production', () => {
  assert.equal(TEST_DATABASE_NAME, 'university_lost_found_test');
  assert.notEqual(TEST_DATABASE_NAME, PRODUCTION_DATABASE_NAME);
});

test('first-admin locks are scoped to the selected database', () => {
  assert.equal(firstAdminLockName(PRODUCTION_DATABASE_NAME), 'findora_first_admin');
  assert.equal(firstAdminLockName(TEST_DATABASE_NAME), 'university_lost_found_test_first_admin');
});
