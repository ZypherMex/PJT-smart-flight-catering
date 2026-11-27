const HttpError = require('../utils/HttpError');

function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That photo is too large. The limit is 5 MB.' });
    return res.status(400).json({ error: 'The upload could not be read. Send a single image file.' });
  }
  // Malformed JSON bodies surface from express.json() as 400s with a status already set.
  if (err && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
