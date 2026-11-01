require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { validPassword, isEmail } = require('../src/validation');

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
  let transactionStarted = false;
  try {
    const email = (await prompt('Existing account email: ')).trim().toLowerCase();
    const password = await prompt('New password (hidden): ', true);
    const confirmation = await prompt('Confirm password (hidden): ', true);
    if (!isEmail(email)) throw new Error('Enter a valid account email address.');
    if (!validPassword(password)) throw new Error('Use 12–128 characters with uppercase, lowercase and a number.');
    if (password !== confirmation) throw new Error('Passwords do not match.');
    if (process.env.DB_NAME !== 'university_lost_found_test') throw new Error('DB_NAME must be university_lost_found_test. No data was changed.');

    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    const [identity] = await connection.query('SELECT DATABASE() AS databaseName');
    if (identity[0]?.databaseName !== 'university_lost_found_test') throw new Error('Connected database did not match the expected name. No data was changed.');

    await connection.beginTransaction();
    transactionStarted = true;
    const [accounts] = await connection.execute('SELECT user_id, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1 FOR UPDATE', [email]);
    if (!accounts.length) throw new Error('No account matched that email. No data was changed.');
    const account = accounts[0];
    const [result] = await connection.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, account.user_id]);
    if (result.affectedRows !== 1) throw new Error('The account password could not be updated. No data was changed.');
    await connection.commit();
    transactionStarted = false;
    console.log(`Password reset completed for an existing ${account.role} account. Its role, ID, reports and claims were preserved.`);
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback().catch(() => {});
    console.error('Password reset stopped:', error.code || error.message || 'unknown error');
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await pool.end().catch(() => {});
  }
}

main();

