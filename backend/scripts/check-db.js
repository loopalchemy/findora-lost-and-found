require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const pool = require('../db');

const expected = ['users', 'categories', 'items', 'claims'];

async function main() {
  try {
    const [identity] = await pool.query('SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion');
    if (identity[0]?.databaseName !== 'university_lost_found') {
      throw new Error('The connection is not using the expected university_lost_found database.');
    }
    console.log(`Read-only connection verified: MySQL ${identity[0].mysqlVersion}; database university_lost_found.`);
    const [tables] = await pool.query('SHOW TABLES');
    const tableName = Object.keys(tables[0] || {})[0];
    const found = new Set(tables.map((row) => row[tableName]));
    for (const name of expected) {
      if (!found.has(name)) throw new Error(`Required table is missing: ${name}.`);
      const [definitions] = await pool.query(`SHOW CREATE TABLE \`${name}\``);
      console.log(`\n--- ${name} ---\n${definitions[0]['Create Table']}`);
    }
    console.log('\nNo schema changes or data writes were performed.');
  } catch (error) {
    console.error('Read-only database check failed:', error.code || error.message || 'unknown error');
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
