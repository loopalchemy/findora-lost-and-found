const multer = require('multer');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_IMAGE_BYTES = 350 * 1024;
const MIME_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 12, parts: 14 },
  fileFilter(_req, file, callback) {
    if (!MIME_EXTENSIONS.has(file.mimetype)) {
      const error = new Error('Choose a JPG, PNG or WebP image.');
      error.status = 415;
      error.code = 'UNSUPPORTED_IMAGE_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

async function saveValidatedImage(file, uploadDir) {
  if (!file) return null;
  if (!Buffer.isBuffer(file.buffer) || file.size > MAX_IMAGE_BYTES) {
    const error = new Error('Image must be 350 KB or smaller.');
    error.status = 413;
    throw error;
  }
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(file.buffer);
  const extension = detected && MIME_EXTENSIONS.get(detected.mime);
  if (!extension || detected.mime !== file.mimetype) {
    const error = new Error('The selected file is not a valid JPG, PNG or WebP image.');
    error.status = 415;
    throw error;
  }
  await fs.mkdir(uploadDir, { recursive: true, mode: 0o750 });
  const filename = `${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadDir, filename), file.buffer, { flag: 'wx', mode: 0o640 });
  return `/uploads/${filename}`;
}

async function removeStoredImage(imagePath, uploadDir) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return;
  const filename = imagePath.slice('/uploads/'.length);
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) return;
  await fs.unlink(path.join(uploadDir, filename)).catch(() => {});
}

module.exports = { MAX_IMAGE_BYTES, uploadMiddleware, saveValidatedImage, removeStoredImage };
