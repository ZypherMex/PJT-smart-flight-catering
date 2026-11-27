const { passkeyMatches, issueToken } = require('../middleware/crewAuth');
const HttpError = require('../utils/HttpError');

function loginHandler(req, res) {
  const { passkey } = req.body || {};
  if (!passkeyMatches(passkey)) {
    throw new HttpError(401, 'Incorrect passkey');
  }
  res.json({ token: issueToken() });
}

// Sits behind requireCrew, so reaching it at all means the token is valid —
// the frontend uses it to confirm a stored token before showing crew pages.
function sessionHandler(req, res) {
  res.json({ ok: true });
}

module.exports = { loginHandler, sessionHandler };
