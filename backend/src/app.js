require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/products',     require('./routes/products'));
app.use('/api/epics',        require('./routes/epics'));
app.use('/api/features',     require('./routes/features'));
app.use('/api/backlog',      require('./routes/backlog'));
app.use('/api/sprints',      require('./routes/sprints'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/qa',           require('./routes/qa'));
app.use('/api/standups',     require('./routes/standups'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/activities',   require('./routes/activities'));
app.use('/api/attachments',  require('./routes/attachments'));
app.use('/api/roadmap',      require('./routes/roadmap'));
app.use('/api/import',       require('./routes/import'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
