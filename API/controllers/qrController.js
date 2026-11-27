const QRCode = require('qrcode');
const HttpError = require('../utils/HttpError');
const { getAccessUrls } = require('../services/networkService');

const MAX_URL_LENGTH = 200;

// The QR endpoints only encode a web address, so they are open (they carry no
// data). The check keeps them from being used to make codes for other schemes.
function readUrl(req) {
  const { url } = req.query;
  if (typeof url !== 'string' || !/^https?:\/\/[^\s]+$/i.test(url) || url.length > MAX_URL_LENGTH) {
    throw new HttpError(400, '"url" must be a web address starting with http:// or https://');
  }
  return url;
}

async function qrSvgHandler(req, res) {
  const svg = await QRCode.toString(readUrl(req), { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').send(svg);
}

async function qrPngHandler(req, res) {
  const png = await QRCode.toBuffer(readUrl(req), { type: 'png', width: 1000, margin: 2, errorCorrectionLevel: 'M' });
  if (req.query.download) res.setHeader('Content-Disposition', 'attachment; filename="order-qr-code.png"');
  res.type('image/png').send(png);
}

// Crew only: which addresses could a passenger's phone use to reach this server?
function serverInfoHandler(req, res) {
  const port = Number(process.env.PORT) || 3000;
  res.json({ port, urls: getAccessUrls(port) });
}

module.exports = { qrSvgHandler, qrPngHandler, serverInfoHandler };
