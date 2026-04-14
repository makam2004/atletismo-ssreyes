import crypto from 'crypto';
import XLSX from 'xlsx';
import { config } from './config.js';

const COLUMN_ALIASES = {
  athlete_name: ['atleta', 'nombre', 'nombre atleta', 'athlete', 'competidor'],
  category: ['categoria', 'categoría', 'cat', 'category'],
  club_name: ['licencia', 'club', 'club/licencia', 'equipo', 'team', 'federacion', 'federación'],
  mark_raw: ['marca', 'tiempo', 'resultado', 'mark', 'result', 'performance'],
  position: ['puesto', 'pos', 'posición', 'position', 'ranking'],
  event_name: ['prueba', 'disciplina', 'evento', 'event'],
  gender: ['sexo', 'genero', 'género', 'gender']
};

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeCategory(value) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeClub(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

function buildHeaderMap(headers) {
  const map = {};
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      map[target] = headers[index];
    }
  }

  return map;
}

function parseMarkToSeconds(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number') {
    if (raw > 0 && raw < 1) {
      return raw * 24 * 60 * 60;
    }
    return raw;
  }

  const text = String(raw).trim().replace(',', '.');
  if (!text) return null;

  if (/^\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  const parts = text.split(':').map((part) => Number(part));
  if (parts.some(Number.isNaN)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function detectCategoryFromFields(record) {
  const categoryCandidate = record.category || '';
  const normalizedDirect = normalizeCategory(categoryCandidate);
  if (normalizedDirect) return normalizedDirect;

  const gender = normalizeText(record.gender);
  const athleteName = normalizeText(record.athlete_name);
  const eventName = normalizeText(record.event_name);
  const combined = `${athleteName} ${eventName} ${gender}`;

  if (combined.includes('u12f')) return 'U12F';
  if (combined.includes('u12m')) return 'U12M';
  return '';
}

export function parseWorkbook(buffer, sourceFile) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const acceptedCategories = new Set(config.categoryFilters.map((item) => item.toUpperCase()));
  const parsedRows = [];
  const sheetSummaries = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (!rows.length) continue;

    const headers = Object.keys(rows[0]);
    const headerMap = buildHeaderMap(headers);
    let keptInSheet = 0;

    rows.forEach((row, index) => {
      const record = {
        athlete_name: row[headerMap.athlete_name] || '',
        category: row[headerMap.category] || '',
        club_name: row[headerMap.club_name] || '',
        mark_raw: row[headerMap.mark_raw] || '',
        position: row[headerMap.position] || '',
        event_name: row[headerMap.event_name] || sheetName,
        gender: row[headerMap.gender] || ''
      };

      const normalizedCategory = detectCategoryFromFields(record);
      const athleteName = String(record.athlete_name || '').trim();
      const markRaw = String(record.mark_raw || '').trim();
      const clubName = String(record.club_name || '').trim();

      if (!athleteName || !markRaw) return;
      if (acceptedCategories.size && !acceptedCategories.has(normalizedCategory)) return;

      const payload = {
        source_file_id: sourceFile.id,
        source_file_name: sourceFile.name,
        source_modified_time: sourceFile.modifiedTime,
        source_sheet_name: sheetName,
        row_number: index + 2,
        athlete_name: athleteName,
        category: normalizedCategory,
        club_name: clubName || null,
        license: clubName || null,
        event_name: String(record.event_name || sheetName).trim(),
        mark_raw: markRaw,
        mark_value_seconds: parseMarkToSeconds(record.mark_raw),
        position: String(record.position || '').trim() || null,
        row_hash: crypto
          .createHash('sha256')
          .update(JSON.stringify([
            sourceFile.id,
            sheetName,
            athleteName,
            normalizedCategory,
            clubName,
            markRaw,
            record.event_name,
            index + 2
          ]))
          .digest('hex')
      };

      parsedRows.push(payload);
      keptInSheet += 1;
    });

    sheetSummaries.push({
      sheetName,
      totalRows: rows.length,
      importedRows: keptInSheet,
      detectedColumns: headerMap
    });
  }

  return {
    rowCount: parsedRows.length,
    rows: parsedRows,
    sheetSummaries
  };
}
