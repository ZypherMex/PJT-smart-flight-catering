// Turns the full-size dish photos in assets/menu-originals/ into the small,
// fast-loading versions the website serves:
//   WEB/images/menu/<name>.webp         640px wide  (menu cards, order page)
//   WEB/images/menu/thumb/<name>.webp   96px square (lists, crew board)
//
// Run with:  npm run optimize-images        (only converts new/changed photos)
//            npm run optimize-images -- --force   (redo everything)
//
// The originals are never modified or served; drop a new photo into
// assets/menu-originals/ (name it after the dish, e.g. "caviar.png") and re-run.

const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'menu-originals');
const OUT_DIR = path.join(ROOT, 'WEB', 'images', 'menu');
const THUMB_DIR = path.join(OUT_DIR, 'thumb');
const FORCE = process.argv.includes('--force');

async function isUpToDate(source, outputs) {
  if (FORCE) return false;
  try {
    const sourceTime = (await fs.stat(source)).mtimeMs;
    const times = await Promise.all(outputs.map(async (file) => (await fs.stat(file)).mtimeMs));
    return times.every((time) => time >= sourceTime);
  } catch (err) {
    return false; // an output is missing
  }
}

async function main() {
  await fs.mkdir(THUMB_DIR, { recursive: true });
  const files = (await fs.readdir(SOURCE_DIR)).filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
  let converted = 0;
  let skipped = 0;
  let before = 0;
  let after = 0;

  for (const name of files) {
    const slug = path.parse(name).name;
    const source = path.join(SOURCE_DIR, name);
    const full = path.join(OUT_DIR, `${slug}.webp`);
    const thumb = path.join(THUMB_DIR, `${slug}.webp`);

    if (await isUpToDate(source, [full, thumb])) {
      skipped += 1;
      continue;
    }
    await sharp(source).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80 }).toFile(full);
    await sharp(source).rotate().resize(96, 96, { fit: 'cover' }).webp({ quality: 75 }).toFile(thumb);
    before += (await fs.stat(source)).size;
    after += (await fs.stat(full)).size + (await fs.stat(thumb)).size;
    converted += 1;
  }

  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  console.log(`Photos: ${converted} converted, ${skipped} already up to date.`);
  if (converted) console.log(`Size of the converted photos: ${mb(before)} MB originals -> ${mb(after)} MB served (${Math.round((1 - after / before) * 100)}% smaller).`);
}

main().catch((err) => {
  console.error('Photo optimisation failed:', err.message);
  process.exit(1);
});
