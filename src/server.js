const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const { listSpreadsheetFiles, downloadFileBuffer, downloadBufferFromUrl } = require('./googleDrive');
const { parseWorkbook, normalizeRecord, filterRows } = require('./excelParser');
const { createRepository } = require('./repository');

const app = express();
const repository = createRepository(config);

const syncState = {
  running: false,
  lastSyncAt: null,
  lastSource: null,
  lastImportedRows: 0,
  lastError: null,
};

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(express.static('public'));

async function resolveSource() {
  const explicitFileId = config.publicFileId;
  const explicitUrl = config.publicFileUrl;

  if (explicitUrl) {
    const buffer = await downloadBufferFromUrl(explicitUrl);
    return { buffer, sourceFileName: explicitUrl, mode: 'public_url' };
  }

  if (explicitFileId) {
    const buffer = await downloadFileBuffer(config, explicitFileId);
    return { buffer, sourceFileName: explicitFileId, mode: 'public_file_id' };
  }

  if (config.googleServiceAccountJson && config.driveFolderId) {
    const files = await listSpreadsheetFiles(config);
    if (!files.length) {
      throw new Error('No se encontraron ficheros Excel/Sheets/CSV en Google Drive.');
    }
    const latest = files[0];
    const buffer = await downloadFileBuffer(config, latest.id);
    return { buffer, sourceFileName: latest.name || latest.id, mode: 'drive_folder_latest' };
  }

  throw new Error('No hay fuente configurada. Usa PUBLIC_FILE_URL, PUBLIC_FILE_ID o DRIVE_FOLDER_ID + GOOGLE_SERVICE_ACCOUNT_JSON.');
}

async function syncFromSource() {
  if (!repository) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (syncState.running) {
    return { skipped: true, reason: 'already-running' };
  }

  syncState.running = true;
  syncState.lastError = null;
  try {
    const { buffer, sourceFileName, mode } = await resolveSource();
    const { rows, headerMap, sheetName } = parseWorkbook(buffer);
    const normalized = rows.map((row) => normalizeRecord(row, headerMap, sourceFileName)).filter(Boolean);
    const filtered = filterRows(normalized, config);
    const result = await repository.replaceAll(filtered, sourceFileName);

    syncState.lastSyncAt = new Date().toISOString();
    syncState.lastSource = sourceFileName;
    syncState.lastImportedRows = result.inserted;

    return {
      ok: true,
      mode,
      sheetName,
      sourceFileName,
      detectedHeaders: headerMap,
      parsedRows: rows.length,
      importedRows: result.inserted,
      filtersApplied: {
        categories: config.categoryFilters,
      },
    };
  } catch (error) {
    syncState.lastError = error.message;
    throw error;
  } finally {
    syncState.running = false;
  }
}

app.get('/health', async (_req, res) => {
  try {
    let database = 'not-configured';
    if (repository) {
      await repository.health();
      database = 'ok';
    }

    res.json({
      ok: true,
      service: 'athletics-app',
      database,
      sourceConfigured: Boolean(config.publicFileUrl || config.publicFileId || (config.driveFolderId && config.googleServiceAccountJson)),
      syncState,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, syncState });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    clubNameFilter: config.clubNameFilter,
    categoryFilters: config.categoryFilters,
    autoSyncOnBoot: config.autoSyncOnBoot,
    autoSyncIntervalMinutes: config.autoSyncIntervalMinutes,
  });
});

app.get('/api/sync-status', (_req, res) => {
  res.json(syncState);
});

app.post('/api/sync', async (_req, res) => {
  try {
    const result = await syncFromSource();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message, syncState });
  }
});

app.get('/api/options', async (_req, res) => {
  try {
    if (!repository) {
      return res.status(400).json({ error: 'Supabase no está configurado.' });
    }

    const options = await repository.getFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message, syncState });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    if (!repository) {
      return res.status(400).json({ error: 'Supabase no está configurado.' });
    }

    const filters = {
      category: req.query.category || '',
      club: req.query.club || config.clubNameFilter,
      event: req.query.event || '',
      athlete: req.query.athlete || '',
    };

    const data = await repository.listResults(filters);
    res.json({ data, filters });
  } catch (error) {
    res.status(500).json({ error: error.message, syncState });
  }
});

app.get('/api/rankings', async (req, res) => {
  try {
    if (!repository) {
      return res.status(400).json({ error: 'Supabase no está configurado.' });
    }

    const filters = {
      category: req.query.category || '',
      event: req.query.event || '',
    };

    const data = await repository.getRankings(filters);
    res.json({ data, filters, note: 'Clasificación completa: mejor marca por atleta y por prueba, sin límite de puestos.' });
  } catch (error) {
    res.status(500).json({ error: error.message, syncState });
  }
});

const server = app.listen(config.port, () => {
  console.log(`Athletics app listening on port ${config.port}`);

  if (config.autoSyncOnBoot) {
    setTimeout(() => {
      syncFromSource()
        .then((result) => console.log(`Auto-sync OK: ${result.importedRows} filas importadas desde ${result.sourceFileName}`))
        .catch((error) => console.error(`Auto-sync error: ${error.message}`));
    }, 1500);
  }

  if (config.autoSyncIntervalMinutes > 0) {
    setInterval(() => {
      syncFromSource()
        .then((result) => console.log(`Periodic sync OK: ${result.importedRows} filas importadas desde ${result.sourceFileName}`))
        .catch((error) => console.error(`Periodic sync error: ${error.message}`));
    }, config.autoSyncIntervalMinutes * 60 * 1000);
  }
});

module.exports = { app, server, syncFromSource };
