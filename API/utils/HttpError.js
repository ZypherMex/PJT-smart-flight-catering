// Throw from models/controllers to produce a specific HTTP response; the error
// middleware turns it into { error, ...extra } with the given status.
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

module.exports = HttpError;
