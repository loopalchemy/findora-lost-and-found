require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { validPassword, isEmail } = require('../src/validation');
const { TEST_DATABASE_NAME, firstAdminLockName } = require('../database/names');

function prompt(label, hidden = false) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      return reject(new Error('Run this command in an interactive terminal; passwords are not accepted as command-line arguments.'));
    }
    output.write(label);
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    let value = '';
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(wasRaw || false);
      output.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') return finish(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') {
          if (value.length) { value = value.slice(0, -1); if (!hidden) output.write('\b \b'); }
          continue;
        }
        if (char >= ' ' && char !== '\u007f') { value += char; if (!hidden) output.write(char); }
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  let connection;
  let lockAcquired = false;
  let transactionStarted = false;
  const lockName = firstAdminLockName(TEST_DATABASE_NAME);
  try {
    const fullName = (await prompt('Administrator full name: ')).trim();
    const email = (await prompt('Administrator email: ')).trim().toLowerCase();
    const password = await prompt('New password (hidden): ', true);
    const confirmation = await prompt('Confirm password (hidden): ', true);
    if (fullName.length < 2 || fullName.length > 100) throw new Error('Full name must be 2–100 characters.');
    if (!isEmail(email)) throw new Error('Enter a valid email address.');
    if (!validPassword(password)) throw new Error('Use 12–128 characters with uppercase, lowercase and a number.');
    if (password !== confirmation) throw new Error('Passwords do not match.');
    if (process.env.DB_NAME !== TEST_DATABASE_NAME) throw new Error(`DB_NAME must be ${TEST_DATABASE_NAME}. No data was changed.`);

    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    const [dbRows] = await connection.query('SELECT DATABASE() AS databaseName');
    if (dbRows[0]?.databaseName !== TEST_DATABASE_NAME) throw new Error('Connected database did not match the expected name. No data was changed.');
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error('Could not acquire the administrator bootstrap lock.');

    await connection.beginTransaction();
    transactionStarted = true;
    const [existing] = await connection.execute('SELECT user_id, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1 FOR UPDATE', [email]);
    if (existing.length) throw new Error('An account already uses that email. Use account:reset-password only to reset its password; this bootstrap never changes roles.');
    const [admins] = await connection.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    if (Number(admins[0]?.total || 0) > 0) throw new Error('An administrator already exists. Use the existing admin process; this bootstrap creates the first admin only.');
    await connection.execute('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', [fullName, email, passwordHash, 'admin']);
    console.log('First administrator created. Store the password securely; it cannot be retrieved from the database.');
    await connection.commit();
    transactionStarted = false;
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback().catch(() => {});
    console.error('Administrator setup stopped:', error.code || error.message || 'unknown error');
    process.exitCode = 1;
  } finally {
    if (connection && lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', ['university_lost_and_found_first_admin']).catch(() => {});
    if (connection) connection.release();
    await pool.end().catch(() => {});
  }
}

main();

