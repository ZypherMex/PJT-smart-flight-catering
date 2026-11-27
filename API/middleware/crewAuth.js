const crypto = require('crypto');
const HttpError = require('../utils/HttpError');

// The crew passkey is a shared demo secret, not per-user accounts. Tokens live
// in memory only, so restarting the server logs every crew device out.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const tokens = new Map(); // token -> expiry timestamp

function getPasskey() {
  return process.env.CREW_PASSKEY || '123490';
}

function passkeyMatches(candidate) {
  const expected = Buffer.from(getPasskey());
  const given = Buffer.from(String(candidate || ''));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function isValidToken(token) {
  if (!token) return false;
  const expiry = tokens.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function tokenFromRequest(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireCrew(req, res, next) {
  if (!isValidToken(tokenFromRequest(req))) {
    return next(new HttpError(401, 'Cabin crew sign-in required'));
  }
  next();
}

module.exports = { passkeyMatches, issueToken, isValidToken, tokenFromRequest, requireCrew };
