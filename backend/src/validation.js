const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}

function validPassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

function validateRegistration(body = {}) {
  const fullName = text(body.fullName, 100);
  const email = text(body.email, 254).toLowerCase();
  const password = body.password;
  const errors = {};
  if (fullName.length < 2) errors.fullName = 'Enter your full name (at least 2 characters).';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (!validPassword(password)) errors.password = 'Use 12–128 characters with at least one uppercase letter, one lowercase letter and one number.';
  if (body.password !== body.confirmPassword) errors.confirmPassword = 'The passwords do not match.';
  return { value: { fullName, email, password }, errors };
}

function validateLogin(body = {}) {
  const email = text(body.email, 254).toLowerCase();
  const password = body.password;
  const errors = {};
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) errors.password = 'Enter your password.';
  return { value: { email, password }, errors };
}

function validateReport(body = {}) {
  const value = {
    type: text(body.type, 16).toLowerCase(),
    title: text(body.title, 80),
    category: text(body.category, 80),
    description: text(body.description, 500),
    location: text(body.location, 120),
    date: text(body.date, 10),
    colour: text(body.colour, 80),
  };
  const errors = {};
  if (!['lost', 'found'].includes(value.type)) errors.type = 'Choose Lost or Found.';
  if (value.title.length < 2) errors.title = 'Enter an item name (at least 2 characters).';
  if (!value.category) errors.category = 'Choose a category.';
  if (value.description.length < 5) errors.description = 'Add a little more detail (at least 5 characters).';
  if (!value.location) errors.location = 'Enter where the item was last seen or found.';
  if (!validDate(value.date)) errors.date = 'Enter a valid date that is not in the future.';
  return { value, errors };
}

function validateClaim(body = {}) {
  const explanation = text(body.explanation, 500);
  const errors = {};
  if (explanation.length < 12) errors.explanation = 'Provide at least 12 characters so a reviewer can assess the claim.';
  if (typeof body.explanation === 'string' && body.explanation.trim().length > 500) errors.explanation = 'Keep the explanation to 500 characters or fewer.';
  return { value: { explanation }, errors };
}

function validateCategory(body = {}) {
  const name = text(body.name, 80);
  const description = text(body.description, 300);
  const errors = {};
  if (name.length < 2) errors.name = 'Category name must contain at least 2 characters.';
  return { value: { name, description }, errors };
}

function positiveId(value) {
  const number = typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function isEmail(value) {
  return EMAIL_RE.test(value);
}

module.exports = { text, validDate, validPassword, validateRegistration, validateLogin, validateReport, validateClaim, validateCategory, positiveId, isEmail };
