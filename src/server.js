import express from 'express';
import morgan from 'morgan';
import { assertRuntimeConfig, config } from './config.js';
import { listSpreadsheetFiles, downloadSpreadsheetFile } from './googleDrive.js';
import { parseWorkbook } from './excelParser.js';
import { getAthleteMarks, getDistinctFilterValues, getBestMarksRanking, replaceImportedFile } from './repository.js';

assertRuntimeConfig();

const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('public'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'athletics-importer' });
});

app.get('/api/config', (_req, res) => {
  res.json({
    clubNameFilter: config.clubNameFilter,
    categoryFilters: config.categoryFilters,
    driveFolderId: config.driveFolderId
  });
});

app.get('/api/files', async (_req, res) => {
  try {
    const files = await listSpreadsheetFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/latest', async (_req, res) => {
  try {
    const files = await listSpreadsheetFiles();
    const latest = files[0];
    if (!latest) {
      return res.status(404).json({ error: 'No spreadsheet files found in the Google Drive folder.' });
    }

    const buffer = await downloadSpreadsheetFile(latest.id, latest.mimeType);
    const parsed = parseWorkbook(buffer, latest);
    const result = await replaceImportedFile(latest.id, parsed.rows);

    res.json({
      importedFile: latest,
      importedRows: result.inserted,
      rowCount: parsed.rowCount,
      sheets: parsed.sheetSummaries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/file/:fileId', async (req, res) => {
  try {
    const files = await listSpreadsheetFiles();
    const file = files.find((item) => item.id === req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found in configured Drive folder.' });
    }

    const buffer = await downloadSpreadsheetFile(file.id, file.mimeType);
    const parsed = parseWorkbook(buffer, file);
    const result = await replaceImportedFile(file.id, parsed.rows);

    res.json({
      importedFile: file,
      importedRows: result.inserted,
      rowCount: parsed.rowCount,
      sheets: parsed.sheetSummaries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filters', async (_req, res) => {
  try {
    const values = await getDistinctFilterValues();
    res.json(values);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/athletes', async (req, res) => {
  try {
    const clubName = req.query.club_name === '__ALL__' ? '' : (req.query.club_name || config.clubNameFilter);
    const data = await getAthleteMarks({
      category: req.query.category,
      club_name: clubName,
      athlete_name: req.query.athlete_name,
      event_name: req.query.event_name
    });

    res.json({ count: data.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rankings', async (req, res) => {
  try {
    const data = await getBestMarksRanking({
      category: req.query.category,
      event_name: req.query.event_name,
      athlete_name: req.query.athlete_name
    });

    res.json({ count: data.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
