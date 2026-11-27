const path = require('path');
const express = require('express');
const compression = require('compression');

const seatRoutes = require('./routes/seatRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const diningRoutes = require('./routes/diningRoutes');
const aircraftRoutes = require('./routes/aircraftRoutes');
const menuRoutes = require('./routes/menuRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const crewRoutes = require('./routes/crewRoutes');
const orderRoutes = require('./routes/orderRoutes');
const healthConditionRoutes = require('./routes/healthConditionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const qrRoutes = require('./routes/qrRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(compression());
app.use(express.json({ limit: '100kb' }));

// Dish photos rarely change and are the heaviest thing on the page: let phones
// keep them for a day. Pages, scripts and styles are re-checked on each visit
// (cheap 304s) so edits show up straight away.
const WEB_DIR = path.join(__dirname, '..', 'WEB');
app.use('/images', express.static(path.join(WEB_DIR, 'images'), { maxAge: '1d' }));
app.use(express.static(WEB_DIR));

app.use('/api', crewRoutes);
app.use('/api', healthConditionRoutes);
app.use('/api', orderRoutes);
app.use('/api', adminRoutes);
app.use('/api', qrRoutes);
app.use('/api', seatRoutes);
app.use('/api', preferenceRoutes);
app.use('/api', diningRoutes);
app.use('/api', aircraftRoutes);
app.use('/api', menuRoutes);
app.use('/api', recommendationRoutes);

app.use(errorHandler);

module.exports = app;
//This is is a NGL I REALLY WANNA PUSH ITcomment i hope nothing breaks while it is at it.