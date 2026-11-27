const fs = require('fs');
const path = require('path');

const WEB_DIR = path.join(__dirname, '..', '..', 'WEB');
const IMAGE_URL_PATTERN = /^\/images\/menu\/([^/]+)\.[a-z0-9]+$/i;
const thumbExists = new Map();

// Small (~96px) version of a dish photo for lists. Uploaded photos always get
// one; older photos fall back to the full image until a thumbnail exists.
function thumbFor(imageUrl) {
  if (!imageUrl) return imageUrl || null;
  const match = IMAGE_URL_PATTERN.exec(imageUrl);
  if (!match) return imageUrl;

  const thumbUrl = `/images/menu/thumb/${match[1]}.webp`;
  if (!thumbExists.has(thumbUrl)) {
    thumbExists.set(thumbUrl, fs.existsSync(path.join(WEB_DIR, thumbUrl)));
  }
  return thumbExists.get(thumbUrl) ? thumbUrl : imageUrl;
}

module.exports = { thumbFor, WEB_DIR };
