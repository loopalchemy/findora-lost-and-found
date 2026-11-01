export const MAX_IMAGE_BYTES = 350 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateReport(values, file) {
  const errors = {};
  for (const field of ['title', 'type', 'category', 'description', 'location', 'date']) {
    if (!String(values[field] ?? '').trim()) errors[field] = 'This field is required.';
  }
  if (values.type && !['lost', 'found'].includes(values.type)) errors.type = 'Choose Lost or Found.';
  if (values.date) {
    const date = new Date(`${values.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date > new Date()) errors.date = 'Enter a valid date that is not in the future.';
  }
  if (file) {
    if (!IMAGE_TYPES.includes(file.type)) errors.image = 'Choose a JPG, PNG or WebP image.';
    else if (file.size > MAX_IMAGE_BYTES) errors.image = 'Image must be 350 KB or smaller.';
  }
  return errors;
}

export function validateClaim(explanation) {
  const text = String(explanation ?? '').trim();
  if (text.length < 12) return 'Please provide at least 12 characters so the reviewer can verify your claim.';
  if (text.length > 500) return 'Keep the explanation to 500 characters or fewer.';
  return '';
}
