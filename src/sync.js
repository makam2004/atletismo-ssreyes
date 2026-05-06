const { downloadLatestSpreadsheetBuffer } = require('./drive');
const { parseSpreadsheet } = require('./parser');
const { replaceSourceRows, getSyncStatus, saveSyncStatus } = require('./repository');

let running = false;

async function syncLatest({ force = false } = {}) {
  if (running) return { skipped: true, reason: 'sync already running' };
  running = true;
  try {
    const { file, buffer } = await downloadLatestSpreadsheetBuffer();
    const last = await getSyncStatus().catch(() => null);
    if (!force && last?.source_file_id === file.id && last?.source_modified_time === file.modifiedTime) {
      return { skipped: true, reason: 'no changes', file };
    }
    const rows = parseSpreadsheet(buffer, file);
    const result = await replaceSourceRows(file.id, rows);
    await saveSyncStatus({
      source_file_id: file.id,
      source_file_name: file.name,
      source_modified_time: file.modifiedTime,
      last_success_at: new Date().toISOString(),
      last_error: null,
      imported_rows: result.inserted
    });
    return { ok: true, file, importedRows: result.inserted };
  } catch (error) {
    await saveSyncStatus({ last_error: error.message, last_error_at: new Date().toISOString() }).catch(() => {});
    throw error;
  } finally {
    running = false;
  }
}

module.exports = { syncLatest };
