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

// Routes — no /api prefix; Vercel strips routePrefix "/api" before forwarding
app.use('/auth',         require('./routes/auth'));
app.use('/dashboard',    require('./routes/dashboard'));
app.use('/products',     require('./routes/products'));
app.use('/epics',        require('./routes/epics'));
app.use('/features',     require('./routes/features'));
app.use('/backlog',      require('./routes/backlog'));
app.use('/sprints',      require('./routes/sprints'));
app.use('/users',        require('./routes/users'));
app.use('/qa',           require('./routes/qa'));
app.use('/standups',     require('./routes/standups'));
app.use('/notifications',require('./routes/notifications'));
app.use('/activities',   require('./routes/activities'));
app.use('/attachments',  require('./routes/attachments'));
app.use('/roadmap',      require('./routes/roadmap'));
app.use('/import',       require('./routes/import'));
app.use('/roles',        require('./routes/roles'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
