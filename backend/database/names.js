const PRODUCTION_DATABASE_NAME = 'findora';
const TEST_DATABASE_NAME = 'university_lost_found_test';

function resolveDatabaseName(env = process.env) {
  return env.DB_NAME || PRODUCTION_DATABASE_NAME;
}

function firstAdminLockName(databaseName) {
  return `${databaseName}_first_admin`;
}

module.exports = {
  PRODUCTION_DATABASE_NAME,
  TEST_DATABASE_NAME,
  firstAdminLockName,
  resolveDatabaseName,
};
