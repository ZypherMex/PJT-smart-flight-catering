const path = require('path');
const express = require('express');

const seatRoutes = require('./routes/seatRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const diningRoutes = require('./routes/diningRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api', seatRoutes);
app.use('/api', preferenceRoutes);
app.use('/api', diningRoutes);

app.use(errorHandler);

module.exports = app;
