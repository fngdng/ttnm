const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'build')));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Expense Manager API (SQLite + Socket.io).' });
});

require('./routes/auth.routes')(app);
require('./routes/transaction.routes')(app);
require('./routes/user.routes')(app);
require('./routes/category.routes')(app);
require('./routes/budget.routes')(app);
require('./routes/report.routes')(app);
require('./routes/mindee.routes')(app);

app.get('/api/welcome', (req, res) => {
  res.json({ message: 'Welcome to Expense Manager API.' });
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'build', 'index.html'));
});

module.exports = app;