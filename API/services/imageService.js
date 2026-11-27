const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const HttpError = require('../utils/HttpError');
const { WEB_DIR } = require('../utils/images');

const IMAGE_DIR = path.join(WEB_DIR, 'images', 'menu');
const THUMB_DIR = path.join(IMAGE_DIR, 'thumb');
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];
// Only files this service generated (uuid.webp) are ever deleted — the original
// seeded photos are never touched.
const GENERATED_URL = /^\/images\/menu\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

// Validates the upload by actually decoding it (not by trusting the filename or
// mime type), then stores a web-sized WebP plus a small thumbnail.
async function saveMealImage(buffer) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (err) {
    throw new HttpError(400, 'That file is not a valid image.');
  }
  if (!ALLOWED_FORMATS.includes(metadata.format)) {
    throw new HttpError(400, 'Please upload a JPG, PNG or WebP image.');
  }

  const id = crypto.randomUUID();
  await fs.mkdir(THUMB_DIR, { recursive: true });

  await sharp(buffer).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(IMAGE_DIR, `${id}.webp`));
  await sharp(buffer).rotate().resize(96, 96, { fit: 'cover' }).webp({ quality: 75 }).toFile(path.join(THUMB_DIR, `${id}.webp`));

  return { imageUrl: `/images/menu/${id}.webp` };
}

// Best-effort housekeeping: by the time this runs the database already points at
// the new photo, so a file that cannot be removed (e.g. still locked on Windows)
// is logged and left behind rather than failing the staff member's request.
async function deleteGeneratedImage(imageUrl) {
  const match = GENERATED_URL.exec(imageUrl || '');
  if (!match) return;
  for (const file of [path.join(IMAGE_DIR, `${match[1]}.webp`), path.join(THUMB_DIR, `${match[1]}.webp`)]) {
    await fs.unlink(file).catch((err) => {
      if (err.code !== 'ENOENT') console.warn(`Could not delete old meal photo ${file}: ${err.message}`);
    });
  }
}

module.exports = { saveMealImage, deleteGeneratedImage };
