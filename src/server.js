const express = require('express');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const { syncLatest } = require('./sync');
const { findLatestSpreadsheet } = require('./drive');
const { getOptions, getResults, getRanking, getSyncStatus } = require('./repository');

const app = express();
app.use(express.json());
app.use(morgan('tiny'));
app.use(express.static(path.join(__dirname, '..', 'public')));

function asyncRoute(fn) {
  return (req, res) => fn(req, res).catch(error => res.status(500).json({ error: error.message }));
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/status', asyncRoute(async (req, res) => {
  res.json({ status: await getSyncStatus(), latestFile: await findLatestSpreadsheet().catch(e => ({ error: e.message })) });
}));

app.post('/api/sync', asyncRoute(async (req, res) => {
  res.json(await syncLatest({ force: true }));
}));

app.get('/api/options', asyncRoute(async (req, res) => res.json(await getOptions())));

app.get('/api/results', asyncRoute(async (req, res) => {
  res.json(await getResults({
    category: req.query.category,
    club: req.query.club,
    event: req.query.event,
    athlete: req.query.athlete
  }));
}));

app.get('/api/ranking', asyncRoute(async (req, res) => {
  res.json(await getRanking({
    category: req.query.category,
    club: req.query.club,
    event: req.query.event,
    athlete: req.query.athlete
  }));
}));

app.listen(config.port, () => {
  console.log(`Servidor iniciado en puerto ${config.port}`);
  if (config.autoSyncOnBoot) {
    syncLatest().then(r => console.log('Auto sync boot:', r)).catch(e => console.error('Auto sync boot error:', e.message));
  }
  if (config.autoSyncIntervalMinutes > 0) {
    setInterval(() => {
      syncLatest().then(r => console.log('Auto sync interval:', r)).catch(e => console.error('Auto sync interval error:', e.message));
    }, config.autoSyncIntervalMinutes * 60 * 1000);
  }
});
