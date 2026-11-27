const path = require('path');
const express = require('express');

const seatRoutes = require('./routes/seatRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const diningRoutes = require('./routes/diningRoutes');
const aircraftRoutes = require('./routes/aircraftRoutes');
const menuRoutes = require('./routes/menuRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const crewRoutes = require('./routes/crewRoutes');
const orderRoutes = require('./routes/orderRoutes');
const healthConditionRoutes = require('./routes/healthConditionRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'WEB')));

app.use('/api', crewRoutes);
app.use('/api', healthConditionRoutes);
app.use('/api', orderRoutes);
app.use('/api', seatRoutes);
app.use('/api', preferenceRoutes);
app.use('/api', diningRoutes);
app.use('/api', aircraftRoutes);
app.use('/api', menuRoutes);
app.use('/api', recommendationRoutes);

app.use(errorHandler);

module.exports = app;
//This is is a NGL I REALLY WANNA PUSH ITcomment i hope nothing breaks while it is at it.