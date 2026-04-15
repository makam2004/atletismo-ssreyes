const XLSX = require('xlsx');

const HEADER_ALIASES = {
  athleteName: ['atleta', 'nombre', 'nombre atleta', 'athlete', 'competidor'],
  category: ['categoria', 'categoría', 'cat'],
  clubName: ['licencia', 'club', 'club/licencia', 'entidad', 'nombre comercial del club'],
  eventName: ['prueba', 'evento', 'discipline', 'disciplina'],
  mark: ['marca', 'tiempo', 'resultado', 'performance', 'result'],
  position: ['puesto', 'posición', 'posicion', 'rank'],
  license: ['licencia atleta', 'licencia federativa', 'n licencia'],
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findHeaderMap(headers) {
  const normalized = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  const result = {};

  for (const [target, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = normalized.find((item) => aliases.includes(item.normalized));
    if (match) {
      result[target] = match.original;
    }
  }

  return result;
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    return { rows: [], headerMap: {} };
  }

  const headers = Object.keys(rows[0]);
  const headerMap = findHeaderMap(headers);

  return { rows, headerMap, sheetName };
}

function normalizeRecord(row, headerMap, sourceFileName) {
  const athleteName = String(row[headerMap.athleteName] || '').trim();
  const category = String(row[headerMap.category] || '').trim();
  const clubName = String(row[headerMap.clubName] || '').trim();
  const eventName = String(row[headerMap.eventName] || '').trim();
  const mark = String(row[headerMap.mark] || '').trim();
  const position = String(row[headerMap.position] || '').trim();
  const license = String(row[headerMap.license] || '').trim();

  if (!athleteName || !eventName || !mark) {
    return null;
  }

  return {
    athlete_name: athleteName,
    category,
    club_name: clubName,
    event_name: eventName,
    mark_raw: mark,
    mark_seconds: parseMarkToSeconds(mark),
    position_raw: position,
    athlete_license: license,
    source_file_name: sourceFileName,
  };
}

function parseMarkToSeconds(raw) {
  if (!raw) return null;
  const value = String(raw).trim().replace(',', '.');

  if (/^\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  const parts = value.split(':').map((part) => part.trim());
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isNaN(minutes) && !Number.isNaN(seconds)) {
      return minutes * 60 + seconds;
    }
  }

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if (![hours, minutes, seconds].some(Number.isNaN)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  return null;
}

function filterRows(records, config) {
  const allowedCategories = new Set(config.categoryFilters.map((v) => v.toUpperCase()));
  return records.filter((record) => {
    return allowedCategories.has(String(record.category || '').toUpperCase());
  });
}

module.exports = {
  parseWorkbook,
  normalizeRecord,
  filterRows,
};
