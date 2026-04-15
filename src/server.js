const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const { listSpreadsheetFiles, downloadFileBuffer, downloadBufferFromUrl } = require('./googleDrive');
const { parseWorkbook, normalizeRecord, filterRows } = require('./excelParser');
const { createRepository } = require('./repository');

const app = express();
const repository = createRepository(config);

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(express.static('public'));

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
      driveFolderConfigured: Boolean(config.driveFolderId),
      serviceAccountConfigured: Boolean(config.googleServiceAccountJson),
      publicFileConfigured: Boolean(config.publicFileUrl || config.publicFileId),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    clubNameFilter: config.clubNameFilter,
    categoryFilters: config.categoryFilters,
  });
});

app.get('/api/files', async (_req, res) => {
  try {
    if (!config.googleServiceAccountJson) {
      return res.json({
        files: [],
        note: 'No hay cuenta de servicio configurada. Usa PUBLIC_FILE_URL o PUBLIC_FILE_ID para importar directamente un fichero público.',
      });
    }

    const files = await listSpreadsheetFiles(config);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import', async (req, res) => {
  try {
    if (!repository) {
      return res.status(400).json({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' });
    }

    const explicitFileId = req.body?.fileId || config.publicFileId;
    const explicitUrl = req.body?.fileUrl || config.publicFileUrl;

    let sourceFileName = 'imported-file.xlsx';
    let buffer;

    if (explicitUrl) {
      buffer = await downloadBufferFromUrl(explicitUrl);
      sourceFileName = explicitUrl;
    } else if (explicitFileId) {
      buffer = await downloadFileBuffer(config, explicitFileId);
      sourceFileName = explicitFileId;
    } else if (config.googleServiceAccountJson && config.driveFolderId) {
      const files = await listSpreadsheetFiles(config);
      if (!files.length) {
        return res.status(404).json({ error: 'No se encontraron ficheros en Google Drive.' });
      }
      const latest = files[0];
      buffer = await downloadFileBuffer(config, latest.id);
      sourceFileName = latest.name || latest.id;
    } else {
      return res.status(400).json({
        error: 'No hay forma de importar. Configura GOOGLE_SERVICE_ACCOUNT_JSON o PUBLIC_FILE_URL o PUBLIC_FILE_ID.',
      });
    }

    const { rows, headerMap, sheetName } = parseWorkbook(buffer);
    const normalized = rows
      .map((row) => normalizeRecord(row, headerMap, sourceFileName))
      .filter(Boolean);
    const filtered = filterRows(normalized, config);

    const result = await repository.replaceImport(filtered, sourceFileName);

    res.json({
      ok: true,
      sheetName,
      sourceFileName,
      detectedHeaders: headerMap,
      parsedRows: rows.length,
      importedRows: result.inserted,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

app.listen(config.port, () => {
  console.log(`Athletics app listening on port ${config.port}`);
});
